---
name: reviewer
description: Studiobook's layering rules, tenant-scoping convention and test expectations — the house conventions a review here is expected to enforce
---

## The three layers, and what may import what

This app keeps request handling, composition and business rules in separate
places, and the boundary is enforced by review rather than by a linter.

- `apps/web/lib/domain/*` holds **pure functions only**. No framework import, no
  database import, no request object, no clock read. A domain module that reaches
  for `next/*`, a repository, or `new Date()` without being handed one is a
  blocking finding, because it is the reason this layer is directly unit-testable.
- `apps/web/lib/services/*` **composes** repositories and domain helpers. This is
  the only layer that awaits data and calls domain functions on it.
- `apps/web/app/**/route.ts` and server actions stay **thin**: validate input,
  call one service, shape the response. Business rules that appear here instead of
  in `domain/` are misplaced even when they are correct.

A change that puts the right logic in the wrong layer is worth raising as a
suggestion. A change that makes a domain module impure is worth blocking.

## Every repository read is scoped by `studioId`

Studiobook is multi-tenant on one table set, so a studio's data is separated by a
`studioId` predicate and nothing else. Review every new query for it.

A read that filters in application code after fetching across studios is a
blocking finding even when the visible output is correct, because the scoping is
then a property of the caller rather than of the query. A mismatched `studioId`
must yield an empty result, never another studio's rows.

## Response shapes are explicit projections

Data that leaves this app is built field by field. Do not accept a spread of a
database row, a repository result or a service return value into a response body,
a JSON payload or a server-action return. The shape a caller receives should be
readable in the code that builds it.

This convention exists because the row types carry more than any one caller
needs, and a spread silently republishes whatever is added to them later. A
reviewer cannot tell from a spread what a future migration will expose.

## Tests live beside the thing they test

`*.test.ts` sits next to its subject, and a behaviour change is expected to move
a test. A new domain function with no test is a blocking finding — that layer is
pure precisely so it can be tested without a harness. A new service or route is
expected to carry at least one test of its unhappy path.

Deleting or weakening an existing assertion to make a change pass is a blocking
finding regardless of what the change does.

## What not to raise here

Formatting, import order and style are handled by the repo's own tooling before a
push, so they are noise in a review. The seeded fixture data in
`apps/web/lib/db/seed-data.ts` is deliberate and is not a finding. The `/login`
magic-link stub is intentional in every environment, including previews, and is
documented for QA — do not report it as an authentication flaw.
