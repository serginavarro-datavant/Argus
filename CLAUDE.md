# Argus — prototype validation & user-testing platform

## What we're building (hackathon, 24h)
A platform where you upload a prototype and get: automatic UX checks, AI-proposed test
scenarios, unmoderated user tests (with an element-anchored comment layer + recording),
persona bots, and a moderator dashboard that shows every user's path and comments per task.

## Non-negotiable architecture decisions
- **The uploaded prototype is never modified.** It runs untouched inside an iframe.
- **We re-host every prototype on OUR origin** (upload a zip/build, or pull a GitHub repo and
  serve its built folder). Same-origin is what lets the parent read the iframe DOM and inject
  the overlay. We never iframe an external live URL.
- **The platform holds all knowledge** (projects, scenarios, sessions, paths, comments,
  metrics) in our DB. The prototype stores nothing.
- **Instrumentation is injected from the parent** into the same-origin iframe: the comment
  layer, the recorder (clicks + route changes), and the task bar.
- **Privacy: synthetic/test data only, no PHI.** We capture element identity + interactions +
  authored comments, never input values or full-DOM snapshots. Consent screen before recording.

## Stack (chosen for speed, don't re-litigate)
- Next.js (App Router, TypeScript) — front-end + API routes in one app.
- Prisma + SQLite (`data/dev.db`). Swap to Postgres only if we deploy.
- Tailwind for styling.
- `@anthropic-ai/sdk` for all AI calls. Key in `.env` as `ANTHROPIC_API_KEY` (gitignored; see `.env.example`).
- Client recording via `MediaRecorder`.

> **Dev note:** `prisma` CLI installs a 14 MB package that triggers a TLS reset on
> this network. Until it's installable, `lib/db.ts` uses Node 24's built-in `node:sqlite`
> with the same API surface. `prisma/schema.prisma` remains the canonical data model.
> Switch: `npm i -D prisma && npx prisma migrate dev && npx prisma generate`, then
> replace `lib/db.ts` with the standard PrismaClient singleton.

## Repo layout
- `app/` pages: `/` (projects), `/project/[id]` (dashboard), `/project/[id]/scenarios`,
  `/project/[id]/moderator`, `/t/[projectId]` (tester runner).
- `app/serve/[project]/[...path]` — serves the re-hosted prototype build (same origin).
- `app/api/…` — upload, ingest-repo, projects, scenarios, sessions, comments, checks, agent.
- `lib/` — `db.ts`, `anthropic.ts`, `extract/`, `overlay/`, `checks/`.
- `prisma/schema.prisma`, `data/uploads/<projectId>/` (re-hosted builds).

## Data model (keep in sync in schema.prisma)
Project, Scenario, Persona, Session, TaskResult, Comment, Check. (See schema.)

## Who owns what (minimize file collisions)
- **A (front-end/UX):** all of `app/` pages, the tester runner, the moderator view, and the
  overlay UI in `lib/overlay/`. Owns Tailwind/styles.
- **B (backend/agent):** all of `app/api/`, `prisma/`, `lib/extract/`, `lib/anthropic.ts`,
  `lib/checks/`, upload + repo ingestion + same-origin serving.
- Shared files (`prisma/schema.prisma`, `CLAUDE.md`, `lib/db.ts`, types): ping in Slack before
  editing, and pull+push immediately around the change.

## Working agreement (git — follow every time)
- One repo. `main` must always run (`npm run dev` boots, `npm run build` passes).
- **Start of every session / task:** `git pull --rebase origin main`.
- Small commits. **Push after every working slice** (at least hourly). Don't sit on large diffs.
- **Before any deploy or demo build:** `git pull --rebase origin main` → resolve → `npm run build`
  → then push. Pull-before-push, always, to avoid conflicts.
- Stay in your owned area (above). Touch a shared file only when necessary, and pull+push around it.
- Never commit `.env` or `data/`. Keep `.env.example` current.

## Definition of done for the demo
Upload a prototype → it runs embedded → run a task as a real user → pin a comment on a real
element → path/time/comment saved → moderator sees the session, path, and comment. Plus one
automatic check (a11y) and the AI scenario proposer as the "wow".
