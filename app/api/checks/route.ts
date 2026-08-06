import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runA11yCheck } from '@/lib/checks/a11y'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.check.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, type = 'a11y' } = body

  const project = prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const uploadsBase = path.join(process.cwd(), 'data', 'uploads', projectId)
  const subDir = project.uploadPath ? path.join(uploadsBase, project.uploadPath) : uploadsBase
  const entryFile = path.join(subDir, project.entryPath)

  let html = ''
  try {
    html = fs.existsSync(entryFile) ? fs.readFileSync(entryFile, 'utf-8') : ''
  } catch {}

  if (type === 'a11y') {
    const result = await runA11yCheck(html)
    const check = prisma.check.create({
      data: {
        projectId,
        type: 'a11y',
        summary: result.summary,
        results: result.issues,
      },
    })
    return NextResponse.json(check)
  }

  return NextResponse.json({ error: 'Unknown check type' }, { status: 400 })
}
