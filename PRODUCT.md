# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router, server-rendered with Server Actions) + TypeScript, Supabase (Postgres, Auth, Row Level Security), Tiptap for notes, Tailwind, Zod at boundaries (zod/mini in modules the browser loads), Vitest + Playwright, hosted on Vercel + Supabase. Cloud-first, individual users only. There is no client cache or offline layer: every read and write needs a connection. Offline capture is on the roadmap, not built (ADR-0001).

## Users
A busy individual running work and personal life together, who currently splits it across a to-do app, a calendar and a notes app and loses things between them. Solo use; no collaboration in v1.

## Product Purpose
Axiis is the one place where your tasks, time and notes meet, so nothing you capture gets lost and your day plans itself around what matters.

One connected item model (task, note, checklist, event) with many views (list, calendar, planner, Today). Views are queries, not separate data. Free for now; no billing in v1.

## Positioning
Faster and more focused than Notion (no blank-canvas setup), more connected than Todoist (tasks link to notes and time), better at planning than Google Calendar (tasks are timeboxed, not just events). Lead trait: connectedness with calm.

## Scope
- In v1: tasks, planner, checklists/todos, notes.
- Out for v1: collaboration, spreadsheet-style databases, native mobile apps, AI features, integrations.
- Deferred, with room left in the item model: habits, goals, shared lists, a connections graph view.

## Brand
- **Personality:** calm with a distinctive edge. Editorial spacing and typography, one confident accent color.
- **Logo:** wordmark plus a crossing-axes symbol that doubles as the app icon. The double "i" becomes two axis ticks. No gradients; must hold at 16px.
- **Color:** warm paper-toned light theme and a deep dark theme on shared tokens, one confident accent, plus a small restrained set of item-type hues used only as type cues. No default blue or purple SaaS gradients.
- **Typography:** characterful serif or display face for headings and the wordmark, neutral readable sans for UI, tabular figures for dates and times.
- **Signature interactions:** items morph between list, calendar and planner views; dragging a task onto the time axis timeboxes it; a small, tasteful completion moment. Connections view deferred.
- **Voice:** quiet, plain, slightly warm, an occasional dry line. No exclamation marks, no productivity-guru language, no guilt copy for overdue items.
- **Density and default:** spacious by default with a density toggle. Opens to Today (the day's tasks, events and linked notes together).

## Capabilities and Constraints
- Greenfield project: the directory contains no code, content, or assets.
- Name: Axiis.
- Public launch is planned, so privacy policy, terms, account deletion and data export are required before release.
- Every table is protected by Row Level Security scoped to the owning user.

## Evidence on Hand
None. No copy, data, testimonials, logos, or assets exist. Future work must not fabricate them.

## Product Principles
1. Capture in under two seconds; organize later.
2. Everything connects; no item lives in a silo.
3. Calm by default: no guilt badges, no clutter. Every screen says where you are and what is next before it shows everything there is.
4. One model, many views: never make the user pick a type before they can write.
5. Your data is yours: export and delete anytime.
