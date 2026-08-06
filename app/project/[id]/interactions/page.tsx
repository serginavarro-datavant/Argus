import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { PathEvent } from '@/lib/types'
import InteractionsView from './InteractionsView'

interface ClickStat {
  key: string
  selector: string
  label: string
  role: string
  url: string
  totalClicks: number
  uniqueSessions: number
  sessionNames: string[]
}

export default async function InteractionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions = prisma.session.findMany({ where: { projectId: id } })
  const comments = prisma.comment.findMany({ where: { projectId: id } })
  const totalSessions = sessions.length

  // Aggregate click events across all sessions
  const clickMap = new Map<string, {
    selector: string; label: string; role: string; url: string
    totalClicks: number; sessionIds: Set<string>; sessionNames: string[]
  }>()

  for (const session of sessions) {
    const sessionClicks = new Set<string>()
    for (const ev of session.path as PathEvent[]) {
      if (ev.type !== 'click') continue
      const selector = ev.selector ?? ''
      const label = ev.label ?? ''
      const role = ev.role ?? ''
      const url = (ev.url ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
      const key = `${selector}|${label}|${role}|${url}`
      if (!clickMap.has(key)) {
        clickMap.set(key, { selector, label, role, url, totalClicks: 0, sessionIds: new Set(), sessionNames: [] })
      }
      const entry = clickMap.get(key)!
      entry.totalClicks++
      if (!sessionClicks.has(key)) {
        sessionClicks.add(key)
        entry.sessionIds.add(session.id)
        if (!entry.sessionNames.includes(session.testerName)) {
          entry.sessionNames.push(session.testerName)
        }
      }
    }
  }

  const stats: ClickStat[] = [...clickMap.entries()]
    .map(([key, v]) => ({ key, ...v, uniqueSessions: v.sessionIds.size, sessionIds: undefined } as unknown as ClickStat))
    .sort((a, b) => b.uniqueSessions - a.uniqueSessions || b.totalClicks - a.totalClicks)

  const totalClickEvents = stats.reduce((a, s) => a + s.totalClicks, 0)

  return (
    <InteractionsView
      sessions={sessions.map(s => ({ id: s.id, testerName: s.testerName, path: s.path as PathEvent[] }))}
      comments={comments}
      stats={stats}
      totalSessions={totalSessions}
      totalClickEvents={totalClickEvents}
    />
  )
}
