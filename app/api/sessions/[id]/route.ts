import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PathEvent } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = db.sessions.get(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(session)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const session = db.sessions.get(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Partial<typeof session> = {}
  if (body.events !== undefined) {
    updates.events = [...session.events, ...(body.events as PathEvent[])]
  }
  if (body.endedAt !== undefined) updates.endedAt = body.endedAt
  if (body.completedTasks !== undefined) updates.completedTasks = body.completedTasks

  const updated = db.sessions.update(id, updates)
  return NextResponse.json(updated)
}
