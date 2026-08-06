/**
 * Prisma-shaped SQLite client using Node 24's built-in node:sqlite.
 *
 * API surface intentionally matches PrismaClient so that when the prisma CLI
 * is installable you can drop in the standard singleton without touching any
 * other file:
 *
 *   import { PrismaClient } from '@prisma/client'
 *   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
 *   export const prisma = globalForPrisma.prisma ?? new PrismaClient()
 *   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createId } from './utils'

// ─── Types (mirror prisma/schema.prisma) ────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  uploadPath: string
  entryPath: string
  remoteBaseUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Scenario {
  id: string
  projectId: string
  title: string
  description: string       // one-line goal shown in task bar (the WHAT)
  brief: string             // pre-task briefing: context + what "done" looks like
  startScreen: string       // URL path or hash where the test begins
  successCriteria: string   // what "done" looks like (internal/moderator)
  tasks: Task[]
  order: number
  role: string              // tester role, e.g. "Customer"
  persona: string           // persona slug, e.g. "customer"
  optional: boolean         // if true, doesn't count toward task total
  freeform: boolean         // if true: no timer, no rating, just a finish button
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string   // phrased as a goal (WHAT, not HOW)
  hint?: string         // optional on-screen aid shown to testers
}

export interface Persona {
  id: string
  projectId: string
  name: string
  description: string
  aids: string[]
  role: string
  goals: string
  techComfort: 'low' | 'medium' | 'high'
  isPrebuilt: boolean
  createdAt: string
}

export interface PathEvent {
  type: 'navigation' | 'click' | 'task_start' | 'task_complete'
  url?: string
  selector?: string
  role?: string
  label?: string
  taskIndex?: number
  timestamp: string
}

export interface Session {
  id: string
  projectId: string
  scenarioId: string | null
  personaId: string | null
  testerName: string
  path: PathEvent[]
  startedAt: string
  endedAt: string | null
  type: 'human' | 'bot'
  videoUrl: string | null
  taskResults?: TaskResult[]
  comments?: Comment[]
}

export interface TaskResult {
  id: string
  sessionId: string
  taskIndex: number
  completed: boolean
  rating: { timeMs?: number; clicks?: number; notes?: string }
  createdAt: string
}

export interface Comment {
  id: string
  sessionId: string
  projectId: string
  text: string
  selector: string
  rect: { x: number; y: number; width: number; height: number }
  pageUrl: string
  ox: number | null
  oy: number | null
  label: string
  screen: string
  scenarioId: string | null
  createdAt: string
}

export interface Check {
  id: string
  projectId: string
  type: 'a11y' | 'copy' | 'ds'
  summary: string
  results: CheckIssue[]
  createdAt: string
}

export interface CheckIssue {
  severity: 'high' | 'medium' | 'low'
  description: string
  element?: string       // CSS selector
  wcagCriteria?: string  // e.g. "wcag211"
  helpUrl?: string
}

// ─── Singleton DB connection ─────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')

function openDB(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new DatabaseSync(path.join(DATA_DIR, 'dev.db'))
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;')
  // Additive column migrations — safe to re-run (throws if column already exists, which we ignore)
  for (const stmt of [
    `ALTER TABLE "Comment" ADD COLUMN "ox" REAL`,
    `ALTER TABLE "Comment" ADD COLUMN "oy" REAL`,
    `ALTER TABLE "Comment" ADD COLUMN "label" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Comment" ADD COLUMN "screen" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Comment" ADD COLUMN "scenarioId" TEXT`,
    `ALTER TABLE "Project" ADD COLUMN "remoteBaseUrl" TEXT`,
    `ALTER TABLE "Scenario" ADD COLUMN "startScreen" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Scenario" ADD COLUMN "successCriteria" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Scenario" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Scenario" ADD COLUMN "brief" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Scenario" ADD COLUMN "role" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Scenario" ADD COLUMN "persona" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Scenario" ADD COLUMN "optional" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Scenario" ADD COLUMN "freeform" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Session" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'human'`,
    `ALTER TABLE "Session" ADD COLUMN "videoUrl" TEXT`,
    `ALTER TABLE "Persona" ADD COLUMN "role" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Persona" ADD COLUMN "goals" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Persona" ADD COLUMN "techComfort" TEXT NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE "Persona" ADD COLUMN "isPrebuilt" INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try { db.exec(stmt) } catch { /* column already exists */ }
  }
  return db
}

// The canonical demo project — Config Builder (already uploaded at this ID)
const CB_PROJECT_ID = 'fjbpvnumsh77ah1'

// Config Builder usability-test scenarios (seeded idempotently on startup)
const CB_SCENARIOS: Array<{
  order: number; title: string; description: string; brief: string
  successCriteria: string; role: string; persona: string
  optional: boolean; freeform: boolean
}> = [
  {
    order: 1,
    title: 'Onboard a new patient file, and give a partner access',
    description: 'Set up a configuration for a new patient file so it\'s tokenized and onboarded, then give BluePeak Payer access.',
    brief: 'Your team just got a new weekly patient file, with a data sample to work from. Create one configuration that both tokenizes and onboards it, then give BluePeak Payer access. You\'re done once it exists and BluePeak can use it.',
    successCriteria: 'A new configuration exists set to BOTH tokenize and onboard, and BluePeak Payer has been granted access to it.',
    role: 'Customer', persona: 'customer', optional: false, freeform: false,
  },
  {
    order: 2,
    title: 'Extend a tokenize-only config to also onboard',
    description: 'Update "Rx Claims Dedup" so its data is also onboarded to the portal, not just tokenized, then save.',
    brief: '"Rx Claims Dedup" only de-identifies data today. The team now needs it onboarded to the Datavant portal too. Update the existing config to do both, and save.',
    successCriteria: '"Rx Claims Dedup" is changed to also onboard (mode includes onboarding) and saved, creating a new version.',
    role: 'Customer', persona: 'customer', optional: false, freeform: false,
  },
  {
    order: 3,
    title: 'Spin up a variant from an earlier version',
    description: 'Make your own copy of "Provider Directory Sync" based on an earlier version (version 1), not the current one.',
    brief: 'You want to experiment with an earlier setup of "Provider Directory Sync" (version 1), without touching the current one. Expand its previous versions and make your own copy from version 1. You\'re done once your copy exists.',
    successCriteria: 'A new configuration (the participant\'s own copy) exists, cloned from version 1 of "Provider Directory Sync" (not the current version); the original is untouched.',
    role: 'Customer', persona: 'customer', optional: false, freeform: false,
  },
  {
    order: 4,
    title: 'Fix onboarding mapping problems',
    description: 'Fix the onboarding setup in "Oncology Registry Onboarding" so no columns get dropped, then save.',
    brief: 'In "Oncology Registry Onboarding", some columns aren\'t set up right for onboarding, so they\'d be silently dropped and unusable in Match & Assess. Review the onboarding setup, fix the problems, and save.',
    successCriteria: 'The unmapped/misconfigured onboarding columns are corrected so none are dropped, and the config is saved.',
    role: 'Customer', persona: 'customer', optional: false, freeform: false,
  },
  {
    order: 5,
    title: 'Poke around',
    description: 'Explore anything you like and leave comments as you go. No task, no timer.',
    brief: 'No task this time. Wander through the Configuration Builder however you like and drop comments on anything that stands out, good or bad. When you\'re done, click Done exploring.',
    successCriteria: 'n/a — ends when the participant clicks Done exploring.',
    role: 'Customer', persona: 'customer', optional: true, freeform: true,
  },
]

const g = globalThis as unknown as { __argusDb?: DatabaseSync; __argusSeeded?: boolean }
if (!g.__argusDb) g.__argusDb = openDB()
const db = g.__argusDb

// Seed CB scenarios idempotently (insert only if title not already present for this project)
for (const s of CB_SCENARIOS) {
  const exists = db.prepare(`SELECT id FROM "Scenario" WHERE "projectId"=? AND "title"=?`).get(CB_PROJECT_ID, s.title)
  if (!exists) {
    const id = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
    const ts = new Date().toISOString()
    db.prepare(`INSERT INTO "Scenario"("id","projectId","title","description","brief","startScreen","successCriteria","tasks","order","role","persona","optional","freeform","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, CB_PROJECT_ID, s.title, s.description, s.brief, 'Configurations list (landing)', s.successCriteria, '[]', s.order, s.role, s.persona, s.optional ? 1 : 0, s.freeform ? 1 : 0, ts)
  }
}

// ─── Prebuilt Datavant-client personas ────────────────────────────────────────

const CB_PERSONAS: Array<{
  name: string; description: string; role: string; goals: string; techComfort: Persona['techComfort']
}> = [
  {
    name: 'Clinical Ops Manager',
    description: 'Manages data pipelines for a large health system. Standardizes tokenization across departments without heavy IT involvement.',
    role: 'Clinical Operations Manager',
    goals: 'Onboard patient datasets, grant access to payer partners, ensure configurations are correct before production.',
    techComfort: 'medium',
  },
  {
    name: 'Data Engineering Lead',
    description: 'Senior engineer at a payer who owns the data platform and evaluates Datavant for automating claims dedup pipelines.',
    role: 'Data Engineering Lead',
    goals: 'Configure automated pipelines, manage version history, control access programmatically.',
    techComfort: 'high',
  },
  {
    name: 'Research Coordinator',
    description: 'Clinical researcher who needs to share provider directory data for match & assess. Limited technical background.',
    role: 'Clinical Research Coordinator',
    goals: 'Submit data for onboarding, understand configuration status, share results with research team.',
    techComfort: 'low',
  },
  {
    name: 'IT Security Architect',
    description: 'Reviews data sharing configurations for compliance. Focuses on access controls and audit trails.',
    role: 'IT Security Architect',
    goals: 'Audit configurations, verify access grants are appropriate, review version history.',
    techComfort: 'high',
  },
]

for (const p of CB_PERSONAS) {
  const exists = db.prepare(`SELECT id FROM "Persona" WHERE "projectId"=? AND "name"=?`).get(CB_PROJECT_ID, p.name)
  if (!exists) {
    const id = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
    const ts = new Date().toISOString()
    db.prepare(`INSERT INTO "Persona"("id","projectId","name","description","aids","role","goals","techComfort","isPrebuilt","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, CB_PROJECT_ID, p.name, p.description, '[]', p.role, p.goals, p.techComfort, 1, ts)
  }
}

// ─── Mock session data ────────────────────────────────────────────────────────

function seedMockSessions() {
  if (g.__argusSeeded) return
  const existing = db.prepare(`SELECT id FROM "Session" WHERE "projectId"=? AND "testerName"=?`).get(CB_PROJECT_ID, 'Alice Chen')
  if (existing) { g.__argusSeeded = true; return }

  const scRows = db.prepare(`SELECT id, title FROM "Scenario" WHERE "projectId"=?`).all(CB_PROJECT_ID) as { id: string; title: string }[]
  if (scRows.length === 0) return
  const scByTitle: Record<string, string> = Object.fromEntries(scRows.map(r => [r.title, r.id]))

  const pRows = db.prepare(`SELECT id, name FROM "Persona" WHERE "projectId"=?`).all(CB_PROJECT_ID) as { id: string; name: string }[]
  const pByName: Record<string, string> = Object.fromEntries(pRows.map(r => [r.name, r.id]))

  const SERVE = 'http://localhost:3000/serve/fjbpvnumsh77ah1/index.html'

  function tms(base: Date, ms: number): string { return new Date(base.getTime() + ms).toISOString() }

  function nav(label: string, base: Date, ms: number): PathEvent {
    return { type: 'navigation', url: SERVE, label, timestamp: tms(base, ms) }
  }
  function clk(selector: string, label: string, base: Date, ms: number): PathEvent {
    return { type: 'click', selector, label, timestamp: tms(base, ms) }
  }
  function tstart(idx: number, label: string, base: Date, ms: number): PathEvent {
    return { type: 'task_start', taskIndex: idx, label, timestamp: tms(base, ms) }
  }
  function tdone(idx: number, base: Date, ms: number): PathEvent {
    return { type: 'task_complete', taskIndex: idx, timestamp: tms(base, ms) }
  }

  interface MockSession {
    testerName: string
    scenarioTitle: string
    personaName?: string
    startDate: Date
    endOffsetMs?: number
    sessionType?: string
    path: PathEvent[]
    tasks: Array<{ completed: boolean; timeMs: number; clickCount: number }>
    seq?: number
    note?: string
    comments?: Array<{ text: string; pageUrl: string; ox: number; oy: number; selector: string }>
  }

  function insertMockSession(opts: MockSession) {
    const scenarioId = scByTitle[opts.scenarioTitle]
    if (!scenarioId) return
    const personaId = opts.personaName ? (pByName[opts.personaName] ?? null) : null
    const sid = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
    const startedAt = opts.startDate.toISOString()
    const endedAt = opts.endOffsetMs !== undefined ? new Date(opts.startDate.getTime() + opts.endOffsetMs).toISOString() : null

    db.prepare(`INSERT INTO "Session"("id","projectId","scenarioId","personaId","testerName","path","startedAt","endedAt","type") VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(sid, CB_PROJECT_ID, scenarioId, personaId, opts.testerName, JSON.stringify(opts.path), startedAt, endedAt, opts.sessionType ?? 'human')

    opts.tasks.forEach((task, idx) => {
      const trid = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
      db.prepare(`INSERT INTO "TaskResult"("id","sessionId","taskIndex","completed","rating","createdAt") VALUES (?,?,?,?,?,?)`)
        .run(trid, sid, idx, task.completed ? 1 : 0, JSON.stringify({ timeMs: task.timeMs, clickCount: task.clickCount }), new Date().toISOString())
    })

    if (opts.seq !== undefined) {
      const trid = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
      db.prepare(`INSERT INTO "TaskResult"("id","sessionId","taskIndex","completed","rating","createdAt") VALUES (?,?,?,?,?,?)`)
        .run(trid, sid, -1, 1, JSON.stringify({ seq: opts.seq, note: opts.note ?? '' }), new Date().toISOString())
    }

    for (const c of opts.comments ?? []) {
      const cid = Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
      db.prepare(`INSERT INTO "Comment"("id","sessionId","projectId","text","selector","rect","pageUrl","ox","oy","label","screen","scenarioId","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(cid, sid, CB_PROJECT_ID, c.text, c.selector, '{}', c.pageUrl, c.ox, c.oy, '', c.pageUrl, scenarioId, new Date().toISOString())
    }
  }

  // ── Alice Chen ─────────────────────────────────────────────────────────────
  {
    const d = new Date('2026-07-24T10:00:00Z')
    insertMockSession({
      testerName: 'Alice Chen', personaName: 'Clinical Ops Manager', sessionType: 'human',
      scenarioTitle: 'Onboard a new patient file, and give a partner access',
      startDate: d, endOffsetMs: 12 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Create a tokenize + onboard configuration', d, 8000),
        clk('button.new-config', 'Clicked "New Configuration"', d, 15000),
        clk('input[name="name"]', 'Typed configuration name', d, 38000),
        clk('[data-mode="tokenize"]', 'Enabled Tokenize', d, 62000),
        clk('[data-mode="onboard"]', 'Enabled Onboard', d, 78000),
        clk('button.save', 'Saved configuration', d, 115000),
        tdone(0, d, 118000),
        tstart(1, 'Give BluePeak Payer access', d, 122000),
        clk('[data-tab="access"]', 'Opened Access tab', d, 145000),
        clk('button.add-partner', 'Clicked "Add partner"', d, 195000),
        clk('[data-partner="bluepeak"]', 'Selected BluePeak Payer', d, 228000),
        clk('button.grant', 'Confirmed access grant', d, 265000),
        tdone(1, d, 268000),
      ],
      tasks: [
        { completed: true, timeMs: 110000, clickCount: 5 },
        { completed: true, timeMs: 150000, clickCount: 4 },
      ],
      seq: 5,
      note: 'The "Tokenize + Onboard" option wasn\'t immediately obvious — I tried the dropdown first.',
      comments: [
        { text: 'Not sure if "Onboard" means the same as "Submit to portal" — wording feels ambiguous', pageUrl: SERVE, ox: 0.45, oy: 0.35, selector: '[data-mode="onboard"]' },
        { text: 'Adding a partner was buried under the Access tab — I expected it at the top level', pageUrl: SERVE, ox: 0.62, oy: 0.58, selector: '[data-tab="access"]' },
      ],
    })
  }
  {
    const d = new Date('2026-07-27T14:30:00Z')
    insertMockSession({
      testerName: 'Alice Chen', personaName: 'Clinical Ops Manager', sessionType: 'human',
      scenarioTitle: 'Extend a tokenize-only config to also onboard',
      startDate: d, endOffsetMs: 8.5 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Update Rx Claims Dedup to also onboard', d, 5000),
        clk('.config-item', 'Opened "Rx Claims Dedup"', d, 18000),
        clk('[data-tab="settings"]', 'Opened Settings tab', d, 35000),
        clk('[data-mode="onboard"]', 'Enabled Onboard mode', d, 68000),
        clk('button.save', 'Saved configuration', d, 95000),
        tdone(0, d, 98000),
      ],
      tasks: [{ completed: true, timeMs: 93000, clickCount: 4 }],
      seq: 6, note: 'Smooth — found the right config quickly using the search.',
      comments: [],
    })
  }
  {
    const d = new Date('2026-08-01T09:15:00Z')
    insertMockSession({
      testerName: 'Alice Chen', personaName: 'Clinical Ops Manager', sessionType: 'human',
      scenarioTitle: 'Fix onboarding mapping problems',
      startDate: d, endOffsetMs: 9 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Find Oncology Registry Onboarding', d, 6000),
        clk('.config-item', 'Opened "Oncology Registry Onboarding"', d, 22000),
        clk('[data-tab="onboard"]', 'Opened Onboard tab', d, 45000),
        tdone(0, d, 48000),
        tstart(1, 'Fix unmapped / dropped columns', d, 52000),
        clk('.column-mapping', 'Clicked on column mapping row', d, 72000),
        clk('[data-action="map"]', 'Mapped first column', d, 105000),
        clk('.column-mapping', 'Found another problem column', d, 148000),
        clk('[data-action="map"]', 'Mapped second column', d, 175000),
        clk('button.save', 'Saved mapping changes', d, 188000),
        tdone(1, d, 192000),
      ],
      tasks: [
        { completed: true, timeMs: 42000, clickCount: 2 },
        { completed: true, timeMs: 144000, clickCount: 4 },
      ],
      seq: 4,
      note: 'The "dropped" warning wasn\'t obvious until I hovered. Expected a red indicator.',
      comments: [
        { text: '"Dropped" label doesn\'t communicate urgency — almost missed it without hover', pageUrl: SERVE, ox: 0.38, oy: 0.48, selector: '.column-status-dropped' },
      ],
    })
  }

  // ── Marcus Lee ─────────────────────────────────────────────────────────────
  {
    const d = new Date('2026-07-24T11:30:00Z')
    insertMockSession({
      testerName: 'Marcus Lee', personaName: 'Data Engineering Lead', sessionType: 'human',
      scenarioTitle: 'Onboard a new patient file, and give a partner access',
      startDate: d, endOffsetMs: 7 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Create tokenize + onboard config', d, 5000),
        clk('button.new-config', 'New Configuration', d, 12000),
        clk('input[name="name"]', 'Named the config', d, 28000),
        clk('[data-mode="tokenize"]', 'Enabled Tokenize', d, 42000),
        clk('[data-mode="onboard"]', 'Enabled Onboard', d, 55000),
        clk('button.save', 'Saved', d, 68000),
        tdone(0, d, 70000),
        tstart(1, 'Grant BluePeak Payer access', d, 74000),
        clk('[data-tab="access"]', 'Access tab', d, 82000),
        clk('button.add-partner', 'Add partner', d, 98000),
        clk('[data-partner="bluepeak"]', 'BluePeak Payer', d, 112000),
        clk('button.confirm', 'Confirmed', d, 125000),
        tdone(1, d, 128000),
      ],
      tasks: [
        { completed: true, timeMs: 65000, clickCount: 4 },
        { completed: true, timeMs: 58000, clickCount: 4 },
      ],
      seq: 6,
      comments: [
        { text: 'Consider making "Tokenize + Onboard" a preset — saves multiple separate clicks', pageUrl: SERVE, ox: 0.52, oy: 0.32, selector: '[data-mode="onboard"]' },
      ],
    })
  }
  {
    const d = new Date('2026-07-26T16:00:00Z')
    insertMockSession({
      testerName: 'Marcus Lee', personaName: 'Data Engineering Lead', sessionType: 'human',
      scenarioTitle: 'Spin up a variant from an earlier version',
      startDate: d, endOffsetMs: 5.5 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Find Provider Directory Sync version history', d, 6000),
        clk('[data-config="provider-directory"]', 'Opened "Provider Directory Sync"', d, 14000),
        clk('[data-tab="versions"]', 'Opened version history', d, 28000),
        clk('[data-version="1"]', 'Selected version 1', d, 45000),
        tdone(0, d, 47000),
        tstart(1, 'Clone from version 1', d, 50000),
        clk('button.clone', 'Clicked "Clone this version"', d, 68000),
        clk('button.confirm-clone', 'Confirmed clone', d, 95000),
        tdone(1, d, 98000),
      ],
      tasks: [
        { completed: true, timeMs: 41000, clickCount: 3 },
        { completed: true, timeMs: 51000, clickCount: 2 },
      ],
      seq: 7, note: 'Version history and clone were exactly where I expected.',
      comments: [],
    })
  }

  // ── Priya Kaur ─────────────────────────────────────────────────────────────
  {
    const d = new Date('2026-07-29T10:00:00Z')
    insertMockSession({
      testerName: 'Priya Kaur', personaName: 'Research Coordinator', sessionType: 'human',
      scenarioTitle: 'Onboard a new patient file, and give a partner access',
      startDate: d, endOffsetMs: 15 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Create a configuration', d, 12000),
        clk('.config-item', 'Clicked an existing config by mistake', d, 25000),
        clk('button.back', 'Went back to the list', d, 55000),
        clk('button.new-config', 'Found "New Configuration"', d, 78000),
        clk('input[name="name"]', 'Typed name', d, 105000),
        clk('[data-mode="tokenize"]', 'Enabled Tokenize', d, 142000),
        clk('[data-mode="onboard"]', 'Found and enabled Onboard', d, 198000),
        clk('button.save', 'Saved', d, 245000),
        tdone(0, d, 248000),
        tstart(1, 'Give BluePeak Payer access', d, 255000),
        clk('[data-tab="settings"]', 'Tried Settings tab first', d, 280000),
        clk('[data-tab="onboard"]', 'Tried Onboard tab', d, 318000),
        clk('[data-tab="access"]', 'Found Access tab', d, 362000),
        clk('button.add-partner', 'Clicked Add partner', d, 428000),
        clk('[data-partner="bluepeak"]', 'Selected BluePeak', d, 495000),
        clk('button.confirm', 'Confirmed', d, 538000),
        tdone(1, d, 542000),
      ],
      tasks: [
        { completed: true, timeMs: 236000, clickCount: 6 },
        { completed: true, timeMs: 294000, clickCount: 7 },
      ],
      seq: 3,
      note: 'Very confusing — I didn\'t know what "tokenize" meant vs "onboard". Took a while to find the access section.',
      comments: [
        { text: '"Tokenize" — what does this mean? Is there a tooltip or glossary?', pageUrl: SERVE, ox: 0.4, oy: 0.38, selector: '[data-mode="tokenize"]' },
        { text: '"Onboard" is not how my team describes this — we call it "submit" or "upload"', pageUrl: SERVE, ox: 0.4, oy: 0.44, selector: '[data-mode="onboard"]' },
        { text: 'I tried Settings and Onboard tabs before Access — maybe the tab should be more prominent?', pageUrl: SERVE, ox: 0.62, oy: 0.55, selector: '[data-tab="access"]' },
      ],
    })
  }
  {
    const d = new Date('2026-07-29T14:00:00Z')
    insertMockSession({
      testerName: 'Priya Kaur', personaName: 'Research Coordinator', sessionType: 'human',
      scenarioTitle: 'Poke around',
      startDate: d, endOffsetMs: 4 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        clk('.config-item', 'Opened first configuration', d, 18000),
        clk('[data-tab="onboard"]', 'Explored Onboard tab', d, 38000),
        clk('[data-tab="access"]', 'Explored Access tab', d, 65000),
        clk('button.back', 'Back to list', d, 92000),
        clk('.config-item:nth-child(2)', 'Opened a second configuration', d, 112000),
        clk('[data-tab="versions"]', 'Explored version history', d, 138000),
      ],
      tasks: [], seq: undefined,
      comments: [
        { text: 'Would love to see "last modified by" on each config row in the list', pageUrl: SERVE, ox: 0.5, oy: 0.28, selector: '.config-item' },
        { text: 'Version timestamps in ISO format are hard to read — can these be relative like "2 days ago"?', pageUrl: SERVE, ox: 0.5, oy: 0.6, selector: '[data-tab="versions"]' },
      ],
    })
  }

  // ── Sam Torres ─────────────────────────────────────────────────────────────
  {
    const d = new Date('2026-07-25T13:00:00Z')
    insertMockSession({
      testerName: 'Sam Torres', sessionType: 'human',
      scenarioTitle: 'Extend a tokenize-only config to also onboard',
      startDate: d, endOffsetMs: 9 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Find Rx Claims Dedup and add Onboard', d, 8000),
        clk('input[type="search"]', 'Searched for "Rx Claims"', d, 22000),
        clk('.config-item', 'Opened the config', d, 38000),
        clk('[data-tab="settings"]', 'Opened Settings', d, 55000),
        clk('[data-mode="onboard"]', 'Enabled Onboard', d, 88000),
        clk('button.save', 'Saved', d, 115000),
        tdone(0, d, 118000),
      ],
      tasks: [{ completed: true, timeMs: 110000, clickCount: 5 }],
      seq: 5,
      comments: [
        { text: 'The search bar is very helpful here — without it I would have scrolled the whole list', pageUrl: SERVE, ox: 0.5, oy: 0.15, selector: 'input[type="search"]' },
      ],
    })
  }
  {
    const d = new Date('2026-07-28T10:30:00Z')
    insertMockSession({
      testerName: 'Sam Torres', sessionType: 'human',
      scenarioTitle: 'Spin up a variant from an earlier version',
      startDate: d, endOffsetMs: undefined,
      path: [
        nav('Opened Configurations list', d, 0),
        clk('.config-item', 'Opened "Provider Directory Sync"', d, 18000),
        clk('[data-tab="settings"]', 'Opened Settings', d, 35000),
        clk('[data-tab="onboard"]', 'Looked at Onboard tab', d, 58000),
        clk('[data-tab="versions"]', 'Found Version History', d, 95000),
      ],
      tasks: [], seq: undefined, comments: [],
    })
  }

  // ── Jordan Kim ─────────────────────────────────────────────────────────────
  {
    const d = new Date('2026-08-04T09:00:00Z')
    insertMockSession({
      testerName: 'Jordan Kim', personaName: 'Data Engineering Lead', sessionType: 'human',
      scenarioTitle: 'Onboard a new patient file, and give a partner access',
      startDate: d, endOffsetMs: 8 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Create tokenize + onboard config', d, 5000),
        clk('button.new-config', 'New Configuration', d, 14000),
        clk('input[name="name"]', 'Named it', d, 30000),
        clk('[data-mode="tokenize"]', 'Tokenize', d, 48000),
        clk('[data-mode="onboard"]', 'Onboard', d, 62000),
        clk('button.save', 'Saved', d, 88000),
        tdone(0, d, 90000),
        tstart(1, 'Give BluePeak access', d, 95000),
        clk('[data-tab="access"]', 'Access tab', d, 108000),
        clk('button.add-partner', 'Add partner', d, 122000),
        clk('[data-partner="bluepeak"]', 'BluePeak Payer', d, 135000),
        clk('button.confirm', 'Grant access', d, 148000),
        tdone(1, d, 150000),
      ],
      tasks: [
        { completed: true, timeMs: 85000, clickCount: 5 },
        { completed: true, timeMs: 58000, clickCount: 4 },
      ],
      seq: 7,
      comments: [
        { text: 'Clean flow overall. Tokenize and Onboard options could use brief tooltips explaining what each does.', pageUrl: SERVE, ox: 0.42, oy: 0.4, selector: '[data-mode="tokenize"]' },
      ],
    })
  }
  {
    const d = new Date('2026-08-05T14:00:00Z')
    insertMockSession({
      testerName: 'Jordan Kim', personaName: 'Data Engineering Lead', sessionType: 'human',
      scenarioTitle: 'Fix onboarding mapping problems',
      startDate: d, endOffsetMs: 11 * 60000,
      path: [
        nav('Opened Configurations list', d, 0),
        tstart(0, 'Find Oncology Registry Onboarding', d, 8000),
        clk('.config-item', 'Found and opened the config', d, 22000),
        clk('[data-tab="onboard"]', 'Opened Onboard tab', d, 40000),
        tdone(0, d, 42000),
        tstart(1, 'Fix mapping problems', d, 48000),
        clk('.column-mapping', 'Reviewed column mappings', d, 68000),
        clk('[data-status="unmapped"]', 'Found unmapped column', d, 92000),
        clk('[data-action="map"]', 'Mapped it', d, 118000),
        clk('[data-status="dropped"]', 'Found dropped column', d, 148000),
        clk('[data-action="map"]', 'Fixed it', d, 172000),
        clk('button.save', 'Saved', d, 195000),
        tdone(1, d, 198000),
      ],
      tasks: [
        { completed: true, timeMs: 34000, clickCount: 2 },
        { completed: true, timeMs: 150000, clickCount: 6 },
      ],
      seq: 5,
      note: 'Distinction between "unmapped" and "dropped" wasn\'t immediately clear.',
      comments: [
        { text: 'A "Fix all unmapped" bulk action would save a lot of clicks here', pageUrl: SERVE, ox: 0.5, oy: 0.5, selector: '.column-mapping-list' },
      ],
    })
  }

  g.__argusSeeded = true
}

try { seedMockSessions() } catch (e) { console.error('Mock session seed failed:', e) }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string { return new Date().toISOString() }

function j<T>(v: unknown): T { return (typeof v === 'string' ? JSON.parse(v) : v) as T }
function js(v: unknown): string { return JSON.stringify(v) }

// ─── Project ─────────────────────────────────────────────────────────────────

const projectStmts = {
  findMany:     db.prepare(`SELECT * FROM "Project" ORDER BY "createdAt" DESC`),
  findById:     db.prepare(`SELECT * FROM "Project" WHERE "id" = ?`),
  insert:       db.prepare(`INSERT INTO "Project"("id","name","description","uploadPath","entryPath","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?)`),
  update:       db.prepare(`UPDATE "Project" SET "name"=?,"description"=?,"uploadPath"=?,"entryPath"=?,"updatedAt"=? WHERE "id"=?`),
  delete:       db.prepare(`DELETE FROM "Project" WHERE "id"=?`),
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

const scenarioStmts = {
  findByProject: db.prepare(`SELECT * FROM "Scenario" WHERE "projectId"=? ORDER BY "order" ASC, "createdAt" ASC`),
  findById:      db.prepare(`SELECT * FROM "Scenario" WHERE "id"=?`),
  insert:        db.prepare(`INSERT INTO "Scenario"("id","projectId","title","description","brief","startScreen","successCriteria","tasks","order","role","persona","optional","freeform","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  update:        db.prepare(`UPDATE "Scenario" SET "title"=?,"description"=?,"brief"=?,"startScreen"=?,"successCriteria"=?,"tasks"=?,"order"=?,"role"=?,"persona"=?,"optional"=?,"freeform"=? WHERE "id"=?`),
  delete:        db.prepare(`DELETE FROM "Scenario" WHERE "id"=?`),
  maxOrder:      db.prepare(`SELECT COALESCE(MAX("order"),0) as m FROM "Scenario" WHERE "projectId"=?`),
}

// ─── Persona ─────────────────────────────────────────────────────────────────

const personaStmts = {
  findByProject: db.prepare(`SELECT * FROM "Persona" WHERE "projectId"=? ORDER BY "createdAt" DESC`),
  findById:      db.prepare(`SELECT * FROM "Persona" WHERE "id"=?`),
  insert:        db.prepare(`INSERT INTO "Persona"("id","projectId","name","description","aids","role","goals","techComfort","isPrebuilt","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?)`),
  delete:        db.prepare(`DELETE FROM "Persona" WHERE "id"=?`),
}

// ─── Session ─────────────────────────────────────────────────────────────────

const sessionStmts = {
  findByProject: db.prepare(`SELECT * FROM "Session" WHERE "projectId"=? ORDER BY "startedAt" DESC`),
  findById:      db.prepare(`SELECT * FROM "Session" WHERE "id"=?`),
  insert:        db.prepare(`INSERT INTO "Session"("id","projectId","scenarioId","personaId","testerName","path","startedAt","endedAt","type") VALUES (?,?,?,?,?,?,?,?,?)`),
  updatePath:    db.prepare(`UPDATE "Session" SET "path"=? WHERE "id"=?`),
  updateEnd:     db.prepare(`UPDATE "Session" SET "endedAt"=? WHERE "id"=?`),
  update:        db.prepare(`UPDATE "Session" SET "path"=?,"endedAt"=? WHERE "id"=?`),
}

// ─── TaskResult ───────────────────────────────────────────────────────────────

const taskResultStmts = {
  findBySession:  db.prepare(`SELECT * FROM "TaskResult" WHERE "sessionId"=? ORDER BY "taskIndex" ASC`),
  findByProject:  db.prepare(`SELECT tr.* FROM "TaskResult" tr INNER JOIN "Session" s ON tr."sessionId"=s."id" WHERE s."projectId"=? ORDER BY tr."taskIndex" ASC`),
  upsert:         db.prepare(`INSERT INTO "TaskResult"("id","sessionId","taskIndex","completed","rating","createdAt") VALUES (?,?,?,?,?,?) ON CONFLICT("id") DO UPDATE SET "completed"=excluded."completed","rating"=excluded."rating"`),
}

// ─── Comment ─────────────────────────────────────────────────────────────────

const commentStmts = {
  findBySession: db.prepare(`SELECT * FROM "Comment" WHERE "sessionId"=? ORDER BY "createdAt" ASC`),
  findByProject: db.prepare(`SELECT * FROM "Comment" WHERE "projectId"=? ORDER BY "createdAt" ASC`),
  insert:        db.prepare(`INSERT INTO "Comment"("id","sessionId","projectId","text","selector","rect","pageUrl","ox","oy","label","screen","scenarioId","createdAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`),
}

// ─── Check ────────────────────────────────────────────────────────────────────

const checkStmts = {
  findByProject: db.prepare(`SELECT * FROM "Check" WHERE "projectId"=? ORDER BY "createdAt" DESC`),
  insert:        db.prepare(`INSERT INTO "Check"("id","projectId","type","summary","results","createdAt") VALUES (?,?,?,?,?,?)`),
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function mapProject(r: Record<string, unknown>): Project {
  return { ...r, remoteBaseUrl: r.remoteBaseUrl ?? null } as unknown as Project
}

function mapScenario(r: Record<string, unknown>): Scenario {
  return {
    ...r,
    tasks: j<Task[]>(r.tasks),
    startScreen: r.startScreen ?? '',
    successCriteria: r.successCriteria ?? '',
    brief: r.brief ?? '',
    role: r.role ?? '',
    persona: r.persona ?? '',
    optional: Boolean(r.optional),
    freeform: Boolean(r.freeform),
    order: Number(r.order ?? 0),
  } as unknown as Scenario
}

function mapPersona(r: Record<string, unknown>): Persona {
  return {
    ...r,
    aids: j<string[]>(r.aids),
    role: r.role ?? '',
    goals: r.goals ?? '',
    techComfort: (r.techComfort as Persona['techComfort']) ?? 'medium',
    isPrebuilt: Boolean(r.isPrebuilt),
  } as unknown as Persona
}

function mapSession(r: Record<string, unknown>): Session {
  return {
    ...r,
    path: j<PathEvent[]>(r.path),
    scenarioId: r.scenarioId ?? null,
    personaId: r.personaId ?? null,
    endedAt: r.endedAt ?? null,
    type: (r.type as 'human' | 'bot') ?? 'human',
    videoUrl: r.videoUrl ?? null,
  } as unknown as Session
}

function mapTaskResult(r: Record<string, unknown>): TaskResult {
  return { ...r, completed: Boolean(r.completed), rating: j(r.rating) } as unknown as TaskResult
}

function mapComment(r: Record<string, unknown>): Comment {
  return { ...r, rect: j(r.rect) } as unknown as Comment
}

function mapCheck(r: Record<string, unknown>): Check {
  return { ...r, results: j<CheckIssue[]>(r.results) } as unknown as Check
}

// ─── Prisma-shaped client ─────────────────────────────────────────────────────

export const prisma = {
  project: {
    findMany(): Project[] {
      return (projectStmts.findMany.all() as Record<string, unknown>[]).map(mapProject)
    },
    findUnique({ where }: { where: { id: string } }): Project | null {
      const r = projectStmts.findById.get(where.id) as Record<string, unknown> | undefined
      return r ? mapProject(r) : null
    },
    create({ data }: { data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> }): Project {
      const id = createId(); const ts = now()
      projectStmts.insert.run(id, data.name, data.description ?? '', data.uploadPath ?? '', data.entryPath ?? 'index.html', ts, ts)
      return mapProject({ ...data, id, createdAt: ts, updatedAt: ts })
    },
    update({ where, data }: { where: { id: string }; data: Partial<Omit<Project, 'id' | 'createdAt'>> }): Project {
      const existing = prisma.project.findUnique({ where })!
      const merged = { ...existing, ...data }
      const ts = now()
      projectStmts.update.run(merged.name, merged.description, merged.uploadPath, merged.entryPath, ts, where.id)
      return mapProject({ ...merged, updatedAt: ts })
    },
  },

  scenario: {
    findMany({ where }: { where: { projectId: string } }): Scenario[] {
      return (scenarioStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapScenario)
    },
    findUnique({ where }: { where: { id: string } }): Scenario | null {
      const r = scenarioStmts.findById.get(where.id) as Record<string, unknown> | undefined
      return r ? mapScenario(r) : null
    },
    create({ data }: { data: Omit<Scenario, 'id' | 'createdAt'> }): Scenario {
      const id = createId(); const ts = now()
      const maxRow = scenarioStmts.maxOrder.get(data.projectId) as { m: number }
      const ord = data.order ?? (maxRow.m + 1)
      scenarioStmts.insert.run(
        id, data.projectId, data.title, data.description ?? '', data.brief ?? '',
        data.startScreen ?? '', data.successCriteria ?? '', js(data.tasks ?? []), ord,
        data.role ?? '', data.persona ?? '', data.optional ? 1 : 0, data.freeform ? 1 : 0, ts,
      )
      return { ...data, id, tasks: data.tasks ?? [], brief: data.brief ?? '', startScreen: data.startScreen ?? '', successCriteria: data.successCriteria ?? '', role: data.role ?? '', persona: data.persona ?? '', optional: Boolean(data.optional), freeform: Boolean(data.freeform), order: ord, createdAt: ts }
    },
    update({ where, data }: { where: { id: string }; data: Partial<Omit<Scenario, 'id' | 'projectId' | 'createdAt'>> }): Scenario {
      const existing = prisma.scenario.findUnique({ where })!
      const merged = { ...existing, ...data }
      scenarioStmts.update.run(
        merged.title, merged.description ?? '', merged.brief ?? '',
        merged.startScreen ?? '', merged.successCriteria ?? '', js(merged.tasks ?? []), merged.order ?? 0,
        merged.role ?? '', merged.persona ?? '', merged.optional ? 1 : 0, merged.freeform ? 1 : 0,
        where.id,
      )
      return merged
    },
    delete({ where }: { where: { id: string } }) {
      scenarioStmts.delete.run(where.id)
    },
  },

  persona: {
    findMany({ where }: { where: { projectId: string } }): Persona[] {
      return (personaStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapPersona)
    },
    findUnique({ where }: { where: { id: string } }): Persona | null {
      const r = personaStmts.findById.get(where.id) as Record<string, unknown> | undefined
      return r ? mapPersona(r) : null
    },
    create({ data }: { data: Omit<Persona, 'id' | 'createdAt'> }): Persona {
      const id = createId(); const ts = now()
      personaStmts.insert.run(id, data.projectId, data.name, data.description ?? '', js(data.aids ?? []), data.role ?? '', data.goals ?? '', data.techComfort ?? 'medium', data.isPrebuilt ? 1 : 0, ts)
      return { ...data, id, aids: data.aids ?? [], role: data.role ?? '', goals: data.goals ?? '', techComfort: data.techComfort ?? 'medium', isPrebuilt: Boolean(data.isPrebuilt), createdAt: ts }
    },
    delete({ where }: { where: { id: string } }) {
      personaStmts.delete.run(where.id)
    },
  },

  session: {
    findMany({ where }: { where: { projectId: string } }): Session[] {
      return (sessionStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapSession)
    },
    findUnique({ where }: { where: { id: string } }): Session | null {
      const r = sessionStmts.findById.get(where.id) as Record<string, unknown> | undefined
      return r ? mapSession(r) : null
    },
    create({ data }: { data: Omit<Session, 'id' | 'startedAt' | 'path' | 'taskResults' | 'comments'> & { path?: PathEvent[] } }): Session {
      const id = createId(); const ts = now()
      sessionStmts.insert.run(id, data.projectId, data.scenarioId ?? null, data.personaId ?? null, data.testerName ?? 'Anonymous', js(data.path ?? []), ts, data.endedAt ?? null, data.type ?? 'human')
      return { projectId: data.projectId, scenarioId: data.scenarioId ?? null, personaId: data.personaId ?? null, testerName: data.testerName ?? 'Anonymous', path: data.path ?? [], endedAt: data.endedAt ?? null, type: data.type ?? 'human', videoUrl: data.videoUrl ?? null, id, startedAt: ts }
    },
    update({ where, data }: { where: { id: string }; data: Partial<Pick<Session, 'path' | 'endedAt'>> }): Session {
      const existing = prisma.session.findUnique({ where })!
      const updated = { ...existing, ...data }
      sessionStmts.update.run(js(updated.path), updated.endedAt ?? null, where.id)
      return updated
    },
  },

  taskResult: {
    findMany({ where }: { where: { sessionId?: string; projectId?: string } }): TaskResult[] {
      if (where.sessionId) return (taskResultStmts.findBySession.all(where.sessionId) as Record<string, unknown>[]).map(mapTaskResult)
      if (where.projectId) return (taskResultStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapTaskResult)
      return []
    },
    upsert({ where, create, update }: { where: { id: string }; create: Omit<TaskResult, 'id' | 'createdAt'>; update: Partial<TaskResult> }): TaskResult {
      const id = where.id || createId(); const ts = now()
      const data = { ...create, ...update }
      taskResultStmts.upsert.run(id, data.sessionId!, data.taskIndex!, data.completed ? 1 : 0, js(data.rating ?? {}), ts)
      return { ...data, id, completed: Boolean(data.completed), createdAt: ts } as TaskResult
    },
    create({ data }: { data: Omit<TaskResult, 'id' | 'createdAt'> }): TaskResult {
      const id = createId(); const ts = now()
      taskResultStmts.upsert.run(id, data.sessionId, data.taskIndex, data.completed ? 1 : 0, js(data.rating ?? {}), ts)
      return { ...data, id, completed: Boolean(data.completed), createdAt: ts }
    },
  },

  comment: {
    findMany({ where }: { where: { sessionId?: string; projectId?: string } }): Comment[] {
      if (where.sessionId) return (commentStmts.findBySession.all(where.sessionId) as Record<string, unknown>[]).map(mapComment)
      if (where.projectId) return (commentStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapComment)
      return []
    },
    create({ data }: { data: Omit<Comment, 'id' | 'createdAt'> }): Comment {
      const id = createId(); const ts = now()
      commentStmts.insert.run(
        id, data.sessionId, data.projectId, data.text,
        data.selector ?? '', js(data.rect ?? {}), data.pageUrl ?? '',
        data.ox ?? null, data.oy ?? null, data.label ?? '', data.screen ?? '',
        data.scenarioId ?? null, ts,
      )
      return { ...data, id, createdAt: ts }
    },
  },

  check: {
    findMany({ where }: { where: { projectId: string } }): Check[] {
      return (checkStmts.findByProject.all(where.projectId) as Record<string, unknown>[]).map(mapCheck)
    },
    create({ data }: { data: Omit<Check, 'id' | 'createdAt'> }): Check {
      const id = createId(); const ts = now()
      checkStmts.insert.run(id, data.projectId, data.type, data.summary ?? '', js(data.results ?? []), ts)
      return { ...data, id, createdAt: ts }
    },
  },
}
