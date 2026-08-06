#!/usr/bin/env node
// Runs the initial migration using Node 24's built-in node:sqlite.
// Replace with: npx prisma migrate dev  when the prisma CLI is installable.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

mkdirSync(join(root, 'data'), { recursive: true })

const db = new DatabaseSync(join(root, 'data', 'dev.db'))
db.exec('PRAGMA journal_mode=WAL;')
db.exec('PRAGMA foreign_keys=ON;')

const sql = readFileSync(
  join(root, 'prisma', 'migrations', '0001_init', 'migration.sql'),
  'utf8'
)

db.exec(sql)
console.log('✓ Migration applied: data/dev.db is ready')
db.close()
