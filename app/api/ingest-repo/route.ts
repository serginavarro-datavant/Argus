import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function POST(request: Request) {
  const body = await request.json()
  const { repoUrl, name, description } = body

  if (!repoUrl) return NextResponse.json({ error: 'Missing repoUrl' }, { status: 400 })

  const project = db.projects.create({
    name: name ?? repoUrl.split('/').pop() ?? 'Repo',
    description: description ?? repoUrl,
    uploadPath: '',
    entryPath: 'index.html',
  })

  const cloneDir = path.join(process.cwd(), 'data', 'uploads', project.id)
  fs.mkdirSync(cloneDir, { recursive: true })

  try {
    execSync(`git clone --depth 1 ${repoUrl} ${cloneDir}`, { timeout: 60000, stdio: 'pipe' })
  } catch (err) {
    return NextResponse.json({ error: 'Clone failed', detail: String(err) }, { status: 500 })
  }

  // Try to build if package.json exists
  if (fs.existsSync(path.join(cloneDir, 'package.json'))) {
    try {
      execSync('npm install && npm run build', { cwd: cloneDir, timeout: 120000, stdio: 'pipe' })
      // Look for built output
      const candidates = ['dist', 'build', 'out', '.next']
      for (const c of candidates) {
        if (fs.existsSync(path.join(cloneDir, c, 'index.html'))) {
          db.projects.create // can't update inline, patch db directly
          const dbPath = path.join(process.cwd(), 'data', 'db.json')
          const raw = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
          const idx = raw.projects.findIndex((p: { id: string }) => p.id === project.id)
          if (idx !== -1) {
            raw.projects[idx].uploadPath = c
            raw.projects[idx].entryPath = 'index.html'
          }
          fs.writeFileSync(dbPath, JSON.stringify(raw, null, 2))
          break
        }
      }
    } catch {}
  }

  return NextResponse.json(project)
}
