'use client'

import { useState, useCallback } from 'react'
import type { Project, Session, Scenario, Comment, TaskResult, Check, CheckIssue, Persona } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckType = 'a11y' | 'copy' | 'ds'

interface AxeViolation {
  id: string; description: string; help: string; helpUrl: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null
  tags: string[]; nodes: Array<{ target: string[]; html: string }>
}
interface StyleSample { value: string; selector: string; prop: string }
interface TextSample  { text: string; tag: string; selector: string }
interface FontSample  { font: string; selector: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreFromIssues(issues: CheckIssue[]): number {
  return Math.max(0, 100 - issues.reduce((a, i) => a + (i.severity === 'high' ? 10 : i.severity === 'medium' ? 5 : 2), 0))
}

function scoreColor(s: number) {
  if (s >= 80) return { text: '#22c55e', bg: 'rgba(34,197,94,0.08)' }
  if (s >= 60) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.08)' }
}

function mapViolations(violations: AxeViolation[]): CheckIssue[] {
  const seen = new Set<string>()
  return violations.flatMap(v =>
    v.nodes.map(n => {
      const severity: CheckIssue['severity'] = (v.impact === 'critical' || v.impact === 'serious') ? 'high'
        : v.impact === 'moderate' ? 'medium' : 'low'
      return { severity, description: v.help, element: n.target[0] ?? n.html.slice(0, 80),
        wcagCriteria: v.tags.find(t => t.startsWith('wcag')) ?? v.id, helpUrl: v.helpUrl }
    })
  ).filter(i => {
    const k = `${i.wcagCriteria}:${i.element}`
    if (seen.has(k)) return false; seen.add(k); return true
  }).slice(0, 40)
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 > 0 ? ` ${s % 60}s` : ''}`.trim()
}

const CHECK_LABELS: Record<CheckType, string> = { a11y: 'Accessibility', copy: 'Copywriting', ds: 'Design System' }
const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2']
const TECH_COLORS: Record<string, string> = { low: '#f59e0b', medium: '#818cf8', high: '#22c55e' }

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({ value, sub, valueColor, href }: { value: string; sub: string; valueColor?: string; href: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      className="flex-1 rounded-xl px-4 py-3 cursor-pointer"
      style={{
        background: hov ? '#131320' : '#111119',
        border: `1px solid ${hov ? '#3a3a60' : '#1c1c2b'}`,
        boxShadow: hov ? '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.08)' : 'none',
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => { window.location.href = href }}
    >
      <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: valueColor ?? 'white' }}>{value}</div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-xs" style={{ color: '#5c5c78' }}>{sub}</span>
        <span style={{ color: '#3a3a52', opacity: hov ? 1 : 0, transition: 'opacity 0.15s', fontSize: 11 }}>→</span>
      </div>
    </div>
  )
}

// ─── CheckCard ────────────────────────────────────────────────────────────────

function CheckCard({ type, check, onRun, onView, isRunning }: {
  type: CheckType; check: Check | null
  onRun: (t: CheckType) => void; onView: (t: CheckType) => void; isRunning: boolean
}) {
  const score  = check ? scoreFromIssues(check.results) : null
  const sc     = score !== null ? scoreColor(score) : null
  const high   = check?.results.filter(i => i.severity === 'high').length ?? 0
  const total  = check?.results.length ?? 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: '#111119', border: '1px solid #1c1c2b', cursor: check ? 'pointer' : 'default' }}
      onClick={() => check && onView(type)}
    >
      {/* Score + name */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-4xl font-bold tabular-nums leading-none"
            style={{ color: sc?.text ?? '#3a3a52' }}>
            {score !== null ? score : '—'}
          </div>
          <div className="text-[10px] mt-1" style={{ color: '#3a3a52' }}>/&nbsp;100</div>
        </div>
        <div className="text-right ml-2">
          <div className="text-xs font-semibold text-white">{CHECK_LABELS[type]}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onRun(type) }}
            disabled={isRunning}
            className="text-[10px] mt-1 transition-colors hover:text-white"
            style={{ color: isRunning ? '#3a3a52' : '#5c5c78' }}
          >
            {isRunning ? 'scanning…' : '↻ re-run'}
          </button>
        </div>
      </div>

      <div className="h-px mb-3" style={{ background: '#1c1c2b' }} />

      {check ? (
        <>
          {total > 0 && (
            <div className="flex items-center gap-2 mb-2">
              {high > 0 && <span className="text-[10px]" style={{ color: '#f87171' }}>{high} critical</span>}
              <span className="text-[10px]" style={{ color: '#5c5c78' }}>{total} issue{total !== 1 ? 's' : ''}</span>
            </div>
          )}
          <p className="text-[11px] line-clamp-2 mb-3 flex-1" style={{ color: '#5c5c78' }}>{check.summary}</p>
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onView(type) }}
              className="text-xs transition-colors hover:text-indigo-300"
              style={{ color: '#818cf8' }}
            >
              View report →
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between flex-1">
          <span className="text-xs" style={{ color: '#3a3a52' }}>Not scanned yet</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRun(type) }}
            disabled={isRunning}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(80,70,229,0.15)', color: isRunning ? '#3a3a52' : '#818cf8' }}
          >
            {isRunning ? 'scanning…' : 'Run →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── OverallHealthCard ────────────────────────────────────────────────────────

function OverallHealthCard({ checks }: { checks: Check[] }) {
  const latest = (['a11y', 'copy', 'ds'] as CheckType[]).map(t =>
    checks.filter(c => c.type === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
  const scores  = latest.filter(Boolean).map(c => scoreFromIssues(c!.results))
  const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const sc      = overall !== null ? scoreColor(overall) : null
  const totalAll = latest.filter(Boolean).flatMap(c => c!.results).length

  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-4xl font-bold tabular-nums leading-none" style={{ color: sc?.text ?? '#3a3a52' }}>
            {overall !== null ? overall : '—'}
          </div>
          <div className="text-[10px] mt-1" style={{ color: '#3a3a52' }}>/&nbsp;100</div>
        </div>
        <div className="text-right ml-2">
          <div className="text-xs font-semibold text-white">UX Health</div>
          <div className="text-[10px] mt-1" style={{ color: '#3a3a52' }}>{scores.length}/3 checks</div>
        </div>
      </div>

      <div className="h-px mb-3" style={{ background: '#1c1c2b' }} />

      {scores.length > 0 ? (
        <div className="space-y-2 flex-1">
          {(['a11y', 'copy', 'ds'] as CheckType[]).map((type, i) => {
            const c = latest[i]; const s = c ? scoreFromIssues(c.results) : null
            const sc2 = s !== null ? scoreColor(s) : null
            return (
              <div key={type} className="flex items-center gap-2">
                <span className="text-[10px] w-16 flex-shrink-0" style={{ color: '#3a3a52' }}>{CHECK_LABELS[type].slice(0, 10)}</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#1c1c2b' }}>
                  {s !== null && <div className="h-full rounded-full" style={{ width: `${s}%`, background: sc2!.text }} />}
                </div>
                <span className="text-[10px] tabular-nums w-5 text-right flex-shrink-0" style={{ color: sc2?.text ?? '#3a3a52' }}>
                  {s ?? '—'}
                </span>
              </div>
            )
          })}
          {totalAll > 0 && (
            <p className="text-[10px] mt-2" style={{ color: '#3a3a52' }}>{totalAll} total issues</p>
          )}
        </div>
      ) : (
        <p className="text-xs flex-1" style={{ color: '#3a3a52' }}>Run all 3 checks to see combined score</p>
      )}
    </div>
  )
}

// ─── PersonasWidget ───────────────────────────────────────────────────────────

function PersonasWidget({ personas, sessions, projectId }: {
  personas: Persona[]; sessions: Session[]; projectId: string
}) {
  const simCount = (id: string) => sessions.filter(s => s.personaId === id && s.type === 'bot').length

  return (
    <div className="rounded-xl p-4" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Personas</span>
        <a href={`/project/${projectId}/personas`} className="text-[10px] transition-colors hover:text-indigo-300" style={{ color: '#3a3a52' }}>
          Manage →
        </a>
      </div>
      {personas.length === 0 ? (
        <p className="text-xs" style={{ color: '#3a3a52' }}>No personas defined yet</p>
      ) : (
        <div className="space-y-1">
          {personas.slice(0, 5).map((p, i) => {
            const sims = simCount(p.id)
            return (
              <div key={p.id} className="flex items-center gap-2.5 py-1.5 border-b last:border-0" style={{ borderColor: '#1c1c2b' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: USER_COLORS[i % USER_COLORS.length] }}>
                  {p.name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{p.name}</div>
                  <div className="text-[10px] truncate" style={{ color: '#3a3a52' }}>{p.role}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ color: TECH_COLORS[p.techComfort], background: 'rgba(255,255,255,0.04)' }}>
                    {p.techComfort}
                  </span>
                  {sims > 0 && (
                    <span className="text-[10px]" style={{ color: '#a78bfa' }}>🤖{sims}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── TaskDifficultyWidget ─────────────────────────────────────────────────────

function TaskDifficultyWidget({ scenarios, sessions, taskResults }: {
  scenarios: Scenario[]; sessions: Session[]; taskResults: TaskResult[]
}) {
  const stats: Array<{ title: string; rate: number; total: number }> = []

  for (const sc of scenarios) {
    const scSessions = sessions.filter(s => s.scenarioId === sc.id)
    const sessionIds = new Set(scSessions.map(s => s.id))
    const byIndex = new Map<number, TaskResult[]>()
    for (const tr of taskResults) {
      if (sessionIds.has(tr.sessionId) && tr.taskIndex >= 0) {
        byIndex.set(tr.taskIndex, [...(byIndex.get(tr.taskIndex) ?? []), tr])
      }
    }
    for (const [idx, trs] of byIndex.entries()) {
      stats.push({
        title: sc.tasks[idx]?.title ?? `${sc.title} · Task ${idx + 1}`,
        rate: Math.round((trs.filter(t => t.completed).length / trs.length) * 100),
        total: trs.length,
      })
    }
  }

  const sorted = stats.sort((a, b) => a.rate - b.rate).slice(0, 5)

  return (
    <div className="rounded-xl p-4" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Task difficulty</span>
        <span className="text-[10px]" style={{ color: '#3a3a52' }}>by completion rate</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs" style={{ color: '#3a3a52' }}>No task results yet</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((t, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] truncate max-w-[160px]" style={{ color: '#94a3b8' }}>{t.title}</span>
                <span className="text-[10px] tabular-nums ml-2 flex-shrink-0"
                  style={{ color: t.rate >= 80 ? '#22c55e' : t.rate >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {t.rate}%
                </span>
              </div>
              <div className="h-1 rounded-full" style={{ background: '#1c1c2b' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${t.rate}%`, background: t.rate >= 80 ? '#22c55e' : t.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CheckModal ───────────────────────────────────────────────────────────────

function CheckModal({ type, check, onClose, onRun, isRunning }: {
  type: CheckType; check: Check | null
  onClose: () => void; onRun: (t: CheckType) => void; isRunning: boolean
}) {
  const score = check ? scoreFromIssues(check.results) : null
  const sc    = score !== null ? scoreColor(score) : null
  const grouped = {
    high:   check?.results.filter(i => i.severity === 'high')   ?? [],
    medium: check?.results.filter(i => i.severity === 'medium') ?? [],
    low:    check?.results.filter(i => i.severity === 'low')    ?? [],
  }
  const SEV = {
    high:   { text: '#f87171', bg: 'rgba(239,68,68,0.1)',    label: 'Critical' },
    medium: { text: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   label: 'Medium'   },
    low:    { text: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Low'      },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.8)' }} />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: '#111119', border: '1px solid #1c1c2b' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl font-bold tabular-nums" style={{ color: sc?.text ?? '#3a3a52' }}>{score ?? '—'}</span>
              <h2 className="text-sm font-semibold text-white">{CHECK_LABELS[type]}</h2>
            </div>
            {check && <p className="text-xs" style={{ color: '#5c5c78' }}>{check.summary}</p>}
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button onClick={() => onRun(type)} disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#1c1c2b', color: isRunning ? '#3a3a52' : '#e0e7ff' }}>
              {isRunning ? 'scanning…' : '↻ re-run'}
            </button>
            <button onClick={onClose} className="text-xs px-2 py-1.5 rounded-lg" style={{ color: '#5c5c78' }}>✕</button>
          </div>
        </div>

        {!check ? (
          <div className="text-center py-12">
            <p className="text-sm mb-4" style={{ color: '#5c5c78' }}>No results for {CHECK_LABELS[type]} yet</p>
            <button onClick={() => onRun(type)} className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(80,70,229,0.15)', color: '#818cf8' }}>
              Run scan now
            </button>
          </div>
        ) : check.results.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm font-medium text-white mb-1">No issues found</p>
            <p className="text-xs" style={{ color: '#5c5c78' }}>This check passed with no problems detected.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {(['high', 'medium', 'low'] as const).map(sev => {
              const items = grouped[sev]
              if (!items.length) return null
              return (
                <div key={sev}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: SEV[sev].text }}>{SEV[sev].label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: SEV[sev].bg, color: SEV[sev].text }}>{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((issue, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: '#0c0c14', border: '1px solid #1c1c2b' }}>
                        <p className="text-xs text-white">{issue.description}</p>
                        {issue.element && <p className="text-[10px] mt-1 font-mono truncate" style={{ color: '#3a3a52' }}>{issue.element}</p>}
                        {issue.wcagCriteria && <span className="text-[10px] mt-1 inline-block px-1.5 rounded-sm" style={{ background: '#1c1c2b', color: '#5c5c78' }}>{issue.wcagCriteria}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main DashboardView ───────────────────────────────────────────────────────

export default function DashboardView({
  project,
  sessions,
  scenarios,
  comments,
  taskResults,
  checks: initialChecks,
  personas,
  serveUrl,
  projectId,
}: {
  project: Project
  sessions: Session[]
  scenarios: Scenario[]
  comments: Comment[]
  taskResults: TaskResult[]
  checks: Check[]
  personas: Persona[]
  serveUrl: string
  projectId: string
}) {
  const [checkModal, setCheckModal]     = useState<CheckType | null>(null)
  const [runningCheck, setRunningCheck] = useState<CheckType | null>(null)
  const [checks, setChecks]             = useState(initialChecks)

  // ── Computed stats ────────────────────────────────────────────────────────
  const completedSessions = sessions.filter(s => s.endedAt)
  const completionPct = sessions.length ? Math.round((completedSessions.length / sessions.length) * 100) : 0

  const seqTRs = taskResults.filter(tr => {
    const r = tr.rating as Record<string, unknown>
    return tr.taskIndex === -1 && r.seq !== undefined
  })
  const avgSEQ = seqTRs.length
    ? (seqTRs.reduce((a, tr) => a + ((tr.rating as Record<string, unknown>).seq as number), 0) / seqTRs.length).toFixed(1)
    : null

  const latestA11y = checks.filter(c => c.type === 'a11y').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestCopy = checks.filter(c => c.type === 'copy').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestDS   = checks.filter(c => c.type === 'ds').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const getCheckForModal = (t: CheckType) => t === 'a11y' ? latestA11y : t === 'copy' ? latestCopy : latestDS

  // ── Scan logic ────────────────────────────────────────────────────────────
  const handleRunCheck = useCallback(async (type: CheckType) => {
    setRunningCheck(type)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;opacity:0;pointer-events:none'
    iframe.src = `${serveUrl}?_argusScan=1`
    document.body.appendChild(iframe)

    try {
      const scanData = await new Promise<{
        violations?: AxeViolation[]
        texts?: TextSample[]
        colors?: StyleSample[]
        fonts?: FontSample[]
      }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Scan timed out')), 25000)
        const handler = (e: MessageEvent) => {
          if (e.data?.type === 'argus-scan-complete') {
            clearTimeout(timeout); window.removeEventListener('message', handler); resolve(e.data)
          }
        }
        window.addEventListener('message', handler)
      })

      let body: Record<string, unknown> = { type, projectId }
      if (type === 'a11y') {
        const mapped = mapViolations(scanData.violations ?? [])
        body = { ...body, clientResults: mapped,
          clientSummary: `Found ${mapped.length} issue${mapped.length !== 1 ? 's' : ''} (${mapped.filter(i => i.severity === 'high').length} critical)` }
      } else if (type === 'copy') {
        body = { ...body, texts: scanData.texts ?? [] }
      } else {
        body = { ...body, colors: scanData.colors ?? [], fonts: scanData.fonts ?? [] }
      }

      const res = await fetch('/api/checks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) {
        const newCheck = await res.json() as Check
        setChecks(prev => [...prev, newCheck])
        setCheckModal(type)
      }
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
      setRunningCheck(null)
    }
  }, [serveUrl, projectId])

  return (
    <div className="p-5 space-y-4" style={{ background: '#0b0b13' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white leading-tight">{project.name}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#3a3a52' }}>
            {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <a href={serveUrl} target="_blank" rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-80 transition-opacity"
          style={{ background: '#2945F0' }}>
          Open prototype ↗
        </a>
      </div>

      {/* 4 Stat boxes */}
      <div className="flex gap-3">
        <StatBox value={String(sessions.length)} sub="Sessions"
          href={`/project/${projectId}/sessions`} />
        <StatBox value={`${completionPct}%`} sub="Completion"
          valueColor={completionPct >= 80 ? '#22c55e' : completionPct >= 50 ? '#f59e0b' : '#ef4444'}
          href={`/project/${projectId}/metrics`} />
        <StatBox value={String(comments.length)} sub="Comments"
          href={`/project/${projectId}/comments`} />
        <StatBox value={avgSEQ ? `${avgSEQ}/7` : '—'} sub="Avg SEQ"
          href={`/project/${projectId}/metrics`} />
      </div>

      {/* 2×2 Check cards */}
      <div className="grid grid-cols-2 gap-3">
        <CheckCard type="a11y" check={latestA11y} onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'a11y'} />
        <CheckCard type="copy" check={latestCopy} onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'copy'} />
        <CheckCard type="ds"   check={latestDS}   onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'ds'}   />
        <OverallHealthCard checks={checks} />
      </div>

      {/* Widget row: Personas + Task Difficulty */}
      <div className="grid grid-cols-2 gap-3">
        <PersonasWidget personas={personas} sessions={sessions} projectId={projectId} />
        <TaskDifficultyWidget scenarios={scenarios} sessions={sessions} taskResults={taskResults} />
      </div>

      {/* Prototype iframe */}
      <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#111119', border: '1px solid #1c1c2b', height: 600 }}>
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b" style={{ borderColor: '#1c1c2b' }}>
          <span className="text-xs font-medium text-white">Prototype</span>
          <a href={serveUrl} target="_blank" rel="noreferrer" className="text-xs hover:text-white transition-colors" style={{ color: '#5c5c78' }}>
            Full screen ↗
          </a>
        </div>
        <div className="flex-1 min-h-0" style={{ background: '#0a0a0f' }}>
          <iframe src={serveUrl} className="w-full h-full border-0" title="Prototype preview" />
        </div>
      </div>

      {/* Check modal */}
      {checkModal && (
        <CheckModal
          type={checkModal}
          check={getCheckForModal(checkModal)}
          onClose={() => setCheckModal(null)}
          onRun={handleRunCheck}
          isRunning={runningCheck === checkModal}
        />
      )}
    </div>
  )
}
