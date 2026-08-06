import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  return NextResponse.json(prisma.project.findMany())
}
