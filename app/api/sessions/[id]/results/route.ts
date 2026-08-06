import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { PathEvent } from '@/lib/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const session = prisma.session.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Append task path events to the session path
  if (Array.isArray(body.path) && body.path.length > 0) {
    prisma.session.update({
      where: { id },
      data: { path: [...session.path, ...(body.path as PathEvent[])] },
    })
  }

  const result = prisma.taskResult.create({
    data: {
      sessionId: id,
      taskIndex: body.taskIndex ?? 0,
      completed: body.completed ?? false,
      rating: {
        ...(body.timeMs !== undefined ? { timeMs: body.timeMs } : {}),
        ...(body.rating ?? {}),
        ...(body.note ? { notes: body.note } : {}),
      },
    },
  })

  return NextResponse.json(result, { status: 201 })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(prisma.taskResult.findMany({ where: { sessionId: id } }))
}
