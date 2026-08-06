// Re-export canonical types from lib/db.ts so existing imports keep working.
export type {
  Project,
  Scenario,
  Task,
  Persona,
  PathEvent,
  Session,
  TaskResult,
  Comment,
  CheckIssue,
  Check,
} from './db'
