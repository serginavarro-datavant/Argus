import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import PathsView from './PathsView'

export default async function PathsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions     = prisma.session.findMany({ where: { projectId: id } })
  const scenarios    = prisma.scenario.findMany({ where: { projectId: id } })
  const taskResults  = prisma.taskResult.findMany({ where: { projectId: id } })

  return <PathsView sessions={sessions} scenarios={scenarios} taskResults={taskResults} />
}
