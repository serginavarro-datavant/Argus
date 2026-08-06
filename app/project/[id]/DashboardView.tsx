'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Project, Session, Scenario, Comment, TaskResult, Check, CheckIssue } from '@/lib/types'

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
  if (s >= 80) return { text: '#22c55e', bg: 'rgba(34,197,94,0.1)', ring: 'rgba(34,197,94,0.25)' }
  if (s >= 60) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', ring: 'rgba(245,158,11,0.25)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)', ring: 'rgba(239,68,68,0.25)' }
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

const CHECK_LABELS: Record<CheckType, string> = { a11y: 'Accessibility', copy: 'Copywriting', ds: 'Design System' }
const CHECK_ICONS: Record<CheckType, string> = { a11y: '♿', copy: '✍️', ds: '🎨' }

// ─── CheckCard ────────────────────────────────────────────────────────────────

function CheckCard({ type, check, onRun, onView, isRunning }: {
  type: CheckType; check: Check | null
  onRun: (t: CheckType) => void; onView: (t: CheckType) => void; isRunning: boolean
}) {
  const score = check ? scoreFromIssues(check.results) : null
  const sc    = score !== null ? scoreColor(score) : null
  const high  = check?.results.filter(i => i.severity === 'high').length ?? 0
  const total = check?.results.length ?? 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5 transition-colors"
      style={{ background: '#111119', border: '1px solid #1c1c2b', cursor: check ? 'pointer' : 'default' }}
      onClick={() => check && onView(type)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{CHECK_ICONS[type]}</span>
          <span className="text-sm font-medium text-white">{CHECK_LABELS[type]}</span>
        </div>
        {sc && score !== null ? (
          <span className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg" style={{ color: sc.text, background: sc.bg }}>{score}</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-lg" style={{ color: '#3a3a52', background: '#0c0c14' }}>—</span>
        )}
      </div>

      {check ? (
        <>
          <p className="text-xs line-clamp-2" style={{ color: '#5c5c78' }}>{check.summary}</p>
          {total > 0 && (
            <div className="flex items-center gap-1.5">
              {high > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                  {high} critical
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: '#0c0c14', color: '#5c5c78' }}>
                {total} total
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-auto">
            <button
              onClick={(e) => { e.stopPropagation(); onView(type) }}
              className="flex-1 text-xs py-1.5 rounded-lg text-center transition-colors"
              style={{ background: 'rgba(80,70,229,0.12)', color: '#818cf8' }}
            >
              View report
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRun(type) }}
              disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: '#1c1c2b', color: isRunning ? '#3a3a52' : '#5c5c78' }}
            >
              {isRunning ? '…' : 'Re-run'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs" style={{ color: '#3a3a52' }}>No scan results yet</p>
          <button
            onClick={(e) => { e.stopPropagation(); onRun(type) }}
            disabled={isRunning}
            className="w-full text-xs py-1.5 rounded-lg transition-colors"
            style={{ background: isRunning ? '#1c1c2b' : 'rgba(80,70,229,0.15)', color: isRunning ? '#3a3a52' : '#818cf8' }}
          >
            {isRunning ? 'Scanning…' : 'Run scan'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── OverallHealthCard ────────────────────────────────────────────────────────

function OverallHealthCard({ checks }: { checks: Check[] }) {
  const latest = (['a11y', 'copy', 'ds'] as CheckType[]).map(t =>
    checks.filter(c => c.type === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
  const scores = latest.filter(Boolean).map(c => scoreFromIssues(c!.results))
  const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const sc = overall !== null ? scoreColor(overall) : null
  const totalHigh = latest.filter(Boolean).flatMap(c => c!.results).filter(i => i.severity === 'high').length
  const totalAll  = latest.filter(Boolean).flatMap(c => c!.results).length

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="text-sm font-medium text-white">UX Health</span>
        </div>
        {sc && overall !== null ? (
          <span className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg" style={{ color: sc.text, background: sc.bg }}>{overall}</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-lg" style={{ color: '#3a3a52', background: '#0c0c14' }}>—</span>
        )}
      </div>

      {scores.length > 0 ? (
        <>
          <p className="text-xs" style={{ color: '#5c5c78' }}>
            {totalHigh} critical · {totalAll} total issues across {scores.length} checks
          </p>
          <div className="space-y-2 mt-auto">
            {(['a11y', 'copy', 'ds'] as CheckType[]).map((type, i) => {
              const c = latest[i]; const s = c ? scoreFromIssues(c.results) : null
              const sc2 = s !== null ? scoreColor(s) : null
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 flex-shrink-0" style={{ color: '#3a3a52' }}>{CHECK_LABELS[type].slice(0, 10)}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#1c1c2b' }}>
                    {s !== null && <div className="h-full rounded-full" style={{ width: `${s}%`, background: sc2!.text }} />}
                  </div>
                  <span className="text-[10px] tabular-nums w-5 text-right" style={{ color: sc2?.text ?? '#3a3a52' }}>
                    {s ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-xs mt-auto" style={{ color: '#3a3a52' }}>Run all 3 checks to see combined UX health score</p>
      )}
    </div>
  )
}

// ─── CheckModal ───────────────────────────────────────────────────────────────

function CheckModal({ type, check, onClose, onRun, isRunning }: {
  type: CheckType; check: Check | null
  onClose: () => void; onRun: (t: CheckType) => void; isRunning: boolean
}) {
  const score  = check ? scoreFromIssues(check.results) : null
  const sc     = score !== null ? scoreColor(score) : null
  const grouped = {
    high:   check?.results.filter(i => i.severity === 'high')   ?? [],
    medium: check?.results.filter(i => i.severity === 'medium') ?? [],
    low:    check?.results.filter(i => i.severity === 'low')    ?? [],
  }

  const SEV = {
    high:   { text: '#f87171', bg: 'rgba(239,68,68,0.1)',   label: 'Critical' },
    medium: { text: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  label: 'Medium'   },
    low:    { text: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Low'     },
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{CHECK_ICONS[type]}</span>
              <h2 className="text-base font-bold text-white">{CHECK_LABELS[type]} Report</h2>
            </div>
            {check && <p className="text-xs" style={{ color: '#5c5c78' }}>{check.summary}</p>}
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {sc && score !== null && (
              <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ color: sc.text, background: sc.bg }}>
                {score}/100
              </span>
            )}
            <button
              onClick={() => onRun(type)} disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: '#1c1c2b', color: isRunning ? '#3a3a52' : '#e0e7ff' }}
            >
              {isRunning ? 'Scanning…' : 'Re-run'}
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
                        {issue.element && (
                          <p className="text-[10px] mt-1 font-mono truncate" style={{ color: '#3a3a52' }}>{issue.element}</p>
                        )}
                        {issue.wcagCriteria && (
                          <span className="text-[10px] mt-1 inline-block px-1.5 rounded-sm" style={{ background: '#1c1c2b', color: '#5c5c78' }}>
                            {issue.wcagCriteria}
                          </span>
                        )}
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
  serveUrl,
  projectId,
}: {
  project: Project
  sessions: Session[]
  scenarios: Scenario[]
  comments: Comment[]
  taskResults: TaskResult[]
  checks: Check[]
  serveUrl: string
  projectId: string
}) {
  const [hoveredStat, setHoveredStat] = useState<string | null>(null)
  const [checkModal, setCheckModal]   = useState<CheckType | null>(null)
  const [runningCheck, setRunningCheck] = useState<CheckType | null>(null)
  const [checks, setChecks] = useState(initialChecks)

  // ── Computed stats ────────────────────────────────────────────────────────
  const completedSessions = sessions.filter(s => s.endedAt)
  const completionPct = sessions.length
    ? Math.round((completedSessions.length / sessions.length) * 100)
    : 0

  const seqTRs = taskResults.filter(tr => {
    const r = tr.rating as Record<string, unknown>
    return tr.taskIndex === -1 && r.seq !== undefined
  })
  const avgSEQ = seqTRs.length
    ? (seqTRs.reduce((a, tr) => a + ((tr.rating as Record<string, unknown>).seq as number), 0) / seqTRs.length).toFixed(1)
    : null

  const seqValues = seqTRs.map(tr => Math.round((tr.rating as Record<string, unknown>).seq as number))
  const seqDist   = [1, 2, 3, 4, 5, 6, 7].map(v => ({ val: v, count: seqValues.filter(s => s === v).length }))
  const maxSeq    = Math.max(...seqDist.map(d => d.count), 1)

  const latestA11y = checks.filter(c => c.type === 'a11y').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestCopy = checks.filter(c => c.type === 'copy').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestDS   = checks.filter(c => c.type === 'ds').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null

  const getCheckForModal = (t: CheckType) => t === 'a11y' ? latestA11y : t === 'copy' ? latestCopy : latestDS

  // Hover preview data
  const recentUsers    = Array.from(new Set(sessions.map(s => s.testerName))).slice(0, 4)
  const recentComments = [...comments].slice(-3).reverse()
  const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706']

  const scenarioRates = scenarios.map(sc => {
    const ss = sessions.filter(s => s.scenarioId === sc.id)
    return { title: sc.title, pct: ss.length ? Math.round((ss.filter(s => s.endedAt).length / ss.length) * 100) : 0 }
  }).slice(0, 3)

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

  // ── Stat box helper ───────────────────────────────────────────────────────
  function StatBox({ id, value, sub, valueColor, href, children }: {
    id: string; value: string; sub: string; valueColor?: string
    href: string; children: React.ReactNode
  }) {
    const hov = hoveredStat === id
    return (
      <div
        className="flex-1 rounded-xl overflow-hidden cursor-pointer transition-all"
        style={{ background: '#111119', border: `1px solid ${hov ? '#3a3a52' : '#1c1c2b'}` }}
        onMouseEnter={() => setHoveredStat(id)}
        onMouseLeave={() => setHoveredStat(null)}
        onClick={() => { window.location.href = href }}
      >
        <div className="px-4 pt-3 pb-2">
          <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: valueColor ?? 'white' }}>{value}</div>
          <div className="text-xs mt-0.5" style={{ color: '#5c5c78' }}>{sub}</div>
        </div>
        <div style={{ maxHeight: hov ? 120 : 0, overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
          <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: '#1c1c2b' }}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-5 gap-3 overflow-hidden" style={{ background: '#0b0b13' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
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
      <div className="flex gap-3 flex-shrink-0">
        <StatBox id="sessions" value={String(sessions.length)} sub="Sessions" href={`/project/${projectId}/sessions`}>
          <div className="space-y-1">
            {recentUsers.length ? recentUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: USER_COLORS[i % 4] }}>{u.charAt(0).toUpperCase()}</span>
                <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{u}</span>
              </div>
            )) : <span className="text-xs" style={{ color: '#3a3a52' }}>No sessions yet</span>}
          </div>
        </StatBox>

        <StatBox id="completion"
          value={`${completionPct}%`} sub="Completion"
          valueColor={completionPct >= 80 ? '#22c55e' : completionPct >= 50 ? '#f59e0b' : '#ef4444'}
          href={`/project/${projectId}/metrics`}
        >
          <div className="space-y-1.5">
            {scenarioRates.length ? scenarioRates.map((r, i) => (
              <div key={i}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] truncate max-w-[100px]" style={{ color: '#94a3b8' }}>{r.title}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: r.pct >= 80 ? '#22c55e' : '#f59e0b' }}>{r.pct}%</span>
                </div>
                <div className="h-0.5 rounded-full" style={{ background: '#1c1c2b' }}>
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 80 ? '#22c55e' : '#f59e0b' }} />
                </div>
              </div>
            )) : <span className="text-xs" style={{ color: '#3a3a52' }}>No scenario data</span>}
          </div>
        </StatBox>

        <StatBox id="comments" value={String(comments.length)} sub="Comments" href={`/project/${projectId}/comments`}>
          <div className="space-y-1">
            {recentComments.length ? recentComments.map((c, i) => (
              <p key={i} className="text-[10px] line-clamp-1" style={{ color: '#94a3b8' }}>
                "{c.text.slice(0, 48)}{c.text.length > 48 ? '…' : ''}"
              </p>
            )) : <span className="text-xs" style={{ color: '#3a3a52' }}>No comments yet</span>}
          </div>
        </StatBox>

        <StatBox id="seq"
          value={avgSEQ ? `${avgSEQ}` : '—'}
          sub="Avg SEQ /7"
          href={`/project/${projectId}/metrics`}
        >
          {seqValues.length ? (
            <div className="flex items-end gap-0.5 h-9">
              {seqDist.map(d => (
                <div key={d.val} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm"
                    style={{ height: `${Math.max((d.count / maxSeq) * 28, 2)}px`, background: d.count > 0 ? '#818cf8' : '#1c1c2b' }} />
                  <span className="text-[8px]" style={{ color: '#3a3a52' }}>{d.val}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-xs" style={{ color: '#3a3a52' }}>No SEQ ratings yet</span>}
        </StatBox>
      </div>

      {/* 2×2 UX check cards */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0">
        <CheckCard type="a11y" check={latestA11y} onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'a11y'} />
        <CheckCard type="copy" check={latestCopy} onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'copy'} />
        <CheckCard type="ds"   check={latestDS}   onRun={handleRunCheck} onView={setCheckModal} isRunning={runningCheck === 'ds'}   />
        <OverallHealthCard checks={checks} />
      </div>

      {/* Prototype iframe */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b" style={{ borderColor: '#1c1c2b' }}>
          <span className="text-xs font-medium text-white">Prototype</span>
          <a href={serveUrl} target="_blank" rel="noreferrer" className="text-xs hover:text-white transition-colors" style={{ color: '#5c5c78' }}>
            Full screen ↗
          </a>
        </div>
        <div className="flex-1 min-h-0" style={{ background: '#0a0a0f' }}>
          <iframe src={serveUrl} className="w-full h-full border-0" title="Prototype preview" style={{ minHeight: 180 }} />
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
