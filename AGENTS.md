# Prime Atlas: project notes for AI coding tools

Read this file first, before changing anything.

The owner is the business manager and a beginner developer. Explain changes in plain language, work in small steps, and say exactly which files you changed.

## What this is

Prime Atlas is an ERP for a UK property sourcing business.

1. Clients send a **brief** (what they want to buy: budget, bedrooms, suburbs, yield, and so on).
2. The **manager** (the owner) approves the brief and assigns it to an **employee**.
3. The employee creates **clusters** (groups of suburbs with market data) and sources **properties** for the brief.
4. The manager **approves** properties. Only approved properties reach the client.
5. The client logs in to a **portal**, reviews approved properties, chats, and marks each as interested, rejected or confirmed.

Money is in pounds (£).

## Stack and hosting

- Frontend: React (Create React App, react-scripts 5), Tailwind utility classes, lucide-react. Folder `Frontend`.
- Backend: Node.js + Express, deployed as a Vercel serverless function. Folder `Backend`.
- Database and files: Supabase (Postgres, plus a private Storage bucket called `property-media`).
- GitHub repo: primeatlas-dev/prime-atlas, branch `main`. Pushing to `main` automatically deploys both Vercel projects.
- Frontend Vercel project (root directory `Frontend`): https://prime-atlas-six.vercel.app
- Backend Vercel project (root directory `Backend`): https://prime-atlas-api.vercel.app
- Folder names are capitalised and Vercel is case-sensitive. File names must match their imports exactly (for example `./Clients`, `./BriefPage`). On Windows, watch for doubled extensions such as `.js.js`.

## Environment variables (set in Vercel, never committed)

- Backend: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `FRONTEND_URL`
- Frontend: `REACT_APP_API_URL` (must end with `/api`), `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_KEY` (the publishable key only), `CI=false`

`.env` files are gitignored. Never print, log, paste or commit secret values. The Supabase secret key and `JWT_SECRET` must exist only on the backend. Local development has not been set up with secrets; changes have been tested on the deployed site.

## Backend layout (`Backend/`)

- `api/index.js`: the Express app. It **exports** the app and never calls `listen()`. `vercel.json` rewrites every request to it. `index.js` in the Backend root is only for running locally.
- `lib/`: `supabase.js` (service client), `media.js` (signed URLs and cover photos), `chat.js`, `clusterScore.js` (automatic cluster ranking).
- `middleware/auth.js`: `requireAuth` (checks the JWT and re-reads the user from the database on every request, so deactivated users are locked out at once), `requireManager`, `requireStaff`, `requireClient`.
- `routes/`: `auth.js` (login only), `team.js`, `clientLogins.js`, `clients.js`, `briefs.js`, `propertyPage.js`, `clusters.js`, `chat.js`, `portal.js`, `portalChat.js`, `data.js` (older routes).

Mount order in `api/index.js` matters:

1. `/api/auth` is public.
2. `/api/me` needs a login.
3. `/api/team`, `/api/deals` and `/api/dashboard` are manager only.
4. `/api/portal` is **client accounts only** (`requireClient`).
5. Everything else under `/api` is **staff only** (`requireAuth` then `requireStaff`). `propertyPage` is mounted before `briefs`, so its `PATCH /properties/:id` wins.

Routes use allow-lists of editable fields (a `pick()` helper) and check access on the server. Never rely on hiding things in the UI.

## Frontend layout (`Frontend/src/`)

- `App.jsx`: app shell, sidebar, header, login page, Team page, and older Dashboard, Properties and Deals pages.
- `Clients.jsx` (clients and briefs), `BriefPage.jsx` (brief with Properties, Clusters and Brief details tabs), `PropertyPage.jsx` (full property page and uploads), `ClustersTab.jsx`, `ClientLogin.jsx`, `ClientPortal.jsx`, `ChatPanel.jsx`, `ChatsPage.jsx`, `supabaseClient.js` (used only to upload files with a signed link from the backend).
- Each page file has a small `makeCall(token)` helper that adds the login token to fetch calls.
- An undefined variable (ESLint `no-undef`) fails the Vercel build.

## Database (Supabase)

Tables in use: `users` (role: manager, employee or client; `active`), `clients` (automatic `client_number`; `user_id` links a client to a login), `briefs` (including `commission_amount`, `fee_status`, `assigned_to`, `clusters_status`), `properties` (including `approval_status`, `client_decision`, `viewed_at`, `client_confirmed_at`, `seller_confirmed_at`), `property_media` (kind: cover, location or extra; at most one cover and one location per property), `clusters`, `cluster_suburbs`, `messages`, `chat_reads`.

Older tables that are no longer the main path: `buying_agents`, `deals`, `communications`, `property_photos`.

Row Level Security is enabled on every table with no policies, so all access goes through the backend using the secret key. Files are in a private bucket and are shown only through short-lived signed links.

## Rules that must never break

1. **Clients never see**: commission or fees, employee names, other clients, unapproved properties, clusters, or who created or approved a property.
2. **Employees never see**: a client's real name, email, phone or notes (only "Client N"), commission or fees, the Deals, Dashboard or Team pages. They only reach briefs assigned to them.
3. A property reaches a client **only** when `approval_status = 'approved'` and it sits in that client's own brief that is not pending approval. Un-approving removes it from the client immediately.
4. Chat exists only for approved properties. Clients see staff as "Prime Atlas Team". Employees see clients as "Client N". The manager sees real names. Sender ids are never sent to the browser.
5. Approved properties are locked for employees. Only the manager can change them.
6. Client accounts must never reach staff routes, and staff accounts must never reach `/api/portal`.
7. There is **no public sign-up**. The manager creates employee and client logins.
8. Commission is **per brief**, a fixed amount in pounds. The fee becomes due only after the client has confirmed a property **and** the manager has confirmed with the selling agent. `fee_status` moves from `not_due` to `due` to `paid`. This logic is not built yet.
9. Clusters: employees enter the suburb data and create clusters. The **priority order is calculated automatically** (`lib/clusterScore.js`) and is not chosen by hand. After "Generate & Save Priority" the clusters are locked for employees and only the manager can reopen them.
10. No call counters anywhere. The match score (planned) is for employees only and is never shown to clients. There is no completeness checklist.

## Working agreement

- Make the smallest change that does the job. Do not refactor unrelated code.
- Before editing auth, anonymity or permissions code, stop and explain the plan first.
- After each change, give the owner simple test steps for **each role** (manager, employee, client).
- Suggest a short commit message. The owner commits before each task so changes can be undone.
- Never weaken a check "to make something work". If a rule blocks a feature, ask.

## How to test

Use three kinds of login: manager, employee and client. Private windows in the same browser share storage, so test the client in a **different browser**. Press Ctrl + F5 after each deployment. Both Vercel projects must show Ready before testing.

## Known cleanup

- Older pages and routes (Properties, Deals, Dashboard in `App.jsx` and `routes/data.js`) still use the old data model.
- `routes/briefs.js` still contains an older `PATCH /properties/:id` that is shadowed by `routes/propertyPage.js`.

## Roadmap (not built yet)

- Clients submit their own briefs through a long form, with manager approval and version numbers. Fields: expected weekly rent, target gross yield, preferred states and suburbs, exclusions, minimum land size, bedrooms, bathrooms, car parking, maximum age, distance from power lines and cemeteries, other mandatory criteria, must-haves, must-avoids, properties already rejected, and properties liked but missed.
- An "All Properties" page with search, filters and "Assign to Brief".
- Dashboards (manager overview, employee "My Pending Work"), notifications, and an overdue-work alert.
- Match score (employee side only), fee tracker (manager only), activity history on properties, chat attachments, search polish and a phone layout.
- A security review, backups, and moving to paid hosting plans before real clients use it. Vercel's free plan is meant for non-commercial use, and Supabase's free plan has no backups. UK GDPR basics (privacy notice) also need attention.

## Pending briefs (added rules)

- A brief a client submits starts as `pending_approval`, with no employee assigned and no commission.
- Employees never see a pending brief, anywhere. `Backend/middleware/pendingGuard.js` enforces this for every staff route that names a brief, property, cluster or media file.
- A client sees only their own pending brief, showing just the requirements they entered. It never returns properties.
- A pending brief can only change through the manager's Approve (becomes active) or Decline (becomes closed). It cannot be assigned until it is approved, and an active brief never goes back to pending.
- Client submissions accept only an allow-list of fields, and never `status`, `client_id`, `assigned_to`, commission, fee or approval fields.

## Update: dashboards, All Properties and the shared pool

- Old routes are **gone**. `Backend/routes/data.js` is no longer mounted, so `/api/properties`, `/api/deals`, `/api/dashboard` and `/api/buying-agents` do not exist. They used to let any employee list properties from other employees' briefs. Do not bring them back.
- New staff routes: `overview.js` (`/overview`, `/notifications`) and `allProperties.js` (`/all-properties`, `/assignable-briefs`, `/pool-properties`, `/properties/:id/assign`). `Frontend/src/api.js` holds the shared `makeCall` helper.
- **The pool** is properties with `brief_id = null`. All staff can see and edit them. They have no client, no chat and no portal access, and **cannot be approved**.
- Assigning a pool property to a brief always resets it to `review` and clears every client field. The manager approves it for that client. An employee can only assign to their own active briefs. The manager can assign to any active brief.
- Employees only ever see "Client N" on the dashboard, in All Properties and in notifications.
- Dashboards read up to about 1000 rows per query. When the data grows, move the counts into SQL views.
- Not built yet: match score (employee side only), fee tracker (manager only), activity history, chat attachments, phone layout.

## Update: match score, fee tracker, history and phone layout

- **Match score** (`Backend/lib/matchScore.js`) is STAFF ONLY. It is added in `routes/briefs.js` (card summary) and `routes/propertyPage.js` (full breakdown). It must never appear in `routes/portal.js` or any client response.
- **Fees:** `Backend/lib/fees.js` `syncFee()` marks a brief's fee as `due` when a property is approved AND client-confirmed AND seller-confirmed, and never changes a `paid` fee. The manager sets seller confirmation (`POST /properties/:id/seller-confirmation`) and payment (`POST /briefs/:id/fee`) in `routes/fees.js`. All fee routes are manager only. Employees never see commission, fee status or seller confirmation, including in the history feed.
- **History:** the `property_activity` table is written by `lib/activity.js` `logActivity()`. Client events (viewed, decision) are read straight from the property record. `activityFeed()` hides `seller_confirmed` and `seller_unconfirmed` from employees.
- `routes/assign.js` is mounted before `routes/allProperties.js`, so its `POST /properties/:id/assign` is the one used (it also writes the history). The older assign route inside `allProperties.js` is dead code and can be removed.
- The phone layout lives in `Frontend/src/App.jsx` (slide-in menu, compact header). Other pages rely on stacking grids and horizontally scrolling tables.
- Not built yet: chat attachments, fee notifications on the bell and dashboard, search polish, a security review, backups, and paid hosting.

## Update: hardening, accounts, chat files and client data tools

- **Login throttling:** `routes/auth.js` locks an email after 5 failed attempts in 15 minutes (and an IP after 25), using the `login_attempts` table. A successful login clears that email's failures.
- **Token invalidation:** `users.tokens_valid_after` is set whenever a password changes (`routes/account.js`) or a manager resets an employee's password (`routes/team.js`). `middleware/auth.js` rejects any token issued before it ("Please log in again").
- `api/index.js` uses helmet, a 100 KB JSON limit, and CORS that refuses everyone if `FRONTEND_URL` is missing.
- **Chat attachments:** photos and PDFs up to 10 MB, in the private `property-media` bucket under `chat/<property id>/`. Original file names are never stored or sent, so a file name cannot reveal who someone is. Uploads use signed upload links created by `chatUploadUrl()` in `lib/chat.js` after the same access checks as sending a message.
- **Client data tools** (`routes/clientData.js`, manager only): export all data for a client, and permanent deletion of the client, login, briefs, clusters, properties, media files, chat files and messages. Deletion needs the client's full name typed to confirm.
- Fee alerts: `GET /api/fees/summary` (manager only) feeds the bell and a dashboard strip.
- `Backend/scripts/backup.js` saves all tables to the gitignored `backups/` folder. It does not include Storage files.
- Employees can't reset their own password if they forget it; the manager resets it in Team.