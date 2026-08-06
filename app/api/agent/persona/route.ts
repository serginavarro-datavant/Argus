// POST /api/agent/persona
// Body: { personaId, scenarioId, projectId }
// Claude simulates the persona walking through the scenario and saves it as a bot Session.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { anthropic } from '@/lib/anthropic'
import { extractScreenMap } from '@/lib/extract'
import type { PathEvent } from '@/lib/db'

export async function POST(request: Request) {
  const body = await request.json()
  const { personaId, scenarioId, projectId } = body

  if (!projectId || !personaId || !scenarioId) {
    return NextResponse.json({ error: 'Missing personaId, scenarioId, or projectId' }, { status: 400 })
  }

  const project = prisma.project.findUnique({ where: { id: projectId } })
  const persona = prisma.persona.findUnique({ where: { id: personaId } })
  const scenario = prisma.scenario.findUnique({ where: { id: scenarioId } })

  if (!project || !persona || !scenario) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }

  const { summary: screenMap } = extractScreenMap(projectId, project.uploadPath ?? '', project.entryPath ?? 'index.html')
  const baseUrl = `http://localhost:3000/serve/${projectId}/${project.entryPath ?? 'index.html'}`
  const startTime = new Date().toISOString()

  const prompt = `You are simulating a usability test session. Embody the persona below and attempt each task in the scenario.

## Persona
Name: ${persona.name}
Role: ${persona.role}
Goals: ${persona.goals}
Tech comfort: ${persona.techComfort}
Description: ${persona.description}

## Scenario
Title: ${scenario.title}
Brief: ${scenario.brief}
Tasks:
${scenario.tasks.map((t, i) => `${i + 1}. ${t.title} — ${t.description}`).join('\n')}

## Prototype screen map
${screenMap}

## Simulation rules
- Low tech comfort: confused by jargon, takes exploratory wrong turns, slower, may fail tasks
- Medium: mostly finds the right path with some hesitation
- High: efficient, direct, completes quickly
- Generate realistic path events: navigation first, then clicks. Use plausible CSS selectors.
- For each task, decide if completed and estimate real elapsed time in ms
- Identify 2–3 confusion points as comments (what the persona was confused about)
- Start timestamps from: ${startTime}

Return ONLY valid JSON (no markdown fences):
{
  "pathEvents": [
    { "type": "navigation", "url": "${baseUrl}", "label": "Opened Configurations list", "timestamp": "ISO" },
    { "type": "task_start", "taskIndex": 0, "label": "task title", "timestamp": "ISO" },
    { "type": "click", "selector": ".btn", "label": "what they clicked", "timestamp": "ISO" },
    { "type": "task_complete", "taskIndex": 0, "timestamp": "ISO" }
  ],
  "taskResults": [
    { "taskIndex": 0, "completed": true, "timeMs": 45000, "clickCount": 5 }
  ],
  "seq": 4,
  "sessionNote": "one sentence summary",
  "confusionPoints": [
    { "text": "what confused them", "pageUrl": "${baseUrl}", "selector": ".element", "ox": 0.5, "oy": 0.4 }
  ]
}`

  let parsed: {
    pathEvents?: PathEvent[]
    taskResults?: Array<{ taskIndex: number; completed: boolean; timeMs: number; clickCount: number }>
    seq?: number
    sessionNote?: string
    confusionPoints?: Array<{ text: string; pageUrl: string; selector: string; ox: number; oy: number }>
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
  } catch (err) {
    return NextResponse.json({ error: 'AI simulation failed', detail: String(err) }, { status: 500 })
  }

  const session = prisma.session.create({
    data: {
      projectId,
      scenarioId,
      personaId,
      testerName: `${persona.name} (AI)`,
      path: parsed.pathEvents ?? [],
      endedAt: new Date().toISOString(),
      type: 'bot',
      videoUrl: null,
    },
  })

  for (const tr of parsed.taskResults ?? []) {
    prisma.taskResult.create({
      data: {
        sessionId: session.id,
        taskIndex: tr.taskIndex,
        completed: tr.completed,
        rating: { timeMs: tr.timeMs, clickCount: tr.clickCount } as Record<string, unknown>,
      },
    })
  }

  if (parsed.seq !== undefined) {
    prisma.taskResult.create({
      data: {
        sessionId: session.id,
        taskIndex: -1,
        completed: true,
        rating: { seq: parsed.seq, note: parsed.sessionNote ?? '' } as Record<string, unknown>,
      },
    })
  }

  for (const cp of parsed.confusionPoints ?? []) {
    prisma.comment.create({
      data: {
        sessionId: session.id,
        projectId,
        text: cp.text,
        selector: cp.selector ?? '',
        rect: { x: 0, y: 0, width: 0, height: 0 },
        pageUrl: cp.pageUrl ?? baseUrl,
        ox: cp.ox ?? 0.5,
        oy: cp.oy ?? 0.5,
        label: '',
        screen: cp.pageUrl ?? baseUrl,
        scenarioId,
      },
    })
  }

  return NextResponse.json(session)
}
