import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(db.sessions.list(projectId))
}

export async function POST(request: Request) {
  const body = await request.json()
  const session = db.sessions.create({
    projectId: body.projectId,
    scenarioId: body.scenarioId ?? null,
    testerName: body.testerName ?? 'Anonymous',
    events: [],
    endedAt: null,
    completedTasks: [],
  })
  return NextResponse.json(session)
}
