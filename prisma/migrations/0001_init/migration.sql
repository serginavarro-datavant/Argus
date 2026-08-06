-- Argus initial schema
-- Matches prisma/schema.prisma exactly.
-- Run manually via: node scripts/migrate.mjs
-- Or when prisma CLI is available: npx prisma migrate dev

CREATE TABLE IF NOT EXISTS "Project" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "uploadPath"  TEXT NOT NULL DEFAULT '',
  "entryPath"   TEXT NOT NULL DEFAULT 'index.html',
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS "Scenario" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "projectId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "tasks"       TEXT NOT NULL DEFAULT '[]',
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Persona" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "projectId"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "aids"        TEXT NOT NULL DEFAULT '[]',
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "projectId"   TEXT NOT NULL,
  "scenarioId"  TEXT,
  "personaId"   TEXT,
  "testerName"  TEXT NOT NULL DEFAULT 'Anonymous',
  "path"        TEXT NOT NULL DEFAULT '[]',
  "startedAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "endedAt"     TEXT,
  FOREIGN KEY ("projectId")  REFERENCES "Project"("id")  ON DELETE CASCADE,
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id"),
  FOREIGN KEY ("personaId")  REFERENCES "Persona"("id")
);

CREATE TABLE IF NOT EXISTS "TaskResult" (
  "id"        TEXT    NOT NULL PRIMARY KEY,
  "sessionId" TEXT    NOT NULL,
  "taskIndex" INTEGER NOT NULL,
  "completed" INTEGER NOT NULL DEFAULT 0,
  "rating"    TEXT    NOT NULL DEFAULT '{}',
  "createdAt" TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Comment" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "sessionId"  TEXT NOT NULL,
  "projectId"  TEXT NOT NULL,
  "text"       TEXT NOT NULL,
  "selector"   TEXT NOT NULL DEFAULT '',
  "rect"       TEXT NOT NULL DEFAULT '{}',
  "pageUrl"    TEXT NOT NULL DEFAULT '',
  "ox"         REAL,
  "oy"         REAL,
  "label"      TEXT NOT NULL DEFAULT '',
  "screen"     TEXT NOT NULL DEFAULT '',
  "scenarioId" TEXT,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")  ON DELETE CASCADE,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
);

CREATE TABLE IF NOT EXISTS "Check" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "summary"   TEXT NOT NULL DEFAULT '',
  "results"   TEXT NOT NULL DEFAULT '[]',
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS "Scenario_projectId"    ON "Scenario"("projectId");
CREATE INDEX IF NOT EXISTS "Persona_projectId"     ON "Persona"("projectId");
CREATE INDEX IF NOT EXISTS "Session_projectId"     ON "Session"("projectId");
CREATE INDEX IF NOT EXISTS "Session_scenarioId"    ON "Session"("scenarioId");
CREATE INDEX IF NOT EXISTS "TaskResult_sessionId"  ON "TaskResult"("sessionId");
CREATE INDEX IF NOT EXISTS "Comment_sessionId"     ON "Comment"("sessionId");
CREATE INDEX IF NOT EXISTS "Comment_projectId"     ON "Comment"("projectId");
CREATE INDEX IF NOT EXISTS "Check_projectId"       ON "Check"("projectId");
