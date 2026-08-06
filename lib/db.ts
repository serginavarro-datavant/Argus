import fs from 'fs'
import path from 'path'
import { createId } from './utils'
import type { Project, Scenario, Session, Comment, Check, PathEvent } from './types'

export type { Project, Scenario, Session, Comment, Check, PathEvent }

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

interface DBData {
  projects: Project[]
  scenarios: Scenario[]
  sessions: Session[]
  comments: Comment[]
  checks: Check[]
}

function readDB(): DBData {
  if (!fs.existsSync(DB_FILE)) {
    return { projects: [], scenarios: [], sessions: [], comments: [], checks: [] }
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  } catch {
    return { projects: [], scenarios: [], sessions: [], comments: [], checks: [] }
  }
}

function writeDB(data: DBData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

export const db = {
  projects: {
    list: (): Project[] => readDB().projects.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    get: (id: string): Project | undefined => readDB().projects.find(p => p.id === id),
    create: (data: Omit<Project, 'id' | 'createdAt'>): Project => {
      const store = readDB()
      const project: Project = { ...data, id: createId(), createdAt: new Date().toISOString() }
      store.projects.push(project)
      writeDB(store)
      return project
    },
  },

  scenarios: {
    list: (projectId: string): Scenario[] =>
      readDB().scenarios.filter(s => s.projectId === projectId),
    get: (id: string): Scenario | undefined => readDB().scenarios.find(s => s.id === id),
    create: (data: Omit<Scenario, 'id' | 'createdAt'>): Scenario => {
      const store = readDB()
      const scenario: Scenario = { ...data, id: createId(), createdAt: new Date().toISOString() }
      store.scenarios.push(scenario)
      writeDB(store)
      return scenario
    },
  },

  sessions: {
    list: (projectId: string): Session[] =>
      readDB().sessions
        .filter(s => s.projectId === projectId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    get: (id: string): Session | undefined => readDB().sessions.find(s => s.id === id),
    create: (data: Omit<Session, 'id' | 'startedAt'>): Session => {
      const store = readDB()
      const session: Session = { ...data, id: createId(), startedAt: new Date().toISOString() }
      store.sessions.push(session)
      writeDB(store)
      return session
    },
    update: (id: string, updates: Partial<Session>): Session | undefined => {
      const store = readDB()
      const idx = store.sessions.findIndex(s => s.id === id)
      if (idx === -1) return undefined
      store.sessions[idx] = { ...store.sessions[idx], ...updates }
      writeDB(store)
      return store.sessions[idx]
    },
  },

  comments: {
    list: (sessionId: string): Comment[] =>
      readDB().comments.filter(c => c.sessionId === sessionId),
    listByProject: (projectId: string): Comment[] =>
      readDB().comments.filter(c => c.projectId === projectId),
    create: (data: Omit<Comment, 'id' | 'createdAt'>): Comment => {
      const store = readDB()
      const comment: Comment = { ...data, id: createId(), createdAt: new Date().toISOString() }
      store.comments.push(comment)
      writeDB(store)
      return comment
    },
  },

  checks: {
    list: (projectId: string): Check[] =>
      readDB().checks
        .filter(c => c.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (data: Omit<Check, 'id' | 'createdAt'>): Check => {
      const store = readDB()
      const check: Check = { ...data, id: createId(), createdAt: new Date().toISOString() }
      store.checks.push(check)
      writeDB(store)
      return check
    },
  },
}
