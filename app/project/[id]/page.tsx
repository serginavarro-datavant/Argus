import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import DashboardView from './DashboardView'

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions     = prisma.session.findMany({ where: { projectId: id } })
  const scenarios    = prisma.scenario.findMany({ where: { projectId: id } })
  const checks       = prisma.check.findMany({ where: { projectId: id } })
  const comments     = prisma.comment.findMany({ where: { projectId: id } })
  const taskResults  = prisma.taskResult.findMany({ where: { projectId: id } })

  const serveUrl = `/serve/${id}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`

  return (
    <DashboardView
      project={project}
      sessions={sessions}
      scenarios={scenarios}
      comments={comments}
      taskResults={taskResults}
      checks={checks}
      serveUrl={serveUrl}
      projectId={id}
    />
  )
}
