import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function POST(request: Request) {
  const body = await request.json()
  const { repoUrl, name, description } = body

  if (!repoUrl) return NextResponse.json({ error: 'Missing repoUrl' }, { status: 400 })

  const project = prisma.project.create({
    data: {
      name: name ?? repoUrl.split('/').pop() ?? 'Repo',
      description: description ?? repoUrl,
      uploadPath: '',
      entryPath: 'index.html',
    },
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
      const candidates = ['dist', 'build', 'out', '.next']
      for (const c of candidates) {
        if (fs.existsSync(path.join(cloneDir, c, 'index.html'))) {
          prisma.project.update({
            where: { id: project.id },
            data: { uploadPath: c, entryPath: 'index.html' },
          })
          break
        }
      }
    } catch {}
  }

  return NextResponse.json(project)
}
