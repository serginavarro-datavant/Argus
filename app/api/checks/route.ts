import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { CheckIssue } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.check.findMany({ where: { projectId } }))
}

// POST: save a check with precomputed results from the client-side axe runner
export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, type = 'a11y', summary, results } = body as {
    projectId: string
    type: 'a11y' | 'copy' | 'ds'
    summary: string
    results: CheckIssue[]
  }
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  const check = prisma.check.create({
    data: { projectId, type, summary, results },
  })
  return NextResponse.json(check)
}
