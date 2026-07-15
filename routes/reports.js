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
      SELECT i.id, i.school_id, i.school_name, i.district, i.block, i.overall_grade, i.grade_score, i.answers_json, i.uploaded_at,
             o.district AS officer_district, o.subdivision AS officer_subdivision, o.block AS officer_block
      FROM inspections i
      LEFT JOIN officers o ON i.officer_id = o.id
    `);

    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    let allRows = result.rows.filter((r) =>
      isWithinJurisdiction(adminCtx, { district: r.officer_district, subdivision: r.officer_subdivision, block: r.officer_block })
    );

    const { district, block } = req.query;
    if (district) allRows = allRows.filter((r) => r.district === district);
    if (block) allRows = allRows.filter((r) => r.block === block);

    // Current-state snapshot (this calendar year, latest inspection per
    // school) — what grade distribution and facility indicators are based
    // on, so a school inspected 3 times doesn't get counted 3 times.
    const rows = currentYearLatestPerSchool(allRows);
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

    // Monthly trend — deliberately uses the FULL inspection history (every
    // visit, not deduplicated), since a trend line's purpose is to show
    // actual activity over time, unlike the snapshot figures above.
    const monthlyMap = {};
    allRows.forEach((r) => {
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

    res.json({ year: new Date().getFullYear(), totalInspections, gradeDistribution, indicators, monthlyTrend });
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

// Restricts a set of scoped inspections to a single "current state"
// snapshot: only the current calendar year, and — if a school was
// inspected more than once within that year — only its MOST RECENT
// visit. This is what every average, ranking, distribution, and
// facility-percentage figure is based on, so a school inspected 3
// times in 10 days doesn't skew the numbers 3x. Resets automatically
// on 1 January every year — no manual reset needed.
//
// Deliberately NOT used for month-by-month trend charts, which stay
// based on the full inspection history — a trend line's whole purpose
// is to show real activity over time, so collapsing it to one point
// per school would defeat it.
function currentYearLatestPerSchool(rows, year) {
  const targetYear = year || new Date().getFullYear();
  const yearRows = rows.filter((r) => new Date(r.uploaded_at).getFullYear() === targetYear);
  const bySchool = {};
  yearRows.forEach((r) => {
    const key = r.school_id != null ? `id:${r.school_id}` : `name:${r.school_name}|${r.district}|${r.block}`;
    if (!bySchool[key] || new Date(r.uploaded_at) > new Date(bySchool[key].uploaded_at)) {
      bySchool[key] = r;
    }
  });
  return Object.values(bySchool);
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
    const allRows = await getScopedInspections(req);
    const currentRows = currentYearLatestPerSchool(allRows);
    const enriched = currentRows
      .map((r) => ({ ...r, ta: extractTeacherAttendance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.ta.posted > 0);
    // Full history (not deduplicated) — used only for the trend chart.
    const allEnriched = allRows
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
      return res.json({ mode: 'overview', year: new Date().getFullYear(), blocks });
    }

    const blockRows = enriched.filter((r) => r.block === block);
    const schools = blockRows
      .map((r) => ({ schoolId: r.school_id, schoolName: r.school_name, attendancePercent: r.ta.percent, unauthorizedLeave: r.ta.unauthorizedLeave, uploadedAt: r.uploaded_at }))
      .sort((a, b) => (b.attendancePercent ?? -1) - (a.attendancePercent ?? -1));

    const totalUnauthorizedLeave = blockRows.reduce((sum, r) => sum + r.ta.unauthorizedLeave, 0);
    const validPercents = blockRows.map((r) => r.ta.percent).filter((p) => p !== null);
    const avgAttendancePercent = validPercents.length > 0 ? Math.round(validPercents.reduce((a, b) => a + b, 0) / validPercents.length) : null;

    const allBlockRows = allEnriched.filter((r) => r.block === block);
    const monthlyMap = {};
    allBlockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      if (r.ta.percent !== null) { monthlyMap[key].sum += r.ta.percent; monthlyMap[key].count++; }
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgAttendancePercent: monthlyMap[k].count > 0 ? Math.round(monthlyMap[k].sum / monthlyMap[k].count) : null }));

    res.json({ mode: 'detail', block, year: new Date().getFullYear(), totalInspections: blockRows.length, avgAttendancePercent, totalUnauthorizedLeave, schools, trend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating teacher attendance report', detail: err.message });
  }
});

// ====================================================================
// STUDENT ATTENDANCE
// ====================================================================
const CLASS_ORDER = ['Pre-Primary', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function classSortIndex(label) {
  const i = CLASS_ORDER.indexOf(label);
  return i === -1 ? 999 : i;
}

// Extracts totals AND keeps the per-class, per-gender breakdown — this is
// what was being collected all along but never actually surfaced.
function extractStudentAttendance(answers) {
  let totalEnr = 0;
  let totalPres = 0;
  let boysEnr = 0;
  let boysPres = 0;
  let girlsEnr = 0;
  let girlsPres = 0;
  const byClass = {};

  Object.keys(answers).forEach((key) => {
    const match = key.match(/^cls(.+)_enrB$/);
    if (!match) return;
    const label = match[1];
    const v = (id) => parseInt(answers[id] && answers[id].value, 10) || 0;
    const enrB = v(`cls${label}_enrB`);
    const enrG = v(`cls${label}_enrG`);
    const presB = v(`cls${label}_presB`);
    const presG = v(`cls${label}_presG`);

    totalEnr += enrB + enrG;
    totalPres += presB + presG;
    boysEnr += enrB;
    boysPres += presB;
    girlsEnr += enrG;
    girlsPres += presG;
    byClass[label] = { enrB, enrG, presB, presG };
  });

  return {
    totalEnr, totalPres, boysEnr, boysPres, girlsEnr, girlsPres, byClass,
    percent: totalEnr > 0 ? Math.round((totalPres / totalEnr) * 100) : null
  };
}

// Sums the per-class, per-gender breakdown across every inspection in a
// block (or school), so a "Class V attendance" or "girls vs boys" figure
// reflects the whole block, not just one school.
function aggregateStudentDetail(blockRows) {
  let totalEnr = 0, totalPres = 0, boysEnr = 0, boysPres = 0, girlsEnr = 0, girlsPres = 0;
  const classAgg = {};

  blockRows.forEach((r) => {
    totalEnr += r.sa.totalEnr;
    totalPres += r.sa.totalPres;
    boysEnr += r.sa.boysEnr;
    boysPres += r.sa.boysPres;
    girlsEnr += r.sa.girlsEnr;
    girlsPres += r.sa.girlsPres;
    Object.entries(r.sa.byClass).forEach(([label, c]) => {
      if (!classAgg[label]) classAgg[label] = { enrB: 0, enrG: 0, presB: 0, presG: 0 };
      classAgg[label].enrB += c.enrB;
      classAgg[label].enrG += c.enrG;
      classAgg[label].presB += c.presB;
      classAgg[label].presG += c.presG;
    });
  });

  const classBreakdown = Object.keys(classAgg)
    .sort((a, b) => classSortIndex(a) - classSortIndex(b))
    .map((label) => {
      const c = classAgg[label];
      const enr = c.enrB + c.enrG;
      const pres = c.presB + c.presG;
      return {
        classLabel: label,
        enrolledBoys: c.enrB, enrolledGirls: c.enrG,
        presentBoys: c.presB, presentGirls: c.presG,
        boysPercent: c.enrB > 0 ? Math.round((c.presB / c.enrB) * 100) : null,
        girlsPercent: c.enrG > 0 ? Math.round((c.presG / c.enrG) * 100) : null,
        overallPercent: enr > 0 ? Math.round((pres / enr) * 100) : null
      };
    });

  return {
    totalEnrolled: totalEnr,
    totalPresent: totalPres,
    avgAttendancePercent: totalEnr > 0 ? Math.round((totalPres / totalEnr) * 100) : null,
    boysEnrolled: boysEnr, boysPresent: boysPres, boysPercent: boysEnr > 0 ? Math.round((boysPres / boysEnr) * 100) : null,
    girlsEnrolled: girlsEnr, girlsPresent: girlsPres, girlsPercent: girlsEnr > 0 ? Math.round((girlsPres / girlsEnr) * 100) : null,
    classBreakdown
  };
}

// GET /api/reports/student-attendance?block=X
router.get('/student-attendance', requireAuth('admin'), async (req, res) => {
  try {
    const allRows = await getScopedInspections(req);
    const currentRows = currentYearLatestPerSchool(allRows);
    const enriched = currentRows
      .map((r) => ({ ...r, sa: extractStudentAttendance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.sa.totalEnr > 0);
    const allEnriched = allRows
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
      return res.json({ mode: 'overview', year: new Date().getFullYear(), blocks });
    }

    const blockRows = enriched.filter((r) => r.block === block);
    const detail = aggregateStudentDetail(blockRows);

    const schools = blockRows
      .map((r) => ({
        schoolId: r.school_id, schoolName: r.school_name,
        attendancePercent: r.sa.percent, totalEnrolled: r.sa.totalEnr, totalPresent: r.sa.totalPres,
        boysPercent: r.sa.boysEnr > 0 ? Math.round((r.sa.boysPres / r.sa.boysEnr) * 100) : null,
        girlsPercent: r.sa.girlsEnr > 0 ? Math.round((r.sa.girlsPres / r.sa.girlsEnr) * 100) : null,
        uploadedAt: r.uploaded_at
      }))
      .sort((a, b) => (b.attendancePercent ?? -1) - (a.attendancePercent ?? -1));

    const allBlockRows = allEnriched.filter((r) => r.block === block);
    const monthlyMap = {};
    allBlockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      if (r.sa.percent !== null) { monthlyMap[key].sum += r.sa.percent; monthlyMap[key].count++; }
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgAttendancePercent: monthlyMap[k].count > 0 ? Math.round(monthlyMap[k].sum / monthlyMap[k].count) : null }));

    res.json({ mode: 'detail', block, year: new Date().getFullYear(), totalInspections: blockRows.length, ...detail, schools, trend });
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
    const allRows = await getScopedInspections(req);
    const currentRows = currentYearLatestPerSchool(allRows);
    const enriched = currentRows
      .map((r) => ({ ...r, ap: extractAcademicPerformance(parseAnswers(r.answers_json)) }))
      .filter((r) => r.ap !== null);
    const allEnriched = allRows
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
      return res.json({ mode: 'overview', year: new Date().getFullYear(), blocks });
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

    const allBlockRows = allEnriched.filter((r) => r.block === block);
    const monthlyMap = {};
    allBlockRows.forEach((r) => {
      const key = monthKey(r.uploaded_at);
      if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0 };
      monthlyMap[key].sum += r.ap.score;
      monthlyMap[key].count++;
    });
    const trend = Object.keys(monthlyMap).sort().map((k) => ({ month: k, avgScore: Math.round((monthlyMap[k].sum / monthlyMap[k].count) * 100) / 100 }));

    res.json({
      mode: 'detail', block, year: new Date().getFullYear(), totalInspections: blockRows.length, avgScore, avgLabel: scoreToLabel(avgScore),
      skillBreakdown: { reading: avgBySkill('reading'), writing: avgBySkill('writing'), math: avgBySkill('math') },
      schools, trend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating academic performance report', detail: err.message });
  }
});

// ====================================================================
// INFRASTRUCTURE
// ====================================================================
// Each condition field uses a different answer scale — map each to a
// 0-100 score so they can be combined/compared/plotted on one radar.
const CONDITION_SCALES = {
  infra_boundary_wall: { Good: 100, Average: 60, Poor: 25, Absent: 0 },
  infra_building_condition: { Excellent: 100, Good: 70, Fair: 40, Poor: 10 },
  infra_roof_condition: { Excellent: 100, Good: 70, Fair: 40, Poor: 10 },
  infra_ceiling_condition: { Good: 100, Fair: 55, Poor: 15 } // "Not Applicable" excluded from scoring
};
const CONDITION_LABELS = {
  infra_boundary_wall: 'Boundary Wall',
  infra_building_condition: 'Building Condition',
  infra_roof_condition: 'Roof Condition',
  infra_ceiling_condition: 'Ceiling Condition'
};

const UTILITY_INDICATORS = [
  { id: 'infra_electricity_available', label: 'Electricity' },
  { id: 'infra_drinking_water_available', label: 'Drinking Water' },
  { id: 'infra_toilets_functional', label: 'Toilets Functional' },
  { id: 'infra_separate_toilets', label: 'Separate Toilets' },
  { id: 'infra_handwashing', label: 'Handwashing' },
  { id: 'infra_ramp_available', label: 'Ramp (Accessibility)' }
];
const FACILITY_INDICATORS = [
  { id: 'infra_library_available', label: 'Library' },
  { id: 'infra_science_lab_available', label: 'Science Lab' },
  { id: 'infra_sports_equipment_available', label: 'Sports Equipment' },
  { id: 'infra_playground_available', label: 'Playground' }
];

function yesNoValue(answers, id) {
  const v = answers[id] && answers[id].value;
  if (v === 'Yes') return true;
  if (v === 'No') return false;
  return null;
}

function extractInfrastructure(answers) {
  const conditionScores = {};
  Object.keys(CONDITION_SCALES).forEach((id) => {
    const v = answers[id] && answers[id].value;
    const map = CONDITION_SCALES[id];
    if (v && map[v] !== undefined) conditionScores[id] = map[v];
  });

  const utilities = {};
  UTILITY_INDICATORS.forEach((u) => { utilities[u.id] = yesNoValue(answers, u.id); });
  const facilities = {};
  FACILITY_INDICATORS.forEach((f) => { facilities[f.id] = yesNoValue(answers, f.id); });

  const roofLeak = yesNoValue(answers, 'infra_roof_leakage');
  const fansInstalled = parseInt(answers['infra_fans_working'] && answers['infra_fans_working'].value, 10) || 0;
  const fansWorking = parseInt(answers['infra_fans_working'] && answers['infra_fans_working'].value2, 10) || 0;
  const lightsInstalled = parseInt(answers['infra_lights_working'] && answers['infra_lights_working'].value, 10) || 0;
  const lightsWorking = parseInt(answers['infra_lights_working'] && answers['infra_lights_working'].value2, 10) || 0;
  const waterQuality = answers['infra_water_quality'] && answers['infra_water_quality'].value;
  const buildingType = answers['infra_building_type'] && answers['infra_building_type'].value;

  const scoreValues = [];
  Object.values(conditionScores).forEach((v) => scoreValues.push(v));
  Object.values(utilities).forEach((v) => { if (v !== null) scoreValues.push(v ? 100 : 0); });
  Object.values(facilities).forEach((v) => { if (v !== null) scoreValues.push(v ? 100 : 0); });
  const healthScore = scoreValues.length > 0 ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  return { conditionScores, utilities, facilities, roofLeak, fansInstalled, fansWorking, lightsInstalled, lightsWorking, waterQuality, buildingType, healthScore };
}

function aggregateInfrastructure(infraRows) {
  const withScore = infraRows.filter((r) => r.infra.healthScore !== null);
  const overallHealthScore = withScore.length > 0 ? Math.round(withScore.reduce((sum, r) => sum + r.infra.healthScore, 0) / withScore.length) : null;

  const conditionRadar = {};
  Object.keys(CONDITION_LABELS).forEach((id) => {
    const vals = infraRows.map((r) => r.infra.conditionScores[id]).filter((v) => v !== undefined);
    conditionRadar[id] = { label: CONDITION_LABELS[id], score: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });

  const buildIndicatorList = (list, key) => list.map((ind) => {
    const vals = infraRows.map((r) => r.infra[key][ind.id]).filter((v) => v !== null);
    return { id: ind.id, label: ind.label, answered: vals.length, goodPercent: vals.length > 0 ? Math.round((vals.filter((v) => v).length / vals.length) * 100) : null };
  });
  const utilityIndicators = buildIndicatorList(UTILITY_INDICATORS, 'utilities');
  const facilityIndicators = buildIndicatorList(FACILITY_INDICATORS, 'facilities');

  const roofAnswered = infraRows.map((r) => r.infra.roofLeak).filter((v) => v !== null);
  const roofLeakCount = roofAnswered.filter((v) => v === true).length;
  const roofLeakage = { count: roofLeakCount, total: roofAnswered.length, percent: roofAnswered.length > 0 ? Math.round((roofLeakCount / roofAnswered.length) * 100) : null };

  const sumField = (field) => infraRows.reduce((sum, r) => sum + r.infra[field], 0);
  const fansInstalled = sumField('fansInstalled');
  const fansWorking = sumField('fansWorking');
  const lightsInstalled = sumField('lightsInstalled');
  const lightsWorking = sumField('lightsWorking');
  const electricalFixtures = {
    fansInstalled, fansWorking, fansPercent: fansInstalled > 0 ? Math.round((fansWorking / fansInstalled) * 100) : null,
    lightsInstalled, lightsWorking, lightsPercent: lightsInstalled > 0 ? Math.round((lightsWorking / lightsInstalled) * 100) : null
  };

  const waterQuality = { Good: 0, Average: 0, Poor: 0 };
  infraRows.forEach((r) => { if (r.infra.waterQuality && waterQuality[r.infra.waterQuality] !== undefined) waterQuality[r.infra.waterQuality]++; });

  const buildingTypeDistribution = {};
  infraRows.forEach((r) => {
    const t = r.infra.buildingType;
    if (t) buildingTypeDistribution[t] = (buildingTypeDistribution[t] || 0) + 1;
  });

  return { totalInspections: infraRows.length, overallHealthScore, conditionRadar, utilityIndicators, facilityIndicators, roofLeakage, electricalFixtures, waterQuality, buildingTypeDistribution };
}

// GET /api/reports/infrastructure?block=X
router.get('/infrastructure', requireAuth('admin'), async (req, res) => {
  try {
    const allRows = await getScopedInspections(req);
    const currentRows = currentYearLatestPerSchool(allRows);
    const infraRows = currentRows
      .map((r) => ({ ...r, infra: extractInfrastructure(parseAnswers(r.answers_json)) }))
      .filter((r) => r.infra.healthScore !== null);

    const { block } = req.query;

    if (!block) {
      const blockMap = {};
      infraRows.forEach((r) => {
        const key = r.block || 'Unknown Block';
        if (!blockMap[key]) blockMap[key] = [];
        blockMap[key].push(r);
      });
      const blocks = Object.entries(blockMap).map(([blockName, blockRows]) => {
        const agg = aggregateInfrastructure(blockRows);
        return { block: blockName, district: blockRows[0].district, inspectionCount: blockRows.length, healthScore: agg.overallHealthScore };
      }).sort((a, b) => (a.healthScore ?? 999) - (b.healthScore ?? 999));

      const overall = aggregateInfrastructure(infraRows);
      return res.json({ mode: 'overview', year: new Date().getFullYear(), ...overall, blocks });
    }

    const blockRows = infraRows.filter((r) => r.block === block);
    const agg = aggregateInfrastructure(blockRows);
    const schools = blockRows.map((r) => ({ schoolId: r.school_id, schoolName: r.school_name, healthScore: r.infra.healthScore, uploadedAt: r.uploaded_at }))
      .sort((a, b) => (b.healthScore ?? -1) - (a.healthScore ?? -1));

    res.json({ mode: 'detail', block, year: new Date().getFullYear(), ...agg, schools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating infrastructure report', detail: err.message });
  }
});

// ====================================================================
// SINGLE SCHOOL — combined teacher + student attendance
// ====================================================================
// GET /api/reports/school/:schoolId
// This is what a school name links to from the "Best to Worst" lists —
// no more digging through Inspections and downloading a PDF just to
// see one school's numbers.
//
// Scoped to the current calendar year, matching every other report. If
// the school was inspected more than once this year, a combined total
// would be misleading (e.g. "attendance" across 3 visits in 10 days
// means nothing useful) — so instead of aggregating, this returns each
// inspection's raw answers separately, and the Portal renders them as
// a side-by-side table: one column per date, latest on the left.
router.get('/school/:schoolId', requireAuth('admin'), async (req, res) => {
  try {
    const schoolResult = await pool.query('SELECT id, name, district, subdivision, block FROM schools WHERE id = $1', [req.params.schoolId]);
    if (schoolResult.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const school = schoolResult.rows[0];

    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(adminCtx, school)) {
      return res.status(403).json({ error: 'This school is outside your jurisdiction.' });
    }

    const currentYear = new Date().getFullYear();
    const result = await pool.query(
      `SELECT id, answers_json, uploaded_at, overall_grade, grade_score, photos_json, signature_base64
       FROM inspections
       WHERE school_id = $1 AND EXTRACT(YEAR FROM uploaded_at) = $2
       ORDER BY uploaded_at DESC`,
      [req.params.schoolId, currentYear]
    );

    const baseInfo = { schoolName: school.name, district: school.district, block: school.block, year: currentYear };

    if (result.rows.length === 0) {
      return res.json({ ...baseInfo, totalInspections: 0, multipleInspections: false, teacher: null, student: null });
    }

    if (result.rows.length === 1) {
      const r = result.rows[0];
      const answers = parseAnswers(r.answers_json);
      const ta = extractTeacherAttendance(answers);
      const sa = extractStudentAttendance(answers);

      const teacher = ta.posted > 0
        ? { totalInspections: 1, attendancePercent: ta.percent, teachersPosted: ta.posted, teachersPresent: ta.present, unauthorizedLeaveTotal: ta.unauthorizedLeave, trend: [{ date: r.uploaded_at, percent: ta.percent, unauthorizedLeave: ta.unauthorizedLeave }] }
        : { totalInspections: 0, attendancePercent: null, teachersPosted: 0, teachersPresent: 0, unauthorizedLeaveTotal: 0, trend: [] };

      let student = null;
      if (sa.totalEnr > 0) {
        const agg = aggregateStudentDetail([{ sa }]);
        student = { totalInspections: 1, ...agg, trend: [{ date: r.uploaded_at, percent: sa.percent }] };
      }

      return res.json({
        ...baseInfo, totalInspections: 1, multipleInspections: false,
        overallGrade: r.overall_grade, uploadedAt: r.uploaded_at,
        teacher, student
      });
    }

    // Multiple inspections this year — hand the Portal each date's raw
    // answers so it can render the side-by-side comparison table using
    // the same question schema the full inspection report already uses.
    const inspections = result.rows.map((r) => ({
      inspectionId: r.id,
      date: r.uploaded_at,
      overallGrade: r.overall_grade,
      gradeScore: r.grade_score,
      answersJson: r.answers_json
    }));

    res.json({ ...baseInfo, totalInspections: result.rows.length, multipleInspections: true, inspections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating school report', detail: err.message });
  }
});

// ====================================================================
// QUICK DELIVERABLES
// ====================================================================
// The whole point of this report: a clean, per-facility list of which
// schools have it and which don't — meant to be printed and handed to
// panchayats, urban local bodies, and line departments so a specific,
// concrete gap (e.g. "these 6 schools have no handwashing facility")
// can go straight into their own development/financial plans.
const QUICK_DELIVERABLES = [
  { id: 'infra_electricity_available', label: 'Electricity Available', type: 'YES_NO', icon: '⚡' },
  { id: 'infra_drinking_water_available', label: 'Drinking Water Available', type: 'YES_NO', icon: '💧' },
  { id: 'infra_separate_toilets', label: 'Separate Toilets (Boys/Girls)', type: 'YES_NO', icon: '🚻' },
  { id: 'infra_toilets_functional', label: 'Toilets Functional', type: 'YES_NO', icon: '🚽' },
  { id: 'infra_roof_leakage', label: 'No Roof Leakage / Seepage', type: 'YES_NO', icon: '🌧️', invertYesNo: true },
  { id: 'infra_handwashing', label: 'Handwashing Facility', type: 'YES_NO', icon: '🧼' },
  { id: 'infra_ramp_available', label: 'Ramp Available (Accessibility)', type: 'YES_NO', icon: '♿' },
  { id: 'infra_playground_available', label: 'Playground Available', type: 'YES_NO', icon: '🏃' },
  { id: 'infra_library_available', label: 'Library Available', type: 'YES_NO', icon: '📚' },
  { id: 'infra_science_lab_available', label: 'Science Laboratory Available', type: 'YES_NO', icon: '🔬' },
  { id: 'infra_sports_equipment_available', label: 'Sports Equipment Available', type: 'YES_NO', icon: '⚽' },
  { id: 'furniture_adequate_new', label: 'Adequate Furniture Available', type: 'YES_NO', icon: '🪑' },
  { id: 'safety_first_aid_box', label: 'First Aid Box Available', type: 'YES_NO', icon: '🩹' },
  { id: 'safety_fire_extinguisher', label: 'Fire Extinguisher Available', type: 'YES_NO', icon: '🧯' },
  { id: 'infra_fans_working', label: 'Fans Working', type: 'RATIO_PERCENT', icon: '🌀' },
  { id: 'infra_lights_working', label: 'Lights Working', type: 'RATIO_PERCENT', icon: '💡' },
  { id: 'infra_boundary_wall', label: 'Boundary Wall Condition', type: 'CHOICE', icon: '🧱', order: ['Good', 'Average', 'Poor', 'Absent'] },
  { id: 'infra_building_condition', label: 'Building Condition', type: 'CHOICE', icon: '🏫', order: ['Excellent', 'Good', 'Fair', 'Poor'] },
  { id: 'infra_roof_condition', label: 'Roof Condition', type: 'CHOICE', icon: '🏠', order: ['Excellent', 'Good', 'Fair', 'Poor'] },
  { id: 'infra_ceiling_condition', label: 'Ceiling Condition', type: 'CHOICE', icon: '⬜', order: ['Good', 'Fair', 'Poor', 'Not Applicable'] }
];

function schoolRef(r) {
  return { schoolId: r.school_id, schoolName: r.school_name, block: r.block, district: r.district };
}

function computeDeliverable(def, currentRows) {
  if (def.type === 'YES_NO') {
    const yesSchools = [];
    const noSchools = [];
    currentRows.forEach((r) => {
      const answers = parseAnswers(r.answers_json);
      const val = answers[def.id] && answers[def.id].value;
      if (val === 'Yes') yesSchools.push(schoolRef(r));
      else if (val === 'No') noSchools.push(schoolRef(r));
    });
    // Most of these are "Yes = has the facility = good". Roof leakage is
    // the opposite ("Yes = has a leak = bad"), so invertYesNo flips which
    // answer counts as the good one, for both the percentage and which
    // list is "with" (good state) vs "without" (the problem to flag).
    const schoolsWith = def.invertYesNo ? noSchools : yesSchools;
    const schoolsWithout = def.invertYesNo ? yesSchools : noSchools;
    const answered = schoolsWith.length + schoolsWithout.length;
    return {
      id: def.id, label: def.label, icon: def.icon, type: def.type,
      answered, goodPercent: answered > 0 ? Math.round((schoolsWith.length / answered) * 100) : null,
      schoolsWith, schoolsWithout
    };
  }

  if (def.type === 'RATIO_PERCENT') {
    let totalInstalled = 0;
    let totalWorking = 0;
    const schoolPercents = [];
    currentRows.forEach((r) => {
      const answers = parseAnswers(r.answers_json);
      const ans = answers[def.id];
      if (!ans) return;
      const installed = parseInt(ans.value, 10) || 0;
      const working = parseInt(ans.value2, 10) || 0;
      if (installed > 0) {
        totalInstalled += installed;
        totalWorking += working;
        schoolPercents.push({ ...schoolRef(r), percent: Math.round((working / installed) * 100), installed, working });
      }
    });
    schoolPercents.sort((a, b) => a.percent - b.percent);
    return {
      id: def.id, label: def.label, icon: def.icon, type: def.type,
      answered: schoolPercents.length,
      goodPercent: totalInstalled > 0 ? Math.round((totalWorking / totalInstalled) * 100) : null,
      schoolsGood: schoolPercents.filter((s) => s.percent >= 80),
      schoolsNeedsAttention: schoolPercents.filter((s) => s.percent < 80)
    };
  }

  // CHOICE
  const byRating = {};
  def.order.forEach((o) => { byRating[o] = []; });
  let answered = 0;
  currentRows.forEach((r) => {
    const answers = parseAnswers(r.answers_json);
    const val = answers[def.id] && answers[def.id].value;
    if (val && byRating[val]) {
      byRating[val].push(schoolRef(r));
      answered++;
    }
  });
  const goodCount = (byRating[def.order[0]] || []).length + (byRating[def.order[1]] || []).length;
  return {
    id: def.id, label: def.label, icon: def.icon, type: def.type,
    answered, goodPercent: answered > 0 ? Math.round((goodCount / answered) * 100) : null,
    order: def.order, schoolsByRating: byRating
  };
}

// GET /api/reports/quick-deliverables?block=X (optional — for a single
// Block/Nagar Panchayat/Municipality's printable report)
router.get('/quick-deliverables', requireAuth('admin'), async (req, res) => {
  try {
    const allRows = await getScopedInspections(req);
    const allCurrentRows = currentYearLatestPerSchool(allRows);
    const { block } = req.query;
    const currentRows = block ? allCurrentRows.filter((r) => r.block === block) : allCurrentRows;

    const deliverables = QUICK_DELIVERABLES.map((def) => computeDeliverable(def, currentRows));
    const blocksAvailable = [...new Set(allCurrentRows.map((r) => r.block).filter(Boolean))].sort();

    res.json({
      year: new Date().getFullYear(),
      block: block || null,
      totalSchools: currentRows.length,
      blocksAvailable,
      deliverables
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating quick deliverables report', detail: err.message });
  }
});

// ====================================================================
// OFFICER ACTIVITY — how actively subordinate officers are inspecting
// ====================================================================
// Same visibility rule as everywhere else: an admin sees activity for
// every officer within their own jurisdiction, regardless of who
// created that officer's account.

// GET /api/reports/officer-activity — overview, every officer in your
// jurisdiction with quick stats, sorted busiest-first.
router.get('/officer-activity', requireAuth('admin'), async (req, res) => {
  try {
    const officersResult = await pool.query(
      'SELECT id, officer_id, name, designation, district, subdivision, block, status FROM officers'
    );
    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    const officers = officersResult.rows.filter((o) => isWithinJurisdiction(adminCtx, o));

    const officerIds = officers.map((o) => o.id);
    const inspectionsResult = officerIds.length > 0
      ? await pool.query('SELECT officer_id, school_name, uploaded_at FROM inspections WHERE officer_id = ANY($1::int[])', [officerIds])
      : { rows: [] };
    const assignmentsResult = officerIds.length > 0
      ? await pool.query('SELECT officer_id, school_name, due_date, status, completed_at FROM assignments a JOIN schools s ON a.school_id = s.id WHERE officer_id = ANY($1::int[])', [officerIds])
      : { rows: [] };

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const stats = officers.map((o) => {
      const theirs = inspectionsResult.rows.filter((i) => i.officer_id === o.id);
      const thisMonthCount = theirs.filter((i) => {
        const d = new Date(i.uploaded_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length;
      const thisYearCount = theirs.filter((i) => new Date(i.uploaded_at).getFullYear() === thisYear).length;
      const distinctSchools = new Set(theirs.map((i) => i.school_name)).size;
      const dates = theirs.map((i) => new Date(i.uploaded_at)).sort((a, b) => a - b);
      const lastVisit = dates.length > 0 ? dates[dates.length - 1] : null;
      const firstVisit = dates.length > 0 ? dates[0] : null;

      let avgPerMonth = null;
      if (firstVisit && theirs.length > 0) {
        const monthsSpan = Math.max(1, (now.getFullYear() - firstVisit.getFullYear()) * 12 + (now.getMonth() - firstVisit.getMonth()) + 1);
        avgPerMonth = Math.round((theirs.length / monthsSpan) * 10) / 10;
      }

      // Assignment compliance — of the schools actually ASSIGNED to this
      // officer (as opposed to schools they inspected on their own
      // initiative), how many were actually visited, and how many of
      // those were visited on or before the due date.
      const theirAssignments = assignmentsResult.rows.filter((a) => a.officer_id === o.id);
      const assignedTotal = theirAssignments.length;
      const visited = theirAssignments.filter((a) => a.status === 'completed');
      const visitedCount = visited.length;
      const visitedPercent = assignedTotal > 0 ? Math.round((visitedCount / assignedTotal) * 100) : null;
      const onTimeCount = visited.filter((a) => !a.due_date || !a.completed_at || new Date(a.completed_at) <= new Date(a.due_date)).length;
      const lateCount = visitedCount - onTimeCount;
      const stillPendingCount = assignedTotal - visitedCount;

      return {
        officerId: o.id, officerCode: o.officer_id, name: o.name, designation: o.designation,
        district: o.district, block: o.block, status: o.status,
        totalInspections: theirs.length, thisMonth: thisMonthCount, thisYear: thisYearCount,
        avgPerMonth, distinctSchools, lastVisit,
        assignedTotal, visitedCount, visitedPercent, onTimeCount, lateCount, stillPendingCount
      };
    }).sort((a, b) => b.totalInspections - a.totalInspections);

    res.json({ officers: stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating officer activity report', detail: err.message });
  }
});

// GET /api/reports/officer-activity/:officerId — one officer's full
// breakdown: monthly and yearly counts, plus every inspection with its
// school and date.
router.get('/officer-activity/:officerId', requireAuth('admin'), async (req, res) => {
  try {
    const officerResult = await pool.query('SELECT * FROM officers WHERE id = $1', [req.params.officerId]);
    if (officerResult.rows.length === 0) return res.status(404).json({ error: 'Officer not found' });
    const officer = officerResult.rows[0];

    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(adminCtx, officer)) {
      return res.status(403).json({ error: 'This officer is outside your jurisdiction.' });
    }

    const inspectionsResult = await pool.query(
      'SELECT id, school_id, school_name, district, block, uploaded_at, overall_grade FROM inspections WHERE officer_id = $1 ORDER BY uploaded_at DESC',
      [req.params.officerId]
    );
    const inspections = inspectionsResult.rows;

    const monthlyMap = {};
    inspections.forEach((i) => {
      const key = monthKey(i.uploaded_at);
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    });
    const monthly = Object.keys(monthlyMap).sort().map((k) => ({ month: k, count: monthlyMap[k] }));

    const yearlyMap = {};
    inspections.forEach((i) => {
      const y = new Date(i.uploaded_at).getFullYear();
      yearlyMap[y] = (yearlyMap[y] || 0) + 1;
    });
    const yearly = Object.keys(yearlyMap).sort().map((y) => ({ year: parseInt(y, 10), count: yearlyMap[y] }));

    const distinctSchools = [...new Set(inspections.map((i) => i.school_name))];

    res.json({
      officerName: officer.name, officerCode: officer.officer_id, designation: officer.designation,
      district: officer.district, block: officer.block, status: officer.status,
      totalInspections: inspections.length,
      distinctSchoolsCount: distinctSchools.length,
      monthly, yearly,
      inspections: inspections.map((i) => ({ inspectionId: i.id, schoolName: i.school_name, block: i.block, date: i.uploaded_at, grade: i.overall_grade }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating officer activity detail', detail: err.message });
  }
});

module.exports = router;
