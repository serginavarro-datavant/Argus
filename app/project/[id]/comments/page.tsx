import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import CommentsView from './CommentsView'

export default async function CommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions = prisma.session.findMany({ where: { projectId: id } })
  const comments = prisma.comment.findMany({ where: { projectId: id } })

  return <CommentsView project={project} sessions={sessions} comments={comments} />
}
