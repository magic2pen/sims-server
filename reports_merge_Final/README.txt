SIMS -- Merge Attendance/Academic Reports Into the Reports Page
========================================================================

6 files. No backend/database changes -- this is purely a Portal
reorganization, using the same endpoints from before.

  public/portal/reports.html      -> REPLACE
  public/portal/dashboard.html    -> REPLACE (removes old nav link)
  public/portal/inspection.html   -> REPLACE (removes old nav link)
  public/portal/admins.html       -> REPLACE (removes old nav link)
  public/portal/officers.html     -> REPLACE (removes old nav link)
  public/portal/assignments.html  -> REPLACE (removes old nav link)

Commit all 6, let Render redeploy.

OPTIONAL CLEANUP: you can delete public/portal/attendance-reports.html
from GitHub now -- nothing links to it anymore, so it's just unused.
Not required, just tidy.


WHAT CHANGED
----------------
The separate "Attendance & Academics" sidebar page is gone. Everything
now lives on the single "Reports" page, as three new sections below
the existing four:

  - Teacher Attendance
  - Student Attendance
  - Academic Performance

Each one shows its Block-by-Block overview (chart + list) right there
on the page -- no extra click needed to see it. Clicking a specific
block expands THAT SAME section in place to show the full detail
(stats, trend chart, ranked schools) -- exactly the same detail view
as before, just embedded inline instead of on a separate page. A
"Back to all blocks" link collapses it back to the overview.

Note: the District/Block filters at the very top of the page still
only affect the original 4 summary cards (Total Inspections, Grade
Distribution, etc.) -- the three new sections have their own
independent block-drill-down and aren't tied to those filters. This
keeps the two interactions from getting confusing with each other.


TEST THIS
-------------
1. Open Reports -- confirm you see 7 things total now, top to bottom:
   Total Inspections, Grade Distribution, Key Facility Indicators,
   Inspections Over Time, then Teacher Attendance, Student Attendance,
   Academic Performance
2. Click a block under Teacher Attendance -- it should expand in place
   (not navigate anywhere) -- confirm "Back to all blocks" collapses
   it again
3. Confirm the sidebar no longer shows a separate "Attendance &
   Academics" link


IF SOMETHING GOES RED
------------------------
Send me a screenshot.
