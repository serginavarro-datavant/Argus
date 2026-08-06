import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.scenario.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId } = body
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  const scenario = prisma.scenario.create({
    data: {
      projectId,
      title: body.title ?? 'Untitled scenario',
      description: body.description ?? '',
      brief: body.brief ?? '',
      startScreen: body.startScreen ?? '',
      successCriteria: body.successCriteria ?? '',
      tasks: body.tasks ?? [],
      order: body.order,
      role: body.role ?? '',
      persona: body.persona ?? '',
      optional: body.optional ?? false,
      freeform: body.freeform ?? false,
    },
  })
  return NextResponse.json(scenario)
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const scenario = prisma.scenario.update({ where: { id }, data })
  return NextResponse.json(scenario)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  prisma.scenario.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
