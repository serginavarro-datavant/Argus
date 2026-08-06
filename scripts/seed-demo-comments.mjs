// Seed realistic demo comments for the Config Builder prototype.
// Wipes all existing comments, creates 3 fake user sessions, inserts 6 placed comments.
// Usage: node scripts/seed-demo-comments.mjs

import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('data/dev.db')
const PROJECT_ID = 'fjbpvnumsh77ah1'
const PAGE_URL = 'http://localhost:3000/serve/fjbpvnumsh77ah1/index.html'

// Build a deep-link URL that encodes a click sequence via ?_argusNav=
function deepUrl(...navSelectors) {
  const nav = encodeURIComponent(navSelectors.join('|'))
  return `${PAGE_URL}?_argusNav=${nav}`
}

// Build a deep-link URL that navigates via SPA hash (no page reload)
function hashUrl(hash) {
  return `${PAGE_URL}?_argusHash=${encodeURIComponent(hash)}`
}

function id() {
  return Math.random().toString(36).slice(2, 10) + 'msh' + Math.random().toString(36).slice(2, 8)
}

// ── Wipe existing comments for this project ─────────────────────────────────
db.exec(`DELETE FROM "Comment" WHERE "projectId" = '${PROJECT_ID}'`)
console.log('Cleared existing comments.')

// ── Create 3 demo sessions ──────────────────────────────────────────────────
const now = new Date()
const sessions = [
  { id: id(), name: 'Maria G.',  startedAt: new Date(now - 72 * 60 * 60 * 1000).toISOString(), endedAt: new Date(now - 72 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString() },
  { id: id(), name: 'Tom K.',   startedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(), endedAt: new Date(now - 48 * 60 * 60 * 1000 + 11 * 60 * 1000).toISOString() },
  { id: id(), name: 'Jamie L.', startedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(), endedAt: new Date(now - 24 * 60 * 60 * 1000 + 18 * 60 * 1000).toISOString() },
]

const insertSession = db.prepare(`
  INSERT OR IGNORE INTO "Session"
    (id, projectId, testerName, startedAt, endedAt, path, scenarioId)
  VALUES (?, ?, ?, ?, ?, '[]', NULL)
`)

for (const s of sessions) {
  insertSession.run(s.id, PROJECT_ID, s.name, s.startedAt, s.endedAt)
  console.log(`Created session: ${s.name} (${s.id})`)
}

// ── Insert 6 placed comments ────────────────────────────────────────────────
const insertComment = db.prepare(`
  INSERT INTO "Comment"
    (id, sessionId, projectId, text, selector, rect, pageUrl, ox, oy, label, screen, scenarioId, createdAt)
  VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, '', ?, NULL, ?)
`)

const comments = [
  // Maria G. — 2 comments
  {
    sessionId: sessions[0].id,
    text: "Didn't notice the dropdown arrow — tapped the main label and expected a form, not a split button",
    selector: '.split-btn-main',
    ox: 0.5, oy: 0.5,
    createdAt: new Date(now - 72 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString(),
  },
  {
    sessionId: sessions[0].id,
    text: "'Tokens' — I assumed this was about access tokens, not the type of config. Label needs more context",
    selector: '.tokf-trigger',
    ox: 0.5, oy: 0.5,
    createdAt: new Date(now - 72 * 60 * 60 * 1000 + 7 * 60 * 1000).toISOString(),
  },
  // Tom K. — 2 comments
  {
    sessionId: sessions[1].id,
    text: "Tapped the ? icon expecting a tooltip or help panel. Nothing happened — felt like it was broken",
    selector: '.help-btn',
    ox: 0.5, oy: 0.5,
    createdAt: new Date(now - 48 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString(),
  },
  {
    sessionId: sessions[1].id,
    text: "Clicked the row to open 'Patient Cohort v3' but nothing happened. Expected it to expand inline or navigate",
    selector: '.cfg-parent-row:nth-child(1)',
    ox: 0.3, oy: 0.5,
    createdAt: new Date(now - 48 * 60 * 60 * 1000 + 6 * 60 * 1000).toISOString(),
  },
  // Jamie L. — 2 comments
  {
    sessionId: sessions[2].id,
    text: "Tried to filter by partner name here but it searched across all fields — only wanted name matches",
    selector: 'input[placeholder="Search configurations"]',
    ox: 0.5, oy: 0.5,
    createdAt: new Date(now - 24 * 60 * 60 * 1000 + 4 * 60 * 1000).toISOString(),
  },
  {
    sessionId: sessions[2].id,
    text: "165 outputs on 'Provider Directory Sync' — is that right? Seemed unexpectedly high, I wondered if it was a display bug",
    selector: '.cfg-parent-row:nth-child(3)',
    ox: 0.85, oy: 0.5,
    createdAt: new Date(now - 24 * 60 * 60 * 1000 + 11 * 60 * 1000).toISOString(),
  },

  // ── Deep-link comments: inside wizard steps (hash nav jumps directly to each step) ──
  // Step 1 — Input  (#prototype?v=create&step=input)
  {
    sessionId: sessions[0].id,
    text: "The 'Import data' button wasn't obvious as the starting point — I expected a visible dropzone or inline prompt, not a button tucked in the corner",
    selector: '[data-hl="input-grid"]',
    ox: 0.5, oy: 0.3,
    screen: hashUrl('#prototype?v=create&step=input'),
    createdAt: new Date(now - 72 * 60 * 60 * 1000 + 9 * 60 * 1000).toISOString(),
  },
  // Step 2 — Output  (#prototype?v=create&step=output)
  {
    sessionId: sessions[1].id,
    text: "I wasn't sure which output columns were required vs optional — some kind of indicator (asterisk, badge) would help",
    selector: '[data-hl="output-grid"]',
    ox: 0.5, oy: 0.3,
    screen: hashUrl('#prototype?v=create&step=output'),
    createdAt: new Date(now - 48 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
  },
  // Step 3 — Format  (#prototype?v=create&step=format)
  {
    sessionId: sessions[2].id,
    text: "Format options are overwhelming — there are 12 choices and no description of what each one does. I had to guess",
    selector: '.fmt-card',
    ox: 0.5, oy: 0.3,
    screen: hashUrl('#prototype?v=create&step=format'),
    createdAt: new Date(now - 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
  },
  // Step 4 — Run Test  (#prototype?act=run-test)
  {
    sessionId: sessions[1].id,
    text: "'Run Test' — I didn't realize this was optional until after I'd already waited 30 seconds for it to complete. The 'Optional' label is too easy to miss",
    selector: '.rt-card',
    ox: 0.5, oy: 0.05,
    screen: hashUrl('#prototype?act=run-test'),
    createdAt: new Date(now - 48 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
  },
]

for (const c of comments) {
  const cid = id()
  const screen = c.screen ?? PAGE_URL
  insertComment.run(cid, c.sessionId, PROJECT_ID, c.text, c.selector, PAGE_URL, c.ox, c.oy, screen, c.createdAt)
  console.log(`Inserted comment: "${c.text.substring(0, 50)}…"`)
}

console.log('\nDone. Restart the dev server to see changes.')
