import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { PathEvent } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = prisma.session.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(session)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const session = prisma.session.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: { path?: PathEvent[]; endedAt?: string | null } = {}
  if (body.events !== undefined) {
    updates.path = [...session.path, ...(body.events as PathEvent[])]
  }
  if (body.path !== undefined) {
    updates.path = [...session.path, ...(body.path as PathEvent[])]
  }
  if (body.endedAt !== undefined) updates.endedAt = body.endedAt

  const updated = prisma.session.update({ where: { id }, data: updates })
  return NextResponse.json(updated)
}
