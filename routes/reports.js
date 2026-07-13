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

module.exports = router;
