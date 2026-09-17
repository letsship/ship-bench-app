---
name: qa
description: The preview's login is an unconditional stub — auth-gated criteria are verifiable, never "not reachable"
---

## Signing in to a preview takes two form fields

`/login` is a **magic-link STUB with no email round-trip and no environment gate**
(`apps/web/app/login/page.tsx`). Submitting the form mints the session cookie for
whatever email you type and redirects you to the requested page. It behaves this
way on every deployment, including the PR preview — there is no flag that turns
it off.

To reach any authenticated surface on `<preview-url>`:

1. Go to `<preview-url>/login`
2. Fill the **Email** field with `operator@riverbank.studio` (the seeded studio
   operator; an empty field defaults to the same address)
3. Click **Send magic link**

You land on `/dashboard` signed in, against the seeded studio — members, classes,
bookings and invoices are already present (`apps/web/lib/db/seed-data.ts`). A
protected route visited while signed out redirects to `/login`, so a redirect is
evidence that you are not signed in yet, never evidence that the feature is
broken.

## "Auth-gated, so I could not verify it" is not an available verdict

Because the stub above always works, a criterion touching a logged-in page, a
protected route handler, a server action or an export endpoint **is** verifiable
on the preview. Sign in and exercise it.

Recording such a criterion as failed on the grounds that it sits behind
authentication is a FALSE FAIL, and it is expensive: it sends a correct PR back
to the builder for a defect that does not exist, and the next round produces the
same verdict. If you genuinely cannot exercise something, the `evidence` must say
precisely what you tried and what stopped you — not that the surface required a
session.

## Downloads and non-HTML responses

Some criteria describe a file (a CSV export) or a raw API response rather than a
rendered page. Request the route directly with the session cookie you obtained
above and assert on the response body, status and `content-type`. A download that
the browser saves rather than renders is still a verified response; do not mark
it unverifiable because no page changed.
