SIMS CENTRAL SERVER — Deployment Guide (Phase A, first slice)
====================================================================

This is the very first piece of the server: it lets an admin log in,
create officer accounts (no self-registration, exactly as planned),
and lets officers log in. Nothing about schools or inspections yet —
that comes in the next steps once this foundation is confirmed working.

You do NOT need to install anything on your computer for this. Every
step below happens in a web browser, using free accounts — same spirit
as everything else we've built so far.


PART 1 — Put the code on GitHub (no command line needed)
================================================================

GitHub is just where the code "lives" so Render can find it and deploy
it. Think of it like Google Drive, but for code.

1. Go to github.com and click "Sign up" — create a free account.

2. Once logged in, click the "+" icon (top right) → "New repository".
   - Repository name: sims-server
   - Keep it "Public" (simpler for now — we can make it private later)
   - Do NOT check "Add a README" (we already have files to upload)
   - Click "Create repository"

3. On the next page, look for a link that says "uploading an existing
   file" (it's a blue link in the instructions GitHub shows you).
   Click it.

4. Drag and drop ALL the files and folders from this ZIP directly into
   that upload box (keep the folder structure — routes/, middleware/,
   sql/, public/ should all come along as folders). Scroll down and
   click "Commit changes".

Your code is now on GitHub. You'll come back here later if you ever
need to update it.


PART 2 — Create your database on Render
================================================================

1. Go to render.com and sign up (you can sign up directly with your
   GitHub account — easiest option).

2. From the Render dashboard, click "New +" → "PostgreSQL".
   - Name: sims-database
   - Region: pick whichever is closest/default
   - Instance Type: Free
   - Click "Create Database"

3. Wait about a minute for it to finish setting up. Once it's ready,
   scroll down on that database's page and find "Internal Database
   URL" — click the copy icon next to it. Keep this copied value handy,
   you'll need it in Part 3, Step 4.


PART 3 — Deploy the server itself
================================================================

1. From the Render dashboard, click "New +" → "Web Service".

2. Choose "Build and deploy from a Git repository" → connect your
   GitHub account if asked → select the "sims-server" repository you
   created in Part 1.

3. Fill in:
   - Name: sims-server  (this becomes part of your web address)
   - Region: same as your database
   - Branch: main
   - Runtime: Node
   - Build Command: npm install
   - Start Command: npm start
   - Instance Type: Free

4. Scroll down to "Environment Variables" and add these three:
   - DATABASE_URL  →  paste the Internal Database URL you copied in
     Part 2, Step 3
   - JWT_SECRET  →  type any long random string, e.g. mash your
     keyboard for 30+ characters — this is what secures login tokens
   - PORT  →  10000

5. Click "Create Web Service". Render will now build and start your
   server — this takes a few minutes the first time. Watch the log
   on screen; when you see "SIMS server running on port 10000", it's
   live.

6. Your server's address will be shown at the top of the page, looking
   like: https://sims-server-xxxx.onrender.com
   Save this URL — you'll need it for the app later, and to open the
   test page.


PART 4 — Set up the database tables
================================================================

The database exists but is empty — it needs the tables created.

1. Go back to your database page on Render (Part 2). Find the "Connect"
   button → it will show a few options; look for "PSQL Command" — copy
   that whole command.

2. On Render, open the "Shell" tab on your WEB SERVICE (not the
   database) — this gives you a command box running on your actual
   server, in the browser, no installation needed.

3. Paste the PSQL command you copied in Step 1 and press Enter — this
   connects you to your database.

4. You'll now see a prompt like "sims=>". At this prompt, you need to
   run the contents of the file sql/schema.sql from this ZIP. Open that
   file, copy its entire contents, paste it into the shell, and press
   Enter. You should see "CREATE TABLE" printed a few times.

5. Type \q and press Enter to exit.


PART 5 — Create your first admin account
================================================================

Still in that same Shell tab (on the web service, not the database):

1. Type this, replacing the name/email/password with your own real
   ones, then press Enter:

   node sql/seedAdmin.js "Your Name" "your@email.com" "ChooseAPassword123"

2. You should see "Admin account created" with your details. This is
   the ONLY account that gets created outside the normal flow — from
   here on, this admin account creates every officer account.


PART 6 — Test everything
================================================================

1. Open this address in your browser (replace with your actual Render
   URL from Part 3, Step 6):

   https://sims-server-xxxx.onrender.com/test.html

2. You'll see a simple test page:
   - Box 1: click "Check Server Status" — should show "status: ok"
   - Box 2: log in with the admin email/password you just created
   - Box 3: create an officer account (try your own name as a test)
   - Box 4: log in as that officer using the username/password you
     just set
   - Box 5: refresh the list — you should see the officer you created

If all five boxes work, the foundation is solid and we can move to the
next piece: connecting the actual Android app to this server, and
starting the Web Portal for DM/DEO/Director logins.


A NOTE ON THE FREE TIER
================================================================
Render's free web service "sleeps" after 15 minutes of no traffic and
takes ~30-50 seconds to wake up on the next request — completely fine
for testing and demoing, not something to worry about yet. This gets
addressed properly when this moves to a production server later.
