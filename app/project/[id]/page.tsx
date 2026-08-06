import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import ChecksPanel from './ChecksPanel'
import type { CheckIssue } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreFromIssues(issues: CheckIssue[]): number {
  return Math.max(0, 100 - issues.reduce((a, i) => a + (i.severity === 'high' ? 10 : i.severity === 'medium' ? 5 : 2), 0))
}

function scoreColor(s: number) {
  if (s >= 80) return { text: '#22c55e', bg: 'rgba(34,197,94,0.1)', ring: 'rgba(34,197,94,0.3)' }
  if (s >= 60) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', ring: 'rgba(245,158,11,0.3)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)', ring: 'rgba(239,68,68,0.3)' }
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60 > 0 ? `${s % 60}s` : ''}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InsightCard({ label, value, sub, bar, barColor }: {
  label: string; value: string; sub: string; bar?: number | null; barColor?: string
}) {
  return (
    <div className="rounded-2xl px-4 py-3.5 flex flex-col justify-between" style={{ background: '#0c0c14', border: '1px solid #1c1c2b', minHeight: 90 }}>
      <div>
        <div className="text-xs font-medium" style={{ color: '#5c5c78' }}>{label}</div>
        <div className="text-xl font-bold text-white tabular-nums mt-0.5">{value}</div>
        <div className="text-xs mt-0.5" style={{ color: '#3a3a52' }}>{sub}</div>
      </div>
      {bar != null && (
        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: '#1c1c2b' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(bar, 100)}%`, background: barColor ?? '#4f46e5' }} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions  = prisma.session.findMany({ where: { projectId: id } })
  const scenarios = prisma.scenario.findMany({ where: { projectId: id } })
  const checks    = prisma.check.findMany({ where: { projectId: id } })
  const comments  = prisma.comment.findMany({ where: { projectId: id } })

  // ── Session metrics ───────────────────────────────────────────────────────
  const completedSessions = sessions.filter(s => s.endedAt)
  const completionRate    = sessions.length > 0
    ? Math.round((completedSessions.length / sessions.length) * 100)
    : null

  const durations = completedSessions
    .map(s => new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime())
    .filter(d => d > 2000 && d < 3_600_000)
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null

  const clicksPerSession = sessions.map(s => s.path.filter(e => e.type === 'click').length)
  const avgClicks = clicksPerSession.length > 0
    ? Math.round(clicksPerSession.reduce((a, b) => a + b, 0) / clicksPerSession.length)
    : null

  // Most common drop-off screen (last nav URL in non-completed sessions)
  const dropOffUrls = sessions
    .filter(s => !s.endedAt)
    .map(s => {
      const navs = s.path.filter(e => e.type === 'navigation' && e.url)
      return navs[navs.length - 1]?.url ?? null
    })
    .filter(Boolean) as string[]
  const dropOffCounts: Record<string, number> = {}
  dropOffUrls.forEach(u => { dropOffCounts[u] = (dropOffCounts[u] ?? 0) + 1 })
  const topDropOff = Object.entries(dropOffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topDropOffLabel = topDropOff
    ? topDropOff.replace(/^.*?\/(?=[^/]*$)/, '').replace(/\.html?$/, '') || topDropOff
    : null

  // ── UX health ─────────────────────────────────────────────────────────────
  const latestByType = (['a11y', 'copy', 'ds'] as const).map(t =>
    checks.filter(c => c.type === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
  const latestScores = latestByType.filter(Boolean).map(c => scoreFromIssues(c!.results))
  const uxScore = latestScores.length > 0
    ? Math.round(latestScores.reduce((a, b) => a + b, 0) / latestScores.length)
    : null
  const uxSc = uxScore !== null ? scoreColor(uxScore) : null

  const allIssues = latestByType.filter(Boolean).flatMap(c => c!.results)
  const highCount = allIssues.filter(i => i.severity === 'high').length

  // Total tasks across all scenarios
  const totalTasks = scenarios.reduce((n, s) => n + s.tasks.length, 0)

  const serveUrl = `/serve/${id}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`

  return (
    <div className="p-8" style={{ maxWidth: 900 }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">{project.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#5c5c78' }}>
            Created {formatDate(project.createdAt)}
            {project.description ? ` · ${project.description}` : ''}
          </p>
        </div>
        <a
          href={serveUrl}
          target="_blank"
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80 transition-opacity"
          style={{ background: '#2945F0', marginTop: 2 }}
        >
          Open prototype ↗
        </a>
      </div>

      {/* Navigation stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">

        {/* Sessions */}
        <Link
          href={`/project/${id}/moderator`}
          className="group relative rounded-2xl p-4 overflow-hidden hover:scale-[1.02] transition-transform"
          style={{ background: '#111119', border: '1px solid #1c1c2b' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-2xl font-bold text-white tabular-nums">{sessions.length}</div>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#4f46e5', marginTop: 4 }}>↗</span>
          </div>
          <div className="text-xs font-semibold text-white mb-0.5">Sessions</div>
          <div className="text-xs" style={{ color: '#3a3a52' }}>
            {completedSessions.length > 0 ? `${completedSessions.length} completed` : 'None recorded yet'}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#4f46e5' }} />
        </Link>

        {/* Scenarios */}
        <Link
          href={`/project/${id}/scenarios`}
          className="group relative rounded-2xl p-4 overflow-hidden hover:scale-[1.02] transition-transform"
          style={{ background: '#111119', border: '1px solid #1c1c2b' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-2xl font-bold text-white tabular-nums">{scenarios.length}</div>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0ea5e9', marginTop: 4 }}>↗</span>
          </div>
          <div className="text-xs font-semibold text-white mb-0.5">Scenarios</div>
          <div className="text-xs" style={{ color: '#3a3a52' }}>
            {totalTasks > 0 ? `${totalTasks} task${totalTasks !== 1 ? 's' : ''} defined` : 'None defined yet'}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#0ea5e9' }} />
        </Link>

        {/* Observations */}
        <Link
          href={`/project/${id}/moderator`}
          className="group relative rounded-2xl p-4 overflow-hidden hover:scale-[1.02] transition-transform"
          style={{ background: '#111119', border: '1px solid #1c1c2b' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-2xl font-bold text-white tabular-nums">{comments.length}</div>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#a855f7', marginTop: 4 }}>↗</span>
          </div>
          <div className="text-xs font-semibold text-white mb-0.5">Observations</div>
          <div className="text-xs" style={{ color: '#3a3a52' }}>
            {comments.length > 0
              ? `${new Set(comments.map(c => c.pageUrl)).size} screen${new Set(comments.map(c => c.pageUrl)).size !== 1 ? 's' : ''} annotated`
              : 'No annotations yet'}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#a855f7' }} />
        </Link>

        {/* UX Health */}
        <a
          href="#checks"
          className="group relative rounded-2xl p-4 overflow-hidden hover:scale-[1.02] transition-transform"
          style={{ background: '#111119', border: '1px solid #1c1c2b' }}
        >
          <div className="flex items-start justify-between mb-3">
            {uxScore !== null ? (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums" style={{ color: uxSc!.text }}>{uxScore}</span>
                <span className="text-sm" style={{ color: '#3a3a52' }}>/100</span>
              </div>
            ) : (
              <div className="text-2xl font-bold" style={{ color: '#3a3a52' }}>—</div>
            )}
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              style={{ color: uxScore !== null ? uxSc!.text : '#5c5c78' }}>↓</span>
          </div>
          <div className="text-xs font-semibold text-white mb-0.5">UX Health</div>
          <div className="text-xs" style={{ color: '#3a3a52' }}>
            {uxScore !== null
              ? highCount > 0 ? `${highCount} high-severity issue${highCount !== 1 ? 's' : ''}` : 'No critical issues'
              : 'Run checks to score'}
          </div>
          {uxScore !== null && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: uxSc!.text }} />
          )}
        </a>
      </div>

      {/* Insights strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <InsightCard
          label="Completion rate"
          value={completionRate !== null ? `${completionRate}%` : '—'}
          sub={sessions.length > 0
            ? `${completedSessions.length} of ${sessions.length} session${sessions.length !== 1 ? 's' : ''} finished`
            : 'No sessions recorded yet'}
          bar={completionRate}
          barColor="#22c55e"
        />
        <InsightCard
          label="Avg. session time"
          value={avgDuration !== null ? fmtDuration(avgDuration) : '—'}
          sub={avgDuration !== null
            ? `Over ${durations.length} session${durations.length !== 1 ? 's' : ''}`
            : 'Complete a session to measure'}
        />
        <InsightCard
          label={topDropOffLabel ? 'Top drop-off screen' : 'Avg. interactions / session'}
          value={topDropOffLabel ? topDropOffLabel : (avgClicks !== null && avgClicks > 0 ? `${avgClicks}` : '—')}
          sub={topDropOffLabel
            ? `${dropOffCounts[topDropOff!]} user${dropOffCounts[topDropOff!] !== 1 ? 's' : ''} left here`
            : (avgClicks !== null && avgClicks > 0 ? 'clicks per session' : 'No interaction data yet')}
        />
      </div>

      {/* Prototype preview */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1c1c2b' }}>
          <span className="text-sm font-medium text-white">Prototype</span>
          <a href={serveUrl} target="_blank" className="text-xs hover:text-white transition-colors" style={{ color: '#5c5c78' }}>
            Full screen ↗
          </a>
        </div>
        <div style={{ background: '#0a0a0f', height: 400 }}>
          <iframe src={serveUrl} className="w-full h-full" title="Prototype preview" />
        </div>
      </div>

      {/* UX health checks */}
      <div id="checks">
        <ChecksPanel projectId={id} serveUrl={serveUrl} initialChecks={checks} />
      </div>

    </div>
  )
}
