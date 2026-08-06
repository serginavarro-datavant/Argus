import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const projectId = searchParams.get('projectId')
  if (sessionId) return NextResponse.json(db.comments.list(sessionId))
  if (projectId) return NextResponse.json(db.comments.listByProject(projectId))
  return NextResponse.json({ error: 'Missing sessionId or projectId' }, { status: 400 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const comment = db.comments.create({
    sessionId: body.sessionId,
    projectId: body.projectId,
    text: body.text,
    selector: body.selector ?? '',
    rect: body.rect ?? { x: 0, y: 0, width: 0, height: 0 },
    pageUrl: body.pageUrl ?? '',
  })
  return NextResponse.json(comment)
}
