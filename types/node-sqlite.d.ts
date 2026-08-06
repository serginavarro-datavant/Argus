// Minimal type stubs for Node 24's built-in node:sqlite module.
// Replace with @types/node when it ships official declarations.
declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number
    lastInsertRowid: number | bigint
  }

  export interface StatementSync {
    run(...params: unknown[]): StatementResultingChanges
    get(...params: unknown[]): Record<string, unknown> | undefined
    all(...params: unknown[]): Record<string, unknown>[]
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean })
    open(): void
    close(): void
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}
