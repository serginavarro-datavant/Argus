import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { PathEvent } from '@/lib/types'

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

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
  const totalSessions = sessions.length

  // Aggregate click events across all sessions
  const clickMap = new Map<string, {
    selector: string; label: string; role: string; url: string
    totalClicks: number; sessionIds: Set<string>; sessionNames: string[]
  }>()

  for (const session of sessions) {
    const sessionClicks = new Set<string>() // dedupe within session
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
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Interactions</h1>
        <p className="text-sm mt-0.5" style={{ color: S.muted }}>
          Elements clicked across {totalSessions} session{totalSessions !== 1 ? 's' : ''} — {totalClickEvents} total clicks
        </p>
      </div>

      {stats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 3L9 14L12 11L15 14L15 3" stroke="#3a3a52" strokeWidth="1.5" strokeLinejoin="round"/>
              <rect x="2" y="2" width="20" height="20" rx="3" stroke="#3a3a52" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">No interaction data yet</p>
            <p className="text-sm mt-1" style={{ color: S.muted }}>
              Click events will appear here once testers run sessions.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick summary strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Unique elements', value: stats.length },
              { label: 'Total click events', value: totalClickEvents },
              { label: 'Most-clicked', value: stats[0]?.label || stats[0]?.selector || '—' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="text-xl font-bold text-white truncate">{kpi.value}</div>
                <div className="text-xs mt-1" style={{ color: S.muted }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Click frequency table */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Click frequency</h2>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                    <th className="text-left px-4 py-2.5 font-medium w-6" style={{ color: S.muted }}>#</th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>Element</th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>Page</th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>Sessions</th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>Total clicks</th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>Heat</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, i) => {
                    const heatPct = totalSessions > 0 ? Math.round(stat.uniqueSessions / totalSessions * 100) : 0
                    const displayLabel = stat.label || stat.selector || `<${stat.role || 'element'}>`
                    return (
                      <tr
                        key={stat.key}
                        style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.surface : 'transparent' }}
                      >
                        <td className="px-4 py-3" style={{ color: S.dim }}>{i + 1}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium truncate" style={{ color: '#e0e7ff' }}>{displayLabel}</div>
                          {stat.selector && stat.selector !== displayLabel && (
                            <div className="text-[10px] font-mono truncate mt-0.5" style={{ color: S.dim }}>{stat.selector}</div>
                          )}
                          {stat.role && (
                            <div className="inline-block text-[9px] px-1.5 py-0.5 rounded mt-0.5" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                              {stat.role}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: '#6b7280' }}>{stat.url}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: '#a5b4fc' }}>{stat.uniqueSessions}</span>
                            <span style={{ color: S.dim }}>/ {totalSessions}</span>
                          </div>
                          {stat.sessionNames.length > 0 && (
                            <div className="text-[10px] mt-0.5 truncate" style={{ color: S.dim }}>
                              {stat.sessionNames.slice(0, 3).join(', ')}{stat.sessionNames.length > 3 ? ' +more' : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#e0e7ff' }}>{stat.totalClicks}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: S.border, width: 64 }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${heatPct}%`,
                                  background: heatPct >= 67 ? '#f97316' : heatPct >= 34 ? '#4f46e5' : '#4a4a6a',
                                }}
                              />
                            </div>
                            <span className="text-[10px]" style={{ color: heatPct >= 67 ? '#f97316' : S.dim }}>{heatPct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
