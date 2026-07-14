const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isWithinJurisdiction } = require('../utils/jurisdiction');

const router = express.Router();

// Key facility/infrastructure indicators worth tracking for development
// planning. "goodValue" is whichever answer represents the desirable
// state — most are "Yes" (e.g. Electricity Available), but a few are
// inverted (e.g. roof leakage — "No" is the good answer there).
const KEY_INDICATORS = [
  { id: 'infra_electricity_available', label: 'Electricity Available', goodValue: 'Yes' },
  { id: 'infra_drinking_water_available', label: 'Drinking Water Available', goodValue: 'Yes' },
  { id: 'infra_toilets_functional', label: 'Toilets Functional', goodValue: 'Yes' },
  { id: 'infra_separate_toilets', label: 'Separate Toilets (Boys/Girls)', goodValue: 'Yes' },
  { id: 'infra_handwashing', label: 'Handwashing Facility', goodValue: 'Yes' },
  { id: 'infra_ramp_available', label: 'Ramp Available (Accessibility)', goodValue: 'Yes' },
  { id: 'infra_playground_available', label: 'Playground Available', goodValue: 'Yes' },
  { id: 'infra_roof_leakage', label: 'No Roof Leakage', goodValue: 'No' },
  { id: 'digital_internet_available', label: 'Internet Available', goodValue: 'Yes' },
  { id: 'digital_computers_functional', label: 'Computers Functional', goodValue: 'Yes' },
  { id: 'safety_fire_extinguisher', label: 'Fire Extinguisher Available', goodValue: 'Yes' },
  { id: 'safety_first_aid_box', label: 'First Aid Box Available', goodValue: 'Yes' },
  { id: 'mdm_served_today', label: 'Mid-Day Meal Served', goodValue: 'Yes' }
];

// GET /api/reports/summary?district=&block=
// Admin-only. Scoped to the admin's own jurisdiction automatically (via
// the submitting officer's district/subdivision/block), with optional
// district/block query filters layered on top for narrowing further.
router.get('/summary', requireAuth('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.district, i.block, i.overall_grade, i.grade_score, i.answers_json, i.uploaded_at,
             o.district AS officer_district, o.subdivision AS officer_subdivision, o.block AS officer_block
      FROM inspections i
      LEFT JOIN officers o ON i.officer_id = o.id
    `);

    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    let rows = result.rows.filter((r) =>
      isWithinJurisdiction(adminCtx, { district: r.officer_district, subdivision: r.officer_subdivision, block: r.officer_block })
    );

    const { district, block } = req.query;
    if (district) rows = rows.filter((r) => r.district === district);
    if (block) rows = rows.filter((r) => r.block === block);

    const totalInspections = rows.length;

    // Grade distribution
    const gradeDistribution = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'Poor': 0 };
    rows.forEach((r) => {
      if (r.overall_grade && gradeDistribution[r.overall_grade] !== undefined) {
        gradeDistribution[r.overall_grade]++;
      }
    });

    // Key indicators — % of inspected schools meeting each standard
    const indicators = KEY_INDICATORS.map((ind) => {
      let yesCount = 0;
      let noCount = 0;
      rows.forEach((r) => {
        try {
          const answers = JSON.parse(r.answers_json || '{}');
          const val = answers[ind.id] && answers[ind.id].value;
          if (val === 'Yes') yesCount++;
          else if (val === 'No') noCount++;
        } catch (e) {
          // skip malformed rows rather than fail the whole report
        }
      });
      const answered = yesCount + noCount;
      const goodCount = ind.goodValue === 'Yes' ? yesCount : noCount;
      return {
        id: ind.id,
        label: ind.label,
        answered,
        goodPercent: answered > 0 ? Math.round((goodCount / answered) * 100) : null
      };
    });

    // Monthly trend, by upload date
    const monthlyMap = {};
    rows.forEach((r) => {
      const d = new Date(r.uploaded_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { count: 0, gradeSum: 0, gradeCount: 0 };
      monthlyMap[key].count++;
      if (r.grade_score !== null && r.grade_score !== undefined) {
        monthlyMap[key].gradeSum += r.grade_score;
        monthlyMap[key].gradeCount++;
      }
    });
    const monthlyTrend = Object.keys(monthlyMap).sort().map((key) => ({
      month: key,
      count: monthlyMap[key].count,
      avgGradeScore: monthlyMap[key].gradeCount > 0 ? Math.round(monthlyMap[key].gradeSum / monthlyMap[key].gradeCount) : null
    }));

    res.json({ totalInspections, gradeDistribution, indicators, monthlyTrend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating report', detail: err.message });
  }
});

// --- Shared helper: fetch every inspection within the requesting admin's jurisdiction ---
async function getScopedInspections(req) {
  const result = await pool.query(`
    SELECT i.id, i.school_id, i.school_name, i.district, i.block, i.answers_json, i.uploaded_at,
           o.district AS officer_district, o.subdivision AS officer_subdivision, o.block AS officer_block
    FROM inspections i
    LEFT JOIN officers o ON i.officer_id = o.id
  `);
  const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
  return result.rows.filter((r) =>
    isWithinJurisdiction(adminCtx, { district: r.officer_district, subdivision: r.officer_subdivision, block: r.officer_block })
  );
}

function parseAnswers(answersJson) {
  try {
    return JSON.parse(answersJson || '{}');
  } catch (e) {
    return {};
  }
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ====================================================================
// TEACHER ATTENDANCE
// ====================================================================
function extractTeacherAttendance(answers) {
  const val = (id) => parseInt(answers[id] && answers[id].value, 10) || 0;
  const posted = val('staff_teach_male') + val('staff_teach_female');
  const present = val('staff_teach_present_male') + val('staff_teach_present_female');
  const unauthorizedLeave = (answers['unauthorized_leave'] && answers['unauthorized_leave'].value) === 'Yes'
    ? (parseInt(answers['unauthorized_leave_count'] && answers['unauthorized_leave_count'].value, 10) || 0)
    : 0;
  return {
    posted,
    present,
    percent: posted > 0 ? Math.round((present / posted) * 100) : null,
    unauthorizedLeave
  };
}

// GET /api/reports/teacher-attendance?block=X
// No block -> overview grouped by block (within your jurisdiction).
// With block -> full drill-down for that one block.
router.get('/teacher-attendance', requireAuth('admin'), async (req, res) => {
  try {
    const rows = await getScopedInspections(req);
    const enriched = rows
      .map((r) => ({ ...r, ta: extractTeacherAttendance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.ta.posted > 0);

    const { block } = req.query;

    if (!block) {
      const blockMap = {};
      enriched.forEach((r) => {
        const key = r.block || 'Unknown Block';
        if (!blockMap[key]) blockMap[key] = { block: key, district: r.district, inspectionCount: 0, percentSum: 0, percentCount: 0, unauthorizedLeaveTotal: 0 };
        blockMap[key].inspectionCount++;
        if (r.ta.percent !== null) { blockMap[key].percentSum += r.ta.percent; blockMap[key].percentCount++; }
        blockMap[key].unauthorizedLeaveTotal += r.ta.unauthorizedLeave;
      });
      const blocks = Object.values(blockMap).map((b) => ({
        block: b.block,
        district: b.district,
        inspectionCount: b.inspectionCount,
        avgAttendancePercent: b.percentCount > 0 ? Math.round(b.percentSum / b.percentCount) : null,
        unauthorizedLeaveTotal: b.unauthorizedLeaveTotal
      })).sort((a, b) => (a.avgAttendancePercent ?? 999) - (b.avgAttendancePercent ?? 999));
      return res.json({ mode: 'overview', blocks });
    }

    const blockRows = enriched.filter((r) => r.block === block);
    const schools = blockRows
      .map((r) => ({ schoolId: r.school_id, schoolName: r.school_name, attendancePercent: r.ta.percent, unauthorizedLeave: r.ta.unauthorizedLeave, uploadedAt: r.uploaded_at }))
      .sort((a, b) => (b.attendancePercent ?? -1) - (a.attendancePercent ?? -1));

    const totalUnauthorizedLeave = blockRows.reduce((sum, r) => sum + r.ta.unauthorizedLeave, 0);
    const validPercents = blockRows.map((r) => r.ta.percent).filter((p) => p !== null);
    const avgAttendancePercent = validPercents.length > 0 ? Math.round(validPercents.reduce((a, b) => a + b, 0) / validPercents.length) : null;

    const monthlyMap = {};
    blockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      if (r.ta.percent !== null) { monthlyMap[key].sum += r.ta.percent; monthlyMap[key].count++; }
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgAttendancePercent: monthlyMap[k].count > 0 ? Math.round(monthlyMap[k].sum / monthlyMap[k].count) : null }));

    res.json({ mode: 'detail', block, totalInspections: blockRows.length, avgAttendancePercent, totalUnauthorizedLeave, schools, trend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating teacher attendance report', detail: err.message });
  }
});

// ====================================================================
// STUDENT ATTENDANCE
// ====================================================================
function extractStudentAttendance(answers) {
  let totalEnr = 0;
  let totalPres = 0;
  Object.keys(answers).forEach((key) => {
    const match = key.match(/^cls(.+)_enrB$/);
    if (!match) return;
    const label = match[1];
    const v = (id) => parseInt(answers[id] && answers[id].value, 10) || 0;
    totalEnr += v(`cls${label}_enrB`) + v(`cls${label}_enrG`);
    totalPres += v(`cls${label}_presB`) + v(`cls${label}_presG`);
  });
  return { totalEnr, totalPres, percent: totalEnr > 0 ? Math.round((totalPres / totalEnr) * 100) : null };
}

// GET /api/reports/student-attendance?block=X — same overview/detail pattern as teacher attendance.
router.get('/student-attendance', requireAuth('admin'), async (req, res) => {
  try {
    const rows = await getScopedInspections(req);
    const enriched = rows
      .map((r) => ({ ...r, sa: extractStudentAttendance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.sa.totalEnr > 0);

    const { block } = req.query;

    if (!block) {
      const blockMap = {};
      enriched.forEach((r) => {
        const key = r.block || 'Unknown Block';
        if (!blockMap[key]) blockMap[key] = { block: key, district: r.district, inspectionCount: 0, percentSum: 0, percentCount: 0 };
        blockMap[key].inspectionCount++;
        if (r.sa.percent !== null) { blockMap[key].percentSum += r.sa.percent; blockMap[key].percentCount++; }
      });
      const blocks = Object.values(blockMap).map((b) => ({
        block: b.block,
        district: b.district,
        inspectionCount: b.inspectionCount,
        avgAttendancePercent: b.percentCount > 0 ? Math.round(b.percentSum / b.percentCount) : null
      })).sort((a, b) => (a.avgAttendancePercent ?? 999) - (b.avgAttendancePercent ?? 999));
      return res.json({ mode: 'overview', blocks });
    }

    const blockRows = enriched.filter((r) => r.block === block);
    const schools = blockRows
      .map((r) => ({ schoolId: r.school_id, schoolName: r.school_name, attendancePercent: r.sa.percent, totalEnrolled: r.sa.totalEnr, totalPresent: r.sa.totalPres, uploadedAt: r.uploaded_at }))
      .sort((a, b) => (b.attendancePercent ?? -1) - (a.attendancePercent ?? -1));

    const validPercents = blockRows.map((r) => r.sa.percent).filter((p) => p !== null);
    const avgAttendancePercent = validPercents.length > 0 ? Math.round(validPercents.reduce((a, b) => a + b, 0) / validPercents.length) : null;

    const monthlyMap = {};
    blockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      if (r.sa.percent !== null) { monthlyMap[key].sum += r.sa.percent; monthlyMap[key].count++; }
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgAttendancePercent: monthlyMap[k].count > 0 ? Math.round(monthlyMap[k].sum / monthlyMap[k].count) : null }));

    res.json({ mode: 'detail', block, totalInspections: blockRows.length, avgAttendancePercent, schools, trend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating student attendance report', detail: err.message });
  }
});

// ====================================================================
// ACADEMIC PERFORMANCE
// ====================================================================
const CHOICE_SCORE = { Excellent: 4, Good: 3, Average: 2, Poor: 1 };

function extractAcademicPerformance(answers) {
  const get = (id) => {
    const v = answers[id] && answers[id].value;
    return CHOICE_SCORE[v] !== undefined ? CHOICE_SCORE[v] : null;
  };
  const learning = get('academic_learning_outcome');
  const reading = get('academic_reading_ability');
  const writing = get('academic_writing_ability');
  const math = get('academic_math_understanding');
  const scores = [learning, reading, writing, math].filter((s) => s !== null);
  if (scores.length === 0) return null;
  return {
    score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
    reading, writing, math, learning
  };
}

function scoreToLabel(score) {
  if (score === null || score === undefined) return null;
  if (score >= 3.5) return 'Excellent';
  if (score >= 2.5) return 'Good';
  if (score >= 1.5) return 'Average';
  return 'Poor';
}

// GET /api/reports/academic-performance?block=X — same overview/detail pattern.
router.get('/academic-performance', requireAuth('admin'), async (req, res) => {
  try {
    const rows = await getScopedInspections(req);
    const enriched = rows
      .map((r) => ({ ...r, ap: extractAcademicPerformance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.ap !== null);

    const { block } = req.query;

    if (!block) {
      const blockMap = {};
      enriched.forEach((r) => {
        const key = r.block || 'Unknown Block';
        if (!blockMap[key]) blockMap[key] = { block: key, district: r.district, inspectionCount: 0, scoreSum: 0 };
        blockMap[key].inspectionCount++;
        blockMap[key].scoreSum += r.ap.score;
      });
      const blocks = Object.values(blockMap).map((b) => ({
        block: b.block,
        district: b.district,
        inspectionCount: b.inspectionCount,
        avgScore: Math.round((b.scoreSum / b.inspectionCount) * 100) / 100,
        avgLabel: scoreToLabel(b.scoreSum / b.inspectionCount)
      })).sort((a, b) => a.avgScore - b.avgScore);
      return res.json({ mode: 'overview', blocks });
    }

    const blockRows = enriched.filter((r) => r.block === block);
    const schools = blockRows
      .map((r) => ({ schoolId: r.school_id, schoolName: r.school_name, score: r.ap.score, label: scoreToLabel(r.ap.score), reading: r.ap.reading, writing: r.ap.writing, math: r.ap.math, uploadedAt: r.uploaded_at }))
      .sort((a, b) => b.score - a.score);

    const avgScore = blockRows.length > 0 ? Math.round((blockRows.reduce((sum, r) => sum + r.ap.score, 0) / blockRows.length) * 100) / 100 : null;
    const avgBySkill = (key) => {
      const vals = blockRows.map((r) => r.ap[key]).filter((v) => v !== null);
      return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
    };

    const monthlyMap = {};
    blockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      monthlyMap[key].sum += r.ap.score;
      monthlyMap[key].count++;
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgScore: Math.round((monthlyMap[k].sum / monthlyMap[k].count) * 100) / 100 }));

    res.json({
      mode: 'detail', block, totalInspections: blockRows.length, avgScore, avgLabel: scoreToLabel(avgScore),
      skillBreakdown: { reading: avgBySkill('reading'), writing: avgBySkill('writing'), math: avgBySkill('math') },
      schools, trend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating academic performance report', detail: err.message });
  }
});

module.exports = router;
