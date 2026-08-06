import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import ModeratorView from './ModeratorView'

export default async function ModeratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions    = prisma.session.findMany({ where: { projectId: id } })
  const scenarios   = prisma.scenario.findMany({ where: { projectId: id } })
  const comments    = prisma.comment.findMany({ where: { projectId: id } })
  const taskResults = prisma.taskResult.findMany({ where: { projectId: id } })
  const personas    = prisma.persona.findMany({ where: { projectId: id } })

  return (
    <ModeratorView
      project={project}
      initialSessions={sessions}
      initialScenarios={scenarios}
      initialComments={comments}
      initialTaskResults={taskResults}
      initialPersonas={personas}
    />
  )
}
