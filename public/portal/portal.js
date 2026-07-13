// SIMS Web Portal — shared utilities across pages.
// Supports two kinds of logins: "officer" (view-only, same accounts as
// the mobile app) and "admin" (hierarchy management + everything an
// officer can see). Both use the same token/header mechanism server-side.

const API_BASE = ''; // same-origin, since the Portal is served by this same server

function getToken() {
  return localStorage.getItem('sims_token');
}

function getRole() {
  return localStorage.getItem('sims_role'); // 'admin' or 'officer'
}

function getProfile() {
  const raw = localStorage.getItem('sims_profile');
  return raw ? JSON.parse(raw) : null;
}

function isAdmin() {
  return getRole() === 'admin';
}

function requireLogin() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

// Use on pages that only admins should see (Admins, Officers management).
function requireAdmin() {
  requireLogin();
  if (!isAdmin()) {
    window.location.href = 'dashboard.html';
  }
}

function logout() {
  localStorage.removeItem('sims_token');
  localStorage.removeItem('sims_role');
  localStorage.removeItem('sims_profile');
  window.location.href = 'login.html';
}

// Reads a fetch response as text first (never throws, unlike res.json()
// on a non-JSON body), then tries to parse it as JSON. If that fails, or
// the server didn't send an "error" field, the raw response text (and
// HTTP status) is used instead — so failures are always diagnosable
// instead of showing a generic "Request failed".
async function readResponse(res) {
  const rawText = await res.text();
  let body = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    // Not JSON — probably a crash page, timeout, or proxy error page.
  }
  if (!res.ok) {
    const detail = body.error || (rawText ? rawText.slice(0, 300) : `HTTP ${res.status} ${res.statusText}`);
    throw new Error(`${detail} (status ${res.status})`);
  }
  return body;
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return readResponse(res);
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body)
  });
  return readResponse(res);
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body)
  });
  return readResponse(res);
}

function gradeClass(grade) {
  if (!grade) return 'grade-none';
  return 'grade-' + grade.replace('+', 'p');
}

function formatDate(isoOrText) {
  if (!isoOrText) return '';
  const d = new Date(isoOrText);
  if (isNaN(d.getTime())) return isoOrText;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Fills in the sidebar's name/role footer and wires the logout button.
// Also reveals any nav links marked class="admin-only-nav" when the
// logged-in user is an admin.
function renderSidebarFooter() {
  const profile = getProfile();
  const role = getRole();
  const nameEl = document.getElementById('sidebarOfficerName');
  const roleEl = document.getElementById('sidebarOfficerRole');
  if (profile && nameEl) nameEl.textContent = profile.name || '';
  if (profile && roleEl) roleEl.textContent = profile.designation || (role === 'admin' ? 'Admin' : 'Officer');

  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  if (role === 'admin') {
    document.querySelectorAll('.admin-only-nav').forEach((el) => { el.style.display = ''; });
  }
}
