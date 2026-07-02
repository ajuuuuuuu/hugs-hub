# Family Tree — Editing Guide

This document explains how the app is organized, how to edit names / photos / details,
and what every key function does. Keep this file open while you make changes.

---

## 1. Where data lives

All people, relationships, profiles and join-requests are stored in **Lovable Cloud**
(the project database). There is no JSON file you edit by hand once the app is running —
everything flows through the database.

| Thing            | Table             | Editable from                              |
| ---------------- | ----------------- | ------------------------------------------ |
| A person (node)  | `persons`         | Admin dashboard → person card, or DB       |
| A link between 2 | `relationships`   | Admin dashboard "Add relationship"         |
| Join requests    | `join_requests`   | Admin dashboard "Member join requests"     |
| User accounts    | `profiles`        | Created automatically on sign-up           |
| Admin role       | `user_roles`      | First sign-up becomes admin automatically  |

### Editing a name, photo or biography

1. Sign in as an admin.
2. Open the tree, **double-click** the person's node.
3. In the side panel click **Edit**.
4. Update name / gender / birth date / death date / **photo URL** / biography → Save.

The photo URL can be any public image link (e.g. from Lovable Cloud Storage,
Unsplash, or a CDN). The card automatically shows it on top of the node.

---

## 2. Click behavior on the tree

| Action                         | What happens                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **Single click on a node**     | Highlights that node (yellow) and its immediate relatives (green): parents, spouse, children. |
| **Double click on a node**     | Opens the side panel with the full profile.                                   |
| Search → pick a result         | Opens the side panel for that person.                                         |
| "My node" button (when linked) | Centers + highlights your own node.                                           |
| "View birth family tree"       | Pops up a second tree of that person's maternal/paternal family.              |

The wiring lives in `src/components/family/FamilyTree.tsx`:

- `onNodeClick`  → calls `onSelect(id)`  → in `src/routes/index.tsx` sets `highlightId`.
- `onNodeDoubleClick` → calls `onOpen(id)` → sets both `highlightId` and `selectedId`
  (selectedId is what opens the side `Sheet`).

`relatedIds` (also in `index.tsx`) is computed from `relationships` whenever
`highlightId` changes. Parents/children come from rows where `type = 'parent'`,
spouses from rows where `type = 'spouse'`.

---

## 3. File map (what to edit for what)

```
src/
├── routes/
│   ├── index.tsx          # Main tree page. Click handlers, highlight logic, search, header.
│   ├── admin.tsx          # Admin dashboard: review join requests, edit/delete persons.
│   └── auth.tsx           # Sign-in / sign-up page.
├── components/family/
│   ├── FamilyTree.tsx     # The React Flow canvas. Single vs double click.
│   ├── PersonNode.tsx     # The visual card (avatar on top, name, dates). Edit styling here.
│   ├── PersonDetail.tsx   # The side panel content (view / edit / add descendant).
│   ├── PersonEditor.tsx   # The form used to create or edit a person.
│   ├── RelationshipEditor.tsx # Admin form to link two existing people.
│   ├── SuggestionForm.tsx # Public form for viewers to suggest corrections.
│   └── JoinRequestDialog.tsx # "Add me to the tree" dialog for signed-in viewers.
├── lib/
│   ├── family-api.ts      # All Supabase reads/writes for persons + relationships.
│   ├── family-data.ts     # TypeScript types only (Person, Relationship, MAIN_FAMILY).
│   └── tree-layout.ts     # Dagre layout: node size, spacing, edge styling.
└── hooks/
    └── use-auth.tsx       # Session, profile, isAdmin helper.
```

### Common tweaks

| I want to…                       | Edit                                                      |
| -------------------------------- | --------------------------------------------------------- |
| Change the card look (colors, size, where the photo sits) | `src/components/family/PersonNode.tsx` |
| Change node spacing or direction | `src/lib/tree-layout.ts` (`nodesep`, `ranksep`, `rankdir`, `W`, `H`) |
| Change the highlight colors      | `src/components/family/FamilyTree.tsx` (`outline` styles) |
| Change which relatives highlight | `relatedIds` in `src/routes/index.tsx`                    |
| Change the side panel content    | `src/components/family/PersonDetail.tsx`                  |
| Add a new field to a person      | 1) DB migration (add column) 2) `family-data.ts` (type) 3) `family-api.ts` (map + insert/update) 4) `PersonEditor.tsx` (input) 5) `PersonDetail.tsx` (display) |

---

## 4. Function reference

### `src/lib/family-api.ts`

- `fetchFamily()` → loads every `persons` row and every `relationships` row.
  Used by the main page (`useQuery({ queryKey: ['family'] })`).
- `addPerson(p)` → inserts a new person. `p` is everything except `id`
  (id is generated client-side with `makeId`).
- `updatePerson(id, patch)` → partial update. Only fields you pass are written.
- `deletePerson(id)` → removes a person. Relationships referencing it are
  cascaded by the DB.
- `addRelationship({ person1Id, person2Id, type })` → `type` is `'parent'`
  (person1 is the parent of person2) or `'spouse'`.
- `deleteRelationship(id)` → removes the link only, not the people.

### `src/routes/index.tsx`

- `Index()` is the page component. State:
  - `selectedId` → which person's detail panel is open.
  - `highlightId` → which person is currently focused (yellow outline).
  - `relatedIds` → derived set of parents/spouse/children of `highlightId`
    (green outline).
  - `branchPersonId` → if set, opens the "birth family" sub-tree dialog.
  - `joinOpen`, `pendingRequest` → controls the "Add me to the tree" flow.
- `mainPersonIds` / `mainPersons` / `mainRelationships` → filter the data to
  the main family group plus anyone married into it.

### `src/components/family/FamilyTree.tsx`

- Props:
  - `persons`, `relationships` — what to draw.
  - `onSelect(id)` — single click. Used for highlight.
  - `onOpen(id)` — double click. Used to open detail.
  - `highlightId` — primary node (yellow).
  - `relatedIds` — set of secondary nodes (green).
- `buildTree()` from `tree-layout.ts` runs dagre to compute positions.

### `src/components/family/PersonDetail.tsx`

Modes: `view | suggest | edit | addDesc | addRel`.
`run(fn, msg)` is the shared "do mutation, toast, refetch" helper.
Admin-only buttons are gated by the `isAdmin` prop.

### `src/hooks/use-auth.tsx`

Returns `{ session, user, profile, isAdmin, loading, signOut, refreshProfile }`.
- `profile.person_id` is set once an admin approves the user's join request —
  that's what makes "My node" appear and the user's node auto-highlight on load.

---

## 5. Adding a new person without using the UI

If you'd rather seed people in bulk, write a SQL migration:

```sql
insert into public.persons (id, name, gender, birth_date, photo_url, biography, family_group)
values ('p_alice', 'Alice Hawthorne', 'female', '1990-01-01',
        'https://example.com/alice.jpg', 'Short bio…', 'hawthorne');

insert into public.relationships (id, person1_id, person2_id, type)
values ('r_alice_parent', 'p_robert', 'p_alice', 'parent');
```

Use `family_group = 'hawthorne'` to put the person in the main tree.
Use any other group string (e.g. `'blake'`) to put them in a separate
birth-family tree.

---

## 6. Quick checklist when something looks wrong

1. **Photo not showing?** The card falls back to initials when `photo_url` is
   empty or the URL fails to load. Open it in a new tab to confirm it's public.
2. **Node not in the tree?** Check `family_group` — only `'hawthorne'` (or whoever
   married in) appears on the main tree.
3. **Edits don't save?** You must be signed in as an admin. The first user to
   sign up automatically becomes admin (see DB trigger `handle_new_user`).
4. **Highlights stuck?** Click empty canvas or pick another node — `highlightId`
   only changes on click; it doesn't auto-clear.
