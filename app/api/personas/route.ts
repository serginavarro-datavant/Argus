import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  return NextResponse.json(prisma.persona.findMany({ where: { projectId } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const persona = prisma.persona.create({
    data: {
      projectId: body.projectId,
      name: body.name ?? 'New persona',
      description: body.description ?? '',
      aids: body.aids ?? [],
      role: body.role ?? '',
      goals: body.goals ?? '',
      techComfort: body.techComfort ?? 'medium',
      isPrebuilt: false,
    },
  })
  return NextResponse.json(persona)
}
