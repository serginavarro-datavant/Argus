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

const g = globalThis as unknown as { __argusDb?: DatabaseSync }
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
  insert:        db.prepare(`INSERT INTO "Persona"("id","projectId","name","description","aids","createdAt") VALUES (?,?,?,?,?,?)`),
  delete:        db.prepare(`DELETE FROM "Persona" WHERE "id"=?`),
}

// ─── Session ─────────────────────────────────────────────────────────────────

const sessionStmts = {
  findByProject: db.prepare(`SELECT * FROM "Session" WHERE "projectId"=? ORDER BY "startedAt" DESC`),
  findById:      db.prepare(`SELECT * FROM "Session" WHERE "id"=?`),
  insert:        db.prepare(`INSERT INTO "Session"("id","projectId","scenarioId","personaId","testerName","path","startedAt","endedAt") VALUES (?,?,?,?,?,?,?,?)`),
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
  return { ...r, aids: j<string[]>(r.aids) } as unknown as Persona
}

function mapSession(r: Record<string, unknown>): Session {
  return {
    ...r,
    path: j<PathEvent[]>(r.path),
    scenarioId: r.scenarioId ?? null,
    personaId: r.personaId ?? null,
    endedAt: r.endedAt ?? null,
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
      personaStmts.insert.run(id, data.projectId, data.name, data.description ?? '', js(data.aids ?? []), ts)
      return { ...data, id, aids: data.aids ?? [], createdAt: ts }
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
      sessionStmts.insert.run(id, data.projectId, data.scenarioId ?? null, data.personaId ?? null, data.testerName ?? 'Anonymous', js(data.path ?? []), ts, data.endedAt ?? null)
      return { projectId: data.projectId, scenarioId: data.scenarioId ?? null, personaId: data.personaId ?? null, testerName: data.testerName ?? 'Anonymous', path: data.path ?? [], endedAt: data.endedAt ?? null, id, startedAt: ts }
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
