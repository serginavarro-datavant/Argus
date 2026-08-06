import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const projectId = searchParams.get('projectId')
  if (sessionId) return NextResponse.json(prisma.comment.findMany({ where: { sessionId } }))
  if (projectId) return NextResponse.json(prisma.comment.findMany({ where: { projectId } }))
  return NextResponse.json({ error: 'Missing sessionId or projectId' }, { status: 400 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const comment = prisma.comment.create({
    data: {
      sessionId: body.sessionId,
      projectId: body.projectId,
      text: body.text,
      selector: body.selector ?? '',
      rect: body.rect ?? { x: 0, y: 0, width: 0, height: 0 },
      pageUrl: body.pageUrl ?? '',
      ox: body.ox ?? null,
      oy: body.oy ?? null,
      label: body.label ?? '',
      screen: body.screen ?? '',
      scenarioId: body.scenarioId ?? null,
    },
  })
  return NextResponse.json(comment)
}
