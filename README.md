# Madauros — Agenda (المفكرة) fix

Recreation of the agenda module from `michael5787/friendly-ghost-importer`
with two fixes. `/` is a demo harness running on in-memory data.

## 1. Auto-jump to the first pending homework
`src/components/agenda/useAgenda.ts` — `useFirstPendingDay(client, target)`
- teacher: first **future** `homework` date the teacher scheduled (optionally per class)
- student: first future homework of the class with no `submissions` row for its
  `resource_id` by this student (homework without a resource counts as pending)

`StudentAgenda.tsx` / `TeacherAgenda.tsx` start on **today**, switch **once** when the
lookup resolves, and never again after any manual calendar navigation (arrows, picker,
"اليوم").

**Porting note:** `StudentAgenda` now takes a `studentId` prop — pass the signed-in
user id from `routes/talameed.tsx`.

## 2. "تعذّر تحميل المفكرة" on the student page
The live app targets an external database provisioned with `supabase/setup-external.sql`,
which never creates `agenda_events` (that table only exists in `supabase/migrations/`,
which run on Lovable Cloud only). PostgREST answers `PGRST205` and the UI showed a generic error.

- Run `supabase/setup-external-agenda.sql` in the external project's SQL editor
  (idempotent: table, grants, RLS, indexes, schema reload).
- `useAgenda` now maps `PGRST205 / 42P01 / 42501 / 42703` to explicit Arabic messages
  and logs the raw error.
