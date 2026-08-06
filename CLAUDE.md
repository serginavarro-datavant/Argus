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

## Stack
- Next.js (App Router, TypeScript) — front-end + API routes in one app.
- JSON-file store at `data/db.json` (swap to Prisma+SQLite once prisma CLI is available).
- Tailwind for styling.
- `@anthropic-ai/sdk` for all AI calls. Key in `.env` as `ANTHROPIC_API_KEY` (gitignored).
- `adm-zip` for ZIP extraction.

## Repo layout
- `app/` pages: `/` (projects), `/project/[id]` (dashboard), `/project/[id]/scenarios`,
  `/project/[id]/moderator`, `/t/[projectId]` (tester entry), `/t/[projectId]/run` (active test).
- `app/serve/[project]/[...path]` — serves the re-hosted prototype build (same origin).
- `app/api/…` — upload, ingest-repo, projects, scenarios, sessions, comments, checks.
- `lib/` — `db.ts`, `anthropic.ts`, `checks/a11y.ts`, `overlay/overlay.ts`.
- `data/uploads/<projectId>/` (re-hosted builds, gitignored).

## Data model (lib/types.ts)
Project, Scenario (with tasks array), Session (with events array), Comment, Check.

## Working agreement
- One repo. `main` must always run.
- Small commits. Push after every working slice.
- Never commit `.env` or `data/`. Keep `.env.example` current.

## Definition of done for the demo
Upload a prototype → it runs embedded → run a task as a real user → pin a comment on a real
element → path/time/comment saved → moderator sees the session, path, and comment. Plus one
automatic check (a11y) and the AI scenario proposer as the "wow".
