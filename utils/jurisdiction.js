// utils/jurisdiction.js
// Central place for the two rules that make the whole admin hierarchy work:
//   1. An admin can only create/manage people MORE JUNIOR than themselves (higher rank number).
//   2. An admin can only create/manage people WITHIN their own jurisdiction.
//
// Admin designations are a small, fixed set of real government posts — so
// unlike officer designations (which stay free text, per your requirement),
// these are validated against a whitelist so rank can't be tampered with.

const ADMIN_DESIGNATIONS = {
  'DM (District Magistrate & Collector)': { level: 'district', rank: 1 },
  'ADM (Additional District Magistrate)': { level: 'district', rank: 2 },
  'DEO (District Education Officer)': { level: 'district', rank: 2 },
  'SDM (Sub-Divisional Magistrate)': { level: 'subdivision', rank: 3 },
  'Addl. SDM': { level: 'subdivision', rank: 3 },
  'BDO (Block Development Officer)': { level: 'block', rank: 4 }
};

// admin = { admin_level, district, subdivision, block }
// target = { district, subdivision, block }
function isWithinJurisdiction(admin, target) {
  if (!admin || !admin.admin_level) return false;
  if (admin.admin_level === 'district') {
    return !!target.district && target.district === admin.district;
  }
  if (admin.admin_level === 'subdivision') {
    return !!target.district && target.district === admin.district &&
      !!target.subdivision && target.subdivision === admin.subdivision;
  }
  if (admin.admin_level === 'block') {
    // Block names are treated as unique within a district for this system —
    // subdivision isn't required to be filled in consistently everywhere yet.
    return !!target.district && target.district === admin.district &&
      !!target.block && target.block === admin.block;
  }
  return false;
}

module.exports = { ADMIN_DESIGNATIONS, isWithinJurisdiction };
