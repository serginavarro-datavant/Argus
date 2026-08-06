import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { formatDate, elapsed } from '@/lib/utils'
import Link from 'next/link'

const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions   = prisma.session.findMany({ where: { projectId: id } })
  const scenarios  = prisma.scenario.findMany({ where: { projectId: id } })
  const comments   = prisma.comment.findMany({ where: { projectId: id } })

  const scenarioMap = Object.fromEntries(scenarios.map(s => [s.id, s]))
  const commentsBySession = new Map<string, number>()
  for (const c of comments) {
    commentsBySession.set(c.sessionId, (commentsBySession.get(c.sessionId) ?? 0) + 1)
  }

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sessions</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Link
          href={`/t/${id}`}
          target="_blank"
          className="text-sm font-medium text-white px-4 py-2 rounded-lg"
          style={{ background: '#5046e5' }}
        >
          ▶ Start session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#3a3a52" strokeWidth="1.5"/>
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#3a3a52" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">No sessions yet</p>
            <p className="text-sm mt-1" style={{ color: S.muted }}>Share the test link to start collecting sessions.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                {['Tester', 'Scenario', 'Started', 'Duration', 'Events', 'Comments', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: S.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const scenario = s.scenarioId ? scenarioMap[s.scenarioId] : null
                const commentCount = commentsBySession.get(s.id) ?? 0
                const navEvents = s.path.filter(e => e.type === 'navigation').length
                const clickEvents = s.path.filter(e => e.type === 'click').length
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: `1px solid ${S.border}`,
                      background: i % 2 === 0 ? S.surface : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: USER_COLORS[i % USER_COLORS.length] }}
                        >
                          {s.testerName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium" style={{ color: '#e0e7ff' }}>{s.testerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {scenario
                        ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(80,70,229,0.15)', color: '#818cf8' }}>{scenario.title}</span>
                        : <span style={{ color: S.dim }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.muted }}>{formatDate(s.startedAt)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.muted }}>
                      {s.endedAt ? elapsed(s.startedAt, s.endedAt) : <span style={{ color: '#fbbf24' }}>ongoing</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.muted }}>
                      {navEvents > 0 && <span className="mr-2">{navEvents} nav</span>}
                      {clickEvents > 0 && <span>{clickEvents} click{clickEvents !== 1 ? 's' : ''}</span>}
                      {navEvents === 0 && clickEvents === 0 && '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {commentCount > 0
                        ? <span style={{ color: '#a5b4fc' }}>📌 {commentCount}</span>
                        : <span style={{ color: S.dim }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: s.endedAt ? 'rgba(5,150,105,0.15)' : 'rgba(251,191,36,0.15)',
                          color: s.endedAt ? '#34d399' : '#fbbf24',
                        }}
                      >
                        {s.endedAt ? 'Done' : 'In progress'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
