# Argus

Prototype validation & unmoderated user-testing platform. Upload a prototype ZIP, run AI-generated test scenarios, collect session paths and element-anchored comments, review in the moderator dashboard.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create .env from example and add your Anthropic key
cp .env.example .env
# edit .env → ANTHROPIC_API_KEY=sk-ant-...

# 3. Create the SQLite database
node scripts/migrate.mjs

# 4. Run the dev server
npm run dev
# → http://localhost:3000
```

## Stack

- **Next.js 15** (App Router, TypeScript) — frontend + API routes
- **SQLite** via Node 24's built-in `node:sqlite` — no external DB needed
- **Tailwind v4** — styling
- **@anthropic-ai/sdk** — AI scenario generation and a11y checks
- **adm-zip** — prototype ZIP extraction

> **When the prisma CLI is installable:** `npm i -D prisma && npx prisma migrate dev && npx prisma generate`, then replace `lib/db.ts` with the standard PrismaClient singleton (see comment at top of that file).

## Routes

| Path | Description |
|------|-------------|
| `/` | Project list + upload |
| `/project/[id]` | Project dashboard |
| `/project/[id]/scenarios` | Scenarios & AI generation |
| `/project/[id]/moderator` | Session replay & comments |
| `/t/[projectId]` | Tester entry (name + scenario select) |
| `/t/[projectId]/run` | Live tester session with overlay |

## Security

- `.env` and `data/` are gitignored — never committed
- Overlay captures element selectors and authored comments only — never input values or full DOM
- Tester sees a consent screen before recording starts
