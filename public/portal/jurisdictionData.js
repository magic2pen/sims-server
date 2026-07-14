// public/portal/jurisdictionData.js
// Fixed reference lists for District/Subdivision/Block, used everywhere
// these are entered (Officers, Admins, My Profile, Schools). This is
// what stops "Jirania" / "Jirania Sub-Division" / "Jirania Sub Division"
// from being treated as three different places — jurisdiction matching
// throughout the system is exact-string, so consistent spelling here is
// what makes visibility/editing/reports actually work correctly.
//
// "Block" here also covers Urban Local Bodies (Nagar Panchayat,
// Municipal Council, Municipal Corporation) — West Tripura's rural
// Blocks and urban bodies share the same jurisdiction tier, so they
// sit in one combined list, one per Subdivision.
//
// To expand beyond West Tripura later, or add more Subdivisions/
// Blocks, this is the only file that needs updating.

const DISTRICTS = ['West Tripura'];

const SUBDIVISIONS = ['Jirania', 'Mohanpur', 'Sadar'];

// Each Subdivision's Blocks/Nagar Panchayats/Municipalities.
const SUBDIVISION_BLOCKS = {
  Jirania: ['Belbari', 'Jirania', 'Mandwai', 'Old Agartala', 'Jirania Nagar Panchayat', 'Ranirbazar Municipal Council'],
  Mohanpur: ['Bamutia', 'Hezamara', 'Lefunga', 'Mohanpur', 'Mohanpur Municipal Council'],
  Sadar: ['Dukli', 'Agartala Municipal Corporation']
};

// Every Block/Nagar Panchayat/Municipality combined — used when no
// Subdivision has been picked yet (or isn't applicable at this level).
const ALL_BLOCKS = Object.values(SUBDIVISION_BLOCKS).flat();

// Fills a <select> with the given options. `selected` (if provided)
// gets pre-selected — used when pre-filling an Edit form. `placeholder`
// is an empty first option, for fields that aren't always required.
function populateSelect(selectEl, options, selected, placeholder) {
  const placeholderHtml = placeholder ? `<option value="">${placeholder}</option>` : '';
  selectEl.innerHTML = placeholderHtml + options.map((o) =>
    `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`
  ).join('');
}

// Populates the Block/Nagar Panchayat/Municipality dropdown, scoped to
// whichever Subdivision is currently selected — or the full combined
// list if no Subdivision has been chosen.
function populateBlockSelect(blockSelectEl, subdivision, selected, placeholder) {
  const options = (subdivision && SUBDIVISION_BLOCKS[subdivision]) ? SUBDIVISION_BLOCKS[subdivision] : ALL_BLOCKS;
  populateSelect(blockSelectEl, options, selected, placeholder);
}
