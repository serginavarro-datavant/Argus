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
  createdAt: string
  updatedAt: string
}

export interface Scenario {
  id: string
  projectId: string
  title: string
  description: string
  tasks: Task[]
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
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
  element?: string
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
  ]) {
    try { db.exec(stmt) } catch { /* column already exists */ }
  }
  return db
}

const g = globalThis as unknown as { __argusDb?: DatabaseSync }
if (!g.__argusDb) g.__argusDb = openDB()
const db = g.__argusDb

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
  findByProject: db.prepare(`SELECT * FROM "Scenario" WHERE "projectId"=? ORDER BY "createdAt" DESC`),
  findById:      db.prepare(`SELECT * FROM "Scenario" WHERE "id"=?`),
  insert:        db.prepare(`INSERT INTO "Scenario"("id","projectId","title","description","tasks","createdAt") VALUES (?,?,?,?,?,?)`),
  delete:        db.prepare(`DELETE FROM "Scenario" WHERE "id"=?`),
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
  findBySession: db.prepare(`SELECT * FROM "TaskResult" WHERE "sessionId"=? ORDER BY "taskIndex" ASC`),
  upsert:        db.prepare(`INSERT INTO "TaskResult"("id","sessionId","taskIndex","completed","rating","createdAt") VALUES (?,?,?,?,?,?) ON CONFLICT("id") DO UPDATE SET "completed"=excluded."completed","rating"=excluded."rating"`),
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
  return r as unknown as Project
}

function mapScenario(r: Record<string, unknown>): Scenario {
  return { ...r, tasks: j<Task[]>(r.tasks) } as unknown as Scenario
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
      scenarioStmts.insert.run(id, data.projectId, data.title, data.description ?? '', js(data.tasks ?? []), ts)
      return { ...data, id, tasks: data.tasks ?? [], createdAt: ts }
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
    findMany({ where }: { where: { sessionId: string } }): TaskResult[] {
      return (taskResultStmts.findBySession.all(where.sessionId) as Record<string, unknown>[]).map(mapTaskResult)
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
