import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { CheckIssue } from '@/lib/db'
import { runCopyCheck } from '@/lib/checks/copy'
import type { TextSample } from '@/lib/checks/copy'
import { runDSCheck } from '@/lib/checks/ds'
import type { StyleSample, FontSample } from '@/lib/checks/ds'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.check.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, type = 'a11y', summary: clientSummary, results: clientResults, texts, colors, fonts } = body as {
    projectId: string
    type: 'a11y' | 'copy' | 'ds'
    summary?: string
    results?: CheckIssue[]
    texts?: TextSample[]
    colors?: StyleSample[]
    fonts?: FontSample[]
  }
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  let summary: string
  let results: CheckIssue[]

  if (type === 'copy') {
    const r = await runCopyCheck(texts ?? [])
    summary = r.summary
    results = r.issues
  } else if (type === 'ds') {
    const r = runDSCheck(colors ?? [], fonts ?? [])
    summary = r.summary
    results = r.issues
  } else {
    summary = clientSummary ?? ''
    results = clientResults ?? []
  }

  const check = prisma.check.create({ data: { projectId, type, summary, results } })
  return NextResponse.json(check)
}
