import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { anthropic } from '@/lib/anthropic'
import { extractScreenMap } from '@/lib/extract'
import { createId } from '@/lib/utils'
import type { Task } from '@/lib/db'

// POST /api/agent/scenarios
// Body: { projectId, targetUsers, mainGoal, toValidate, count? }
// Returns: proposed Scenario[] (NOT yet saved — caller saves after editing)
export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, targetUsers, mainGoal, toValidate, count = 3 } = body

  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const project = prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { summary } = extractScreenMap(projectId, project.uploadPath ?? '', project.entryPath ?? 'index.html')

  const prompt = `You are a senior UX researcher writing unmoderated user-test scenarios.

## Prototype screen map
${summary}

## Test brief
- Target users: ${targetUsers || 'general users'}
- Main goal: ${mainGoal || 'evaluate usability'}
- What to validate: ${toValidate || 'core flows'}

## Instructions
Write ${count} realistic test scenarios. Each scenario:
- Has a short, action-oriented title (≤8 words).
- Has a goal sentence (1–2 sentences): what the tester is trying to accomplish and why.
- Has a startScreen: the URL path or screen name where the tester should begin (e.g. "/" or "dashboard").
- Has successCriteria: one sentence describing what a successful completion looks like.
- Has 2–4 tasks. Each task:
  - title: short label (≤6 words)
  - description: phrased as a GOAL the tester achieves (WHAT to accomplish, never HOW to do it). ≤25 words.
  - hint: optional short tip shown if the tester is stuck (≤15 words). Omit if not useful.

Return ONLY a JSON array — no markdown fences, no explanation:
[{
  "title": "...",
  "description": "...",
  "startScreen": "...",
  "successCriteria": "...",
  "tasks": [{"title":"...","description":"...","hint":"..."}]
}]`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  let raw: Array<{
    title: string
    description: string
    startScreen?: string
    successCriteria?: string
    tasks: Array<{ title: string; description: string; hint?: string }>
  }> = []

  try {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    raw = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw: text }, { status: 500 })
  }

  const proposed = raw.map((s, i) => ({
    id: createId(),
    projectId,
    title: s.title ?? 'Untitled scenario',
    description: s.description ?? '',
    startScreen: s.startScreen ?? '/',
    successCriteria: s.successCriteria ?? '',
    order: i,
    tasks: (s.tasks ?? []).map((t): Task => ({
      id: createId(),
      title: t.title ?? '',
      description: t.description ?? '',
      ...(t.hint ? { hint: t.hint } : {}),
    })),
    createdAt: new Date().toISOString(),
  }))

  return NextResponse.json(proposed)
}
