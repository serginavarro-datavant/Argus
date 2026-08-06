import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import SessionsView from './SessionsView'

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions    = prisma.session.findMany({ where: { projectId: id } })
  const scenarios   = prisma.scenario.findMany({ where: { projectId: id } })
  const comments    = prisma.comment.findMany({ where: { projectId: id } })
  const taskResults = prisma.taskResult.findMany({ where: { projectId: id } })

  return (
    <SessionsView
      projectId={id}
      sessions={sessions}
      scenarios={scenarios}
      comments={comments}
      taskResults={taskResults}
    />
  )
}
