# SEEDS Academics Hub

A school academics workspace for attendance, subject/class assignments, assessments, marks, and reports.

The app branding uses the supplied SEEDS logo in `assets/seeds-logo.png`, the school building photo in `assets/seeds-building.png`, and the school name **SEEDS School of Excellence**. Both images are bundled with the app so they remain available offline. On live sign-in, a school administrator or developer also updates the active school's stored name; the SQL setup renames existing `SEEDS Academy` records.

## Database connection status

The fictional demo records and sample-preview sign-in have been removed. Until Supabase is configured, the app shows a setup notice and does not allow sign-in or entry of school data. The included `config.js` contains empty placeholders, so this copy is not yet connected to a real database.

## Add a picture or logo

1. Configure and deploy the Supabase project before using the app. The app does not provide an offline/sample-data mode.
2. For a student picture, open **Students**, click **Add student** (or **Edit** beside a student), choose an image under **Student picture**, then click **Save record**.
3. For a teacher picture, open **Teachers**, click **Add teacher** (or **Edit**), choose an image under **Teacher picture**, then click **Save record**.
4. For the school logo, open **School settings**, choose an image under **School logo**, and click **Save school settings**.
5. Use JPG, PNG, or WEBP images up to 5 MB. The preview appears before you save.

Images are stored in Supabase Storage when the app is connected. Do not upload real school photos until setup and role-based access have been verified.

## Secure Supabase setup

This static app is designed to use Supabase Auth and Postgres with row-level security. Before using real records:

1. The Supabase project has been created and the initial `supabase-schema.sql` has been applied. The initial `SEEDS School of Excellence` record is also present.
2. Create the first trusted developer account in Supabase Authentication.
3. Copy that user's Auth UUID and run this once in the Supabase SQL Editor to link the developer account to the school:
   ```sql
   select id, name from public.schools;

   insert into public.profiles (id, school_id, role, display_name)
   values ('AUTH-USER-UUID'::uuid, 'SCHOOL-UUID'::uuid, 'developer', 'Platform Developer');
   ```
   Replace both placeholders with the Auth user ID and school ID returned by the query. Developer profiles must be provisioned manually; the app does not let users grant themselves developer access.
4. `config.js` contains this project's Project URL and **publishable** key. This key is intended for browser use; never use or publish a `service_role` or secret key in the app or GitHub.
5. Install the Supabase CLI. From this folder, run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase functions deploy manage-account`. The function uses the Supabase server-side service key from the function environment; never copy that key into `config.js`, the browser, or GitHub.
6. Sign in as Developer and create individual teacher and parent accounts from **User accounts**. Choose a teacher profile or link the parent's students, and give each person their temporary password privately. The developer can issue individual password resets there.
7. Create student and administrator sign-ins in Supabase Auth and link their profile rows to their school and student records.
8. Host the app over HTTPS. Verify policies with separate developer, admin, teacher, student, and parent accounts before entering real data.

Never put real student data in source files, Git commits, or public issue trackers. The published `config.js` may contain only the Supabase Project URL and anon/public key; database security must come from the schema's row-level security and Auth policies.

## GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` deploys the static app to GitHub Pages on every push to `main`, or when manually started from the repository's **Actions** tab. It publishes only the app HTML, CSS, JavaScript, public config, and bundled images; it does not publish the SQL schema, README, or Supabase Edge Function source.

To publish from a new GitHub repository:

1. Create an empty repository on GitHub. Do not add a README or license during creation. If the repository already contains an app, back it up before replacing its deployed branch.
2. From this project folder, initialize and push the project:
   ```powershell
   git init -b main
   git add .
   git commit -m "Prepare SEEDS Academics Hub for deployment"
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source. Confirm Actions are allowed to create Pages deployments in **Settings → Actions → General**.
4. Check the **Actions** tab for a successful deployment and open the site URL shown in the `github-pages` environment. The app can only sign in after Supabase has the schema and a developer Auth account linked to a `developer` profile.

If **Configure GitHub Pages** fails with “Pages site Not Found,” return to **Settings → Pages**, select **GitHub Actions** as the source, save it, then push a new commit to `main` to start deployment again.

GitHub Pages hosts the website only. It does not create a Supabase project, run SQL, create user accounts, or configure database access. Run the Supabase setup above first; after verification, commit only the Project URL and anon/public key in `config.js`. Never commit account passwords or service-role keys.

The schema uses row-level security. Developer accounts can manage all schools; keep this role limited to trusted individuals. The sign-in role choice is only a convenience: the authenticated Supabase profile determines permissions. The account function permits only a verified developer to create, reset, or remove teacher and parent logins.

Student photos, teacher photos, and school logos are stored in a private Supabase Storage bucket with school-scoped access. The SQL setup creates this bucket and its policies. Only JPG, PNG, or WEBP images up to 5 MB are accepted. Keep the repository free of real names, marks, credentials, and private school information. A public GitHub Pages deployment hosts only the app files; student data belongs in the secured Supabase project.

## Included workflows

- Role-aware sign-in and dashboards
- Dashboard class-strength summary (Active students only), class search/filter, class-level boys/girls totals, and printable PDF export
- Separate daily and monthly attendance registers for each class/subject assignment; the assigned subject teacher can record only their subject
- Responsive phone layouts with touch-sized controls and swipeable navigation
- Developer access across schools, plus protected individual teacher/parent account management
- Private student and teacher photo uploads, and school logo settings
- Student and teacher directory; teacher profiles show assigned subjects and classes from the teaching-assignment records
- Classes, subjects, and teacher assignments
- Class and subject-specific daily attendance with Present, Absent, Leave, and Holiday statuses, batch marking, and date-range entry (up to 366 days per save)
- Monthly printable attendance sheet with a selectable class/month, daily totals, P/A/L/H totals, and signature spaces
- Subject-specific term gradebooks with separate monthly-test and term-exam columns, configurable subject enrollment, whole-class view, live totals/percentages/grades, editable marks, and teacher-restricted access
- Search and exportable reports

Attendance range mode applies each student's selected status to every date in the range. Class attendance remains in the existing class register; subject attendance is stored separately for each class/subject assignment, student, and date. Existing attendance records stay in the class register and are not copied into subject registers. The assigned subject teacher can edit that subject's records, while administrators and developers can manage all subject registers. The SQL setup migrates existing `late` records to `leave`; if the schema is already installed, use `subject-attendance-migration.sql` for the new subject registers.

To set up A Level attendance, add the A Level class, create English, Urdu, Maths, Physics, Chemistry, Biology, Sociology, Computer, Psychology, Economics, B.Studies, Commerce, and Law, then assign each subject to its correct teacher under **Classes & subjects → Teaching assignments**. Subject registers are opened from the **Attendance** page's Subject register selector, not from the dashboard. A teacher can select only their assigned subject registers; each register has its own daily records and monthly sheet.

The dashboard class-strength summary uses only student records whose status is `Active`. Male and Female are reported as boys and girls; students with another or missing gender remain included in total strength. Average class size is calculated from assigned active students divided by classes that have an active roster.

The monthly sheet shows weekends as `S` when there is no saved attendance record. `W` is the total of saved Present, Leave, and Absent entries; `H` counts saved Holiday entries. Use **Print Transcript** to print or save the sheet as a PDF. Teacher names are drawn from the class's current subject-teacher assignments; the schema does not have a separate class-teacher field.

In **Assessments & marks**, choose a class, subject, and term to open that subject's gradebook. First-term monthly tests are September, October, and November; second-term tests are February, March, and April. Each monthly test is fixed at 20 marks. After all three monthly assessments are set up, **Marks in 60** scales the marks from tests the student attended to 60 (for example, two attended tests totaling 36/40 become 54/60; one attended test at 18/20 becomes 54/60). A blank monthly mark or `A`/`Absent` is treated as absence. The final percentage is the average of the monthly-test percentage (converted marks ÷ 60) and the term-exam percentage (exam marks ÷ exam maximum); no final percentage appears until an exam mark is entered. Grade bands: A* ≥ 90%, A ≥ 80%, B ≥ 70%, C ≥ 60%, D ≥ 50%, E ≥ 40%, U < 40%. Administrators/developers and the assigned subject teacher can set the enrolled roster, create/edit/remove assessments, and enter scores. **View entire class** shows unenrolled students as view-only. On phones, swipe horizontally within the marks table.
