import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.session.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const session = prisma.session.create({
    data: {
      projectId: body.projectId,
      scenarioId: body.scenarioId ?? null,
      personaId: body.personaId ?? null,
      testerName: body.testerName ?? 'Anonymous',
      endedAt: null,
      type: 'human',
      videoUrl: null,
    },
  })
  return NextResponse.json(session)
}
