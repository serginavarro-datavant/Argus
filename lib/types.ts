export interface Project {
  id: string
  name: string
  description: string
  uploadPath: string
  entryPath: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
}

export interface Scenario {
  id: string
  projectId: string
  title: string
  description: string
  tasks: Task[]
  createdAt: string
}

export interface PathEvent {
  type: 'navigation' | 'click' | 'task_start' | 'task_complete'
  url?: string
  selector?: string
  taskIndex?: number
  timestamp: string
}

export interface Session {
  id: string
  projectId: string
  scenarioId: string | null
  testerName: string
  events: PathEvent[]
  startedAt: string
  endedAt: string | null
  completedTasks: number[]
}

export interface Comment {
  id: string
  sessionId: string
  projectId: string
  text: string
  selector: string
  rect: { x: number; y: number; width: number; height: number }
  pageUrl: string
  createdAt: string
}

export interface CheckIssue {
  severity: 'high' | 'medium' | 'low'
  description: string
  element?: string
}

export interface Check {
  id: string
  projectId: string
  type: 'a11y' | 'copy' | 'ds'
  summary: string
  issues: CheckIssue[]
  createdAt: string
}
