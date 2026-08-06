import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import ChecksPanel from './ChecksPanel'
import type { CheckIssue } from '@/lib/types'

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreFromIssues(issues: CheckIssue[]): number {
  return Math.max(0, 100 - issues.reduce((a, i) => a + (i.severity === 'high' ? 10 : i.severity === 'medium' ? 5 : 2), 0))
}

function scoreColor(s: number): string {
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#f59e0b'
  return '#ef4444'
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60 > 0 ? ` ${s % 60}s` : ''}`
}

// ─── Inline stat chip ─────────────────────────────────────────────────────────

function Chip({ value, label, color, href }: {
  value: string; label: string; color?: string; href?: string
}) {
  const inner = (
    <span
      className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-white/[0.06]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1c1c2b' }}
    >
      <span className="font-bold tabular-nums" style={{ color: color ?? 'white' }}>{value}</span>
      <span style={{ color: '#5c5c78' }}>{label}</span>
    </span>
  )
  return href ? <Link href={href}>{inner}</Link> : <>{inner}</>
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({ items }: { items: Array<{ label: string; value: string; bar?: number; barColor?: string }> }) {
  return (
    <div className="flex items-stretch gap-px mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #1c1c2b' }}>
      {items.map((m, i) => (
        <div key={i} className="flex-1 px-3.5 py-2.5" style={{ background: '#0c0c14' }}>
          <div className="text-xs font-medium text-white tabular-nums">{m.value}</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#3a3a52' }}>{m.label}</div>
          {m.bar != null && (
            <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: '#1c1c2b' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(m.bar, 100)}%`, background: m.barColor ?? '#4f46e5' }} />
            </div>
          )}
        </div>
      ))}
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

  // ── Metrics ───────────────────────────────────────────────────────────────
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

  const avgClicks = sessions.length > 0
    ? Math.round(sessions.map(s => s.path.filter(e => e.type === 'click').length).reduce((a, b) => a + b, 0) / sessions.length)
    : null

  // Drop-off
  const dropOffUrls = sessions.filter(s => !s.endedAt).map(s => {
    const navs = s.path.filter(e => e.type === 'navigation' && e.url)
    return navs[navs.length - 1]?.url ?? null
  }).filter(Boolean) as string[]
  const dropOffCounts: Record<string, number> = {}
  dropOffUrls.forEach(u => { dropOffCounts[u] = (dropOffCounts[u] ?? 0) + 1 })
  const topDropOff = Object.entries(dropOffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topDropOffLabel = topDropOff
    ? topDropOff.replace(/^.*\/(?=[^/]*$)/, '').replace(/\.html?$/, '') || topDropOff
    : null

  // UX Health
  const latestByType = (['a11y', 'copy', 'ds'] as const).map(t =>
    checks.filter(c => c.type === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
  const latestScores = latestByType.filter(Boolean).map(c => scoreFromIssues(c!.results))
  const uxScore = latestScores.length > 0
    ? Math.round(latestScores.reduce((a, b) => a + b, 0) / latestScores.length)
    : null
  const highCount = latestByType.filter(Boolean).flatMap(c => c!.results).filter(i => i.severity === 'high').length

  const serveUrl = `/serve/${id}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`

  // Metric row items for below the prototype
  const metricItems = [
    {
      label: 'completion',
      value: completionRate !== null ? `${completionRate}%` : '—',
      bar: completionRate ?? undefined,
      barColor: '#22c55e',
    },
    {
      label: 'avg. time',
      value: avgDuration !== null ? fmtDuration(avgDuration) : '—',
    },
    {
      label: avgClicks !== null ? 'avg. clicks' : 'observations',
      value: avgClicks !== null ? String(avgClicks) : String(comments.length),
    },
    {
      label: topDropOffLabel ? 'top drop-off' : 'scenarios',
      value: topDropOffLabel ? topDropOffLabel : String(scenarios.length),
    },
  ]

  return (
    <div className="p-6 h-full flex flex-col">

      {/* Compact header */}
      <div className="flex items-center gap-4 mb-5 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white leading-tight truncate">{project.name}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#3a3a52' }}>{formatDate(project.createdAt)}</p>
        </div>

        {/* Inline stat chips */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Chip value={String(sessions.length)} label="sessions" href={`/project/${id}/moderator`} />
          <Chip value={String(scenarios.length)} label="scenarios" href={`/project/${id}/scenarios`} />
          <Chip value={String(comments.length)} label="observations" href={`/project/${id}/moderator`} />
          {uxScore !== null && (
            <Chip value={String(uxScore)} label="UX health" color={scoreColor(uxScore)} href="#checks" />
          )}
        </div>

        <a
          href={serveUrl}
          target="_blank"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-80 transition-opacity"
          style={{ background: '#2945F0' }}
        >
          Open prototype ↗
        </a>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 grid gap-5 min-h-0" style={{ gridTemplateColumns: '1fr 420px' }}>

        {/* Left: prototype preview + metrics strip */}
        <div className="flex flex-col min-h-0">
          <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 border-b" style={{ borderColor: '#1c1c2b' }}>
              <span className="text-xs font-medium text-white">Prototype</span>
              <a href={serveUrl} target="_blank" className="text-xs hover:text-white transition-colors" style={{ color: '#5c5c78' }}>
                Full screen ↗
              </a>
            </div>
            <div className="flex-1 min-h-0" style={{ background: '#0a0a0f' }}>
              <iframe src={serveUrl} className="w-full h-full border-0" title="Prototype preview" style={{ minHeight: 300 }} />
            </div>
          </div>

          {/* Metrics strip below prototype */}
          <MetricRow items={metricItems} />
        </div>

        {/* Right: UX health checks */}
        <div className="overflow-y-auto" id="checks">
          <ChecksPanel projectId={id} serveUrl={serveUrl} initialChecks={checks} />
        </div>

      </div>
    </div>
  )
}
