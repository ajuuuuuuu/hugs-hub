
## Goal

Replace the demo localStorage auth with real user accounts. After login the user's own node lights up in the tree. If they're not in the tree yet, they can request to be added under an existing parent; admin approves and the node appears for everyone, linked to their account.

## What changes

### 1. Backend (Lovable Cloud) — new tables

- `profiles` — one row per signed-up user. Holds `id` (=auth.users.id), `display_name`, `email`, `person_id` (nullable FK → persons).
- `user_roles` + `app_role` enum + `has_role()` security-definer function. First admin is seeded manually; admins are checked via `has_role`, not localStorage.
- `persons`, `relationships` — moved out of localStorage into the DB so all users see the same tree. Seeded with the existing Hawthorne/Blake/Chen dummy data via migration so nothing is lost.
- `join_requests` — pending "add me to the tree" submissions: `user_id`, `parent_person_id`, `relation` (`son`/`daughter`), proposed person fields (name, gender, birth_date, photo_url, biography), `message`, `status` (`pending`/`approved`/`rejected`).
- Trigger on signup auto-creates a `profiles` row.
- RLS: everyone (incl. anon) can read persons/relationships; only admins can write. Authenticated users can read/insert their own join_requests; admins can read/update all. Profiles readable by self + admin; person_id can only be set by admin.

### 2. Auth

- New `/auth` route with Email/Password sign-up + sign-in and Google sign-in (managed by Lovable Cloud). Display name captured at sign-up and stored in profile.
- Existing `/login` (hard-coded admin/admin123) is removed.
- Header shows Sign in / Sign out / Admin dashboard (admin link only if `has_role('admin')`).

### 3. Tree highlighting (logged-in viewer)

- On load, if the signed-in user's profile has `person_id`, that node is auto-highlighted and centered.
- Search still works as today.

### 4. "Add me to the tree" flow (viewer not yet in tree)

- If the logged-in user has no `person_id`, a "I'm a family member — add me" button appears in the header and inside any node's detail panel.
- Dialog asks: choose parent (searchable list of existing persons), relation (son / daughter), then their own details (name pre-filled from profile, gender, birth date, photo, short bio) + optional message to admin.
- Submit → inserts a `pending` row in `join_requests`. Toast confirms. Button changes to "Request pending".

### 5. Admin approval

- Admin dashboard gets a new "Member join requests" section listing pending requests with all submitted info and a preview of which parent they'd attach to.
- Approve → server function: creates the new person, creates parent→child relationship, sets requester's `profiles.person_id` to the new id, marks request `approved`. Node appears in everyone's tree immediately; requester now auto-highlights on next visit.
- Reject → marks `rejected` with optional note.
- Existing suggestion review section stays as-is.

## Technical notes

- All mutations go through `createServerFn` with `requireSupabaseAuth`; admin-only ones additionally check `has_role(userId, 'admin')`.
- Frontend reads persons/relationships via TanStack Query so all clients update after admin actions.
- Existing `src/lib/family-data.ts` stays as the seed source for the migration but the running app no longer reads from it.
- `src/lib/family-store.ts` is replaced by a thin Query-based hook (`useFamily()`); branch/birth-family dialog logic is unchanged.

## Out of scope (will not do unless you ask)

- Realtime live updates (admin actions show up on user refresh, not push).
- Editing relationships from the join request itself (admin only attaches as child of one parent; can add spouse/extra parent later via existing admin tools).
- Multi-admin invitations UI (you'll grant the first admin via a one-time SQL snippet I'll show you).

Approve and I'll build it end-to-end.
