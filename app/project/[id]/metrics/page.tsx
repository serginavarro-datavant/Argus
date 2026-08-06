import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import MetricsView from './MetricsView'

export default async function MetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions     = prisma.session.findMany({ where: { projectId: id } })
  const scenarios    = prisma.scenario.findMany({ where: { projectId: id } })
  const taskResults  = prisma.taskResult.findMany({ where: { projectId: id } })

  return <MetricsView sessions={sessions} scenarios={scenarios} taskResults={taskResults} />
}
