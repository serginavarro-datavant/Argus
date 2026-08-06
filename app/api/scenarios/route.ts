import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { anthropic } from '@/lib/anthropic'
import fs from 'fs'
import path from 'path'
import { createId } from '@/lib/utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.scenario.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, generate } = body

  const project = prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  if (!generate) {
    const scenario = prisma.scenario.create({
      data: {
        projectId,
        title: body.title ?? 'Untitled scenario',
        description: body.description ?? '',
        tasks: body.tasks ?? [],
      },
    })
    return NextResponse.json(scenario)
  }

  // AI generation — read entry HTML for context
  const uploadsBase = path.join(process.cwd(), 'data', 'uploads', projectId)
  const subDir = project.uploadPath ? path.join(uploadsBase, project.uploadPath) : uploadsBase
  const entryFile = path.join(subDir, project.entryPath)

  let html = ''
  try {
    html = fs.existsSync(entryFile) ? fs.readFileSync(entryFile, 'utf-8').slice(0, 8000) : ''
  } catch {}

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a UX researcher designing unmoderated user tests. Given this prototype HTML, generate 3 realistic test scenarios. Each scenario has a title, description, and 2–4 concrete tasks a tester must complete.

Return ONLY a JSON array with this exact shape — no markdown fences:
[{"title":"...","description":"...","tasks":[{"id":"t1","title":"...","description":"Step the tester should take, phrased as a goal not an instruction"}]}]

Prototype HTML (may be truncated):
${html || '(no HTML available — infer generic usability tasks)'}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  let scenarios: Array<{ title: string; description: string; tasks: Array<{ id: string; title: string; description: string }> }> = []
  try {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    scenarios = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw: text }, { status: 500 })
  }

  const created = scenarios.map(s =>
    prisma.scenario.create({
      data: {
        projectId,
        title: s.title,
        description: s.description,
        tasks: s.tasks.map(t => ({ ...t, id: createId() })),
      },
    })
  )

  return NextResponse.json(created)
}
