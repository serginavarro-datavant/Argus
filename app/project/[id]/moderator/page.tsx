import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import ModeratorView from './ModeratorView'

export default async function ModeratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = db.projects.get(id)
  if (!project) notFound()

  const sessions = db.sessions.list(id)
  const scenarios = db.scenarios.list(id)
  const comments = db.comments.listByProject(id)

  return (
    <ModeratorView
      projectId={id}
      initialSessions={sessions}
      initialScenarios={scenarios}
      initialComments={comments}
    />
  )
}
