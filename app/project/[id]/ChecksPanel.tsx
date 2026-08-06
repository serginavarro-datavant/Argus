'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Check, CheckIssue } from '@/lib/types'
import { formatDate } from '@/lib/utils'

// ─── axe → CheckIssue mapping ─────────────────────────────────────────────────

interface AxeViolation {
  id: string
  description: string
  help: string
  helpUrl: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null
  tags: string[]
  nodes: Array<{ target: string[]; html: string }>
}

function impactToSeverity(impact: AxeViolation['impact']): CheckIssue['severity'] {
  if (impact === 'critical' || impact === 'serious') return 'high'
  if (impact === 'moderate') return 'medium'
  return 'low'
}

function mapViolations(violations: AxeViolation[]): CheckIssue[] {
  return violations.flatMap(v =>
    v.nodes.map(n => ({
      severity: impactToSeverity(v.impact),
      description: v.help,
      element: n.target[0] ?? n.html.slice(0, 80),
      wcagCriteria: v.tags.find(t => t.startsWith('wcag')) ?? v.id,
      helpUrl: v.helpUrl,
    }))
  )
}

// Capped at 40 issues so the list stays readable
function dedupeIssues(issues: CheckIssue[]): CheckIssue[] {
  const seen = new Set<string>()
  return issues.filter(i => {
    const key = `${i.wcagCriteria}:${i.element}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 40)
}

// ─── UX health score ──────────────────────────────────────────────────────────

function scoreFromIssues(issues: CheckIssue[]): number {
  const deduction = issues.reduce((acc, i) => {
    return acc + (i.severity === 'high' ? 10 : i.severity === 'medium' ? 5 : 2)
  }, 0)
  return Math.max(0, 100 - deduction)
}

function scoreColor(score: number) {
  if (score >= 90) return { text: '#22c55e', bg: 'rgba(34,197,94,0.12)', ring: 'rgba(34,197,94,0.35)' }
  if (score >= 70) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.35)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', ring: 'rgba(239,68,68,0.35)' }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SEV = {
  high:   { label: 'HIGH',   cls: 'bg-red-900/30 text-red-400 border-red-800/50' },
  medium: { label: 'MED',    cls: 'bg-amber-900/30 text-amber-400 border-amber-800/50' },
  low:    { label: 'LOW',    cls: 'bg-gray-800 text-gray-400 border-gray-700' },
}

// ─── Component ────────────────────────────────────────────────────────────────

type RunState = 'idle' | 'loading' | 'done' | 'error'

export default function ChecksPanel({
  projectId,
  serveUrl,
  initialChecks,
}: {
  projectId: string
  serveUrl: string
  initialChecks: Check[]
}) {
  const [checks, setChecks] = useState<Check[]>(initialChecks)
  const [runState, setRunState] = useState<RunState>('idle')
  const [runError, setRunError] = useState('')
  const [passCount, setPassCount] = useState<number | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const latest = checks[0] ?? null

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'argus-axe-results') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        handleAxeResults(e.data.violations as AxeViolation[], e.data.passCount as number)
      } else if (e.data?.type === 'argus-axe-error') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setRunError(`axe error: ${e.data.message}`)
        setRunState('error')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, serveUrl])

  async function handleAxeResults(violations: AxeViolation[], pc: number) {
    const issues = dedupeIssues(mapViolations(violations))
    const highCount = issues.filter(i => i.severity === 'high').length
    const medCount  = issues.filter(i => i.severity === 'medium').length
    const summary = violations.length === 0
      ? `No violations found. ${pc} rules passed.`
      : `${violations.length} violation${violations.length !== 1 ? 's' : ''} (${highCount} high, ${medCount} medium). ${pc} rules passed.`

    setPassCount(pc)

    const res = await fetch('/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, type: 'a11y', summary, results: issues }),
    })
    const check: Check = await res.json()
    setChecks(prev => [check, ...prev])
    setRunState('done')
    // Remove hidden iframe
    if (iframeRef.current) {
      document.body.removeChild(iframeRef.current)
      iframeRef.current = null
    }
  }

  function runCheck() {
    // flushSync forces the loading state to paint before the iframe is created.
    // Without this, a cached prototype can post its axe results in < 100ms —
    // faster than React's normal batched render cycle — so the spinner never appears.
    flushSync(() => {
      setRunState('loading')
      setRunError('')
      setPassCount(null)
    })

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:800px;opacity:0;pointer-events:none;'
    iframe.src = serveUrl + (serveUrl.includes('?') ? '&' : '?') + '_argusAxe=1'
    document.body.appendChild(iframe)
    iframeRef.current = iframe

    timeoutRef.current = setTimeout(() => {
      setRunError('Timed out waiting for axe results (30s). The prototype may not load in an iframe.')
      setRunState('error')
      if (iframeRef.current) {
        document.body.removeChild(iframeRef.current)
        iframeRef.current = null
      }
    }, 30_000)
  }

  // ── UI ────────────────────────────────────────────────────────────────────────

  const score = latest ? scoreFromIssues(latest.results) : null
  const sc = score !== null ? scoreColor(score) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1c1c2b' }}>
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Accessibility</h3>
            {latest && (
              <p className="text-xs mt-0.5" style={{ color: '#5c5c78' }}>
                Last run {formatDate(latest.createdAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {score !== null && sc && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: sc.bg, border: `1px solid ${sc.ring}` }}>
              <span className="text-sm font-bold" style={{ color: sc.text }}>{score}</span>
              <span className="text-xs" style={{ color: sc.text }}>/ 100</span>
            </div>
          )}
          <button
            onClick={runCheck}
            disabled={runState === 'loading'}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#4f46e5' }}
          >
            {runState === 'loading' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin inline-block" />
                Scanning…
              </span>
            ) : 'Run A11y check'}
          </button>
        </div>
      </div>

      {/* Body */}
      {runState === 'error' && (
        <div className="px-5 py-3 text-sm text-red-400">{runError}</div>
      )}

      {!latest && runState !== 'loading' && (
        <div className="px-5 py-10 text-center" style={{ color: '#3a3a52' }}>
          <p className="text-sm">No check run yet.</p>
          <p className="text-xs mt-1" style={{ color: '#2a2a3a' }}>
            Click "Run A11y check" to scan your prototype with axe-core.
          </p>
        </div>
      )}

      {runState === 'loading' && (
        <div className="px-5 py-8 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-xs" style={{ color: '#5c5c78' }}>Loading prototype + running axe-core…</p>
        </div>
      )}

      {latest && runState !== 'loading' && (
        <div className="px-5 py-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm" style={{ color: '#9ca3af' }}>{latest.summary}</p>
            {passCount !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-3"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                {passCount} passed
              </span>
            )}
          </div>

          {latest.results.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <span className="text-green-400">✓</span>
              <p className="text-sm text-green-400">No accessibility violations found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {latest.results.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IssueRow({ issue }: { issue: CheckIssue }) {
  const [open, setOpen] = useState(false)
  const sev = SEV[issue.severity]

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1c1c2b' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${sev.cls}`}>
          {sev.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{issue.description}</p>
          {issue.element && (
            <code className="text-xs font-mono truncate block mt-0.5" style={{ color: '#5c5c78' }}>
              {issue.element}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {issue.wcagCriteria && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: '#1c1c2b', color: '#5c5c78' }}>
              {issue.wcagCriteria}
            </span>
          )}
          <span className="text-[10px]" style={{ color: '#3a3a52' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t" style={{ borderColor: '#1c1c2b' }}>
          {issue.element && (
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#3a3a52' }}>Element</p>
              <code className="text-xs font-mono break-all" style={{ color: '#9ca3af' }}>{issue.element}</code>
            </div>
          )}
          {issue.helpUrl && (
            <a
              href={issue.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:underline"
              style={{ color: '#4f46e5' }}
            >
              Learn more about {issue.wcagCriteria} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
