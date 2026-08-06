'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Check, CheckIssue } from '@/lib/types'
import { formatDate } from '@/lib/utils'

// ─── Types from scanner ───────────────────────────────────────────────────────

interface AxeViolation {
  id: string
  description: string
  help: string
  helpUrl: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null
  tags: string[]
  nodes: Array<{ target: string[]; html: string }>
}

interface StyleSample { value: string; selector: string; prop: string }
interface TextSample  { text: string; tag: string; selector: string }
interface FontSample  { font: string; selector: string }

// ─── Score helpers ─────────────────────────────────────────────────────────────

function scoreFromIssues(issues: CheckIssue[]): number {
  const deduction = issues.reduce((acc, i) => acc + (i.severity === 'high' ? 10 : i.severity === 'medium' ? 5 : 2), 0)
  return Math.max(0, 100 - deduction)
}

function scoreColor(score: number) {
  if (score >= 80) return { text: '#22c55e', bg: 'rgba(34,197,94,0.1)', ring: 'rgba(34,197,94,0.3)' }
  if (score >= 60) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', ring: 'rgba(245,158,11,0.3)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)', ring: 'rgba(239,68,68,0.3)' }
}

// ─── Axe → CheckIssue ────────────────────────────────────────────────────────

function mapViolations(violations: AxeViolation[]): CheckIssue[] {
  const seen = new Set<string>()
  return violations.flatMap(v =>
    v.nodes.map(n => {
      const severity = (v.impact === 'critical' || v.impact === 'serious') ? 'high' as const
        : v.impact === 'moderate' ? 'medium' as const : 'low' as const
      return { severity, description: v.help, element: n.target[0] ?? n.html.slice(0, 80),
        wcagCriteria: v.tags.find(t => t.startsWith('wcag')) ?? v.id, helpUrl: v.helpUrl }
    })
  ).filter(i => {
    const key = `${i.wcagCriteria}:${i.element}`
    if (seen.has(key)) return false
    seen.add(key); return true
  }).slice(0, 40)
}

// ─── SEV badge styles ─────────────────────────────────────────────────────────

const SEV_CLS = {
  high:   'bg-red-900/30 text-red-400 border-red-800/50',
  medium: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  low:    'bg-gray-800 text-gray-400 border-gray-700',
}
const SEV_LABEL = { high: 'HIGH', medium: 'MED', low: 'LOW' }

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const sc = scoreColor(score)
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0"
      style={{ background: sc.bg, border: `1px solid ${sc.ring}` }}>
      <span className="text-sm font-bold tabular-nums" style={{ color: sc.text }}>{score}</span>
      <span className="text-xs" style={{ color: sc.text, opacity: 0.7 }}>/&nbsp;100</span>
    </div>
  )
}

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({ issue, serveUrl }: { issue: CheckIssue; serveUrl: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1c1c2b' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${SEV_CLS[issue.severity]}`}>
          {SEV_LABEL[issue.severity]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">{issue.description}</p>
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
        <div className="px-3 pb-3 pt-1.5 space-y-2 border-t" style={{ borderColor: '#1c1c2b' }}>
          {issue.element && (
            <div className="flex items-center justify-between gap-3">
              <code className="text-xs font-mono break-all flex-1" style={{ color: '#9ca3af' }}>{issue.element}</code>
              <a
                href={`${serveUrl}${serveUrl.includes('?') ? '&' : '?'}_argusHighlight=${encodeURIComponent(issue.element)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: '#1c1c2b', color: '#9ca3af', border: '1px solid #2a2a3e' }}
                onClick={e => e.stopPropagation()}
              >
                View in prototype ↗
              </a>
            </div>
          )}
          {issue.helpUrl && (
            <a href={issue.helpUrl} target="_blank" rel="noreferrer"
              className="text-xs hover:underline block" style={{ color: '#4f46e5' }}>
              Learn more about {issue.wcagCriteria} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Check section ────────────────────────────────────────────────────────────

type RunState = 'idle' | 'loading' | 'done' | 'error'

function CheckSection({
  title, subtitle, icon,
  runState, error, latestCheck, passCount,
  isScanning, onRun, serveUrl,
}: {
  title: string
  subtitle: string
  icon: string
  runState: RunState
  error: string
  latestCheck: Check | null
  passCount?: number | null
  isScanning: boolean
  onRun: () => void
  serveUrl: string
}) {
  const score = latestCheck ? scoreFromIssues(latestCheck.results) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1c1c2b' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs mt-0.5" style={{ color: '#5c5c78' }}>
              {latestCheck ? `Last run ${formatDate(latestCheck.createdAt)}` : subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {score !== null && <ScoreBadge score={score} />}
          <button
            onClick={onRun}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#1e1e30', border: '1px solid #2a2a3e' }}
          >
            {runState === 'loading' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin inline-block" />
                Scanning…
              </span>
            ) : latestCheck ? 'Re-run' : 'Run'}
          </button>
        </div>
      </div>

      {/* Body */}
      {error && (
        <div className="px-5 py-3 text-sm text-red-400">{error}</div>
      )}

      {runState === 'loading' && !latestCheck && (
        <div className="px-5 py-8 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-xs" style={{ color: '#5c5c78' }}>Running {title.toLowerCase()} scan…</p>
        </div>
      )}

      {!latestCheck && runState !== 'loading' && !error && (
        <div className="px-5 py-8 text-center" style={{ color: '#3a3a52' }}>
          <p className="text-sm">No scan run yet.</p>
        </div>
      )}

      {latestCheck && runState !== 'loading' && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm leading-snug" style={{ color: '#9ca3af' }}>{latestCheck.summary}</p>
            {passCount != null && (
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-3"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                {passCount} passed
              </span>
            )}
          </div>
          {latestCheck.results.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <span className="text-green-400 text-sm">✓</span>
              <p className="text-sm text-green-400">No issues found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {latestCheck.results.map((issue, i) => (
                <IssueRow key={i} issue={issue} serveUrl={serveUrl} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Still updating (re-run in progress but old results shown) */}
      {latestCheck && runState === 'loading' && (
        <div className="px-5 py-2 flex items-center gap-2 border-t" style={{ borderColor: '#1c1c2b' }}>
          <div className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-xs" style={{ color: '#5c5c78' }}>Refreshing…</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const [a11yState, setA11yState] = useState<RunState>('idle')
  const [copyState, setCopyState] = useState<RunState>('idle')
  const [dsState,   setDsState]   = useState<RunState>('idle')

  const [a11yError, setA11yError] = useState('')
  const [copyError, setCopyError] = useState('')
  const [dsError,   setDsError]   = useState('')

  const [a11yPassCount, setA11yPassCount] = useState<number | null>(null)

  const iframeRef    = useRef<HTMLIFrameElement | null>(null)
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTargetRef = useRef<'a11y' | 'copy' | 'ds' | 'all' | null>(null)

  const isScanning = a11yState === 'loading' || copyState === 'loading' || dsState === 'loading'

  // Latest check per type (most recent first)
  const latestA11y = checks.filter(c => c.type === 'a11y').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestCopy = checks.filter(c => c.type === 'copy').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestDs   = checks.filter(c => c.type === 'ds').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null

  // Overall health: average of available scores
  const scores = [latestA11y, latestCopy, latestDs].filter(Boolean).map(c => scoreFromIssues(c!.results))
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  function cleanup() {
    if (iframeRef.current) { document.body.removeChild(iframeRef.current); iframeRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  async function handleA11y(violations: AxeViolation[], pc: number) {
    const issues = mapViolations(violations)
    const highCount = issues.filter(i => i.severity === 'high').length
    const medCount  = issues.filter(i => i.severity === 'medium').length
    const summary   = violations.length === 0
      ? `No violations found. ${pc} rules passed.`
      : `${violations.length} violation${violations.length !== 1 ? 's' : ''} (${highCount} high, ${medCount} medium). ${pc} rules passed.`

    setA11yPassCount(pc)
    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'a11y', summary, results: issues }),
      })
      const check: Check = await res.json()
      setChecks(prev => [check, ...prev.filter(c => c.id !== check.id)])
      setA11yState('done')
    } catch {
      setA11yError('Failed to save a11y results.')
      setA11yState('error')
    }
  }

  async function handleCopy(texts: TextSample[]) {
    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'copy', texts }),
      })
      const check: Check = await res.json()
      setChecks(prev => [check, ...prev.filter(c => c.id !== check.id)])
      setCopyState('done')
    } catch {
      setCopyError('Failed to run copy analysis.')
      setCopyState('error')
    }
  }

  async function handleDS(colors: StyleSample[], fonts: FontSample[]) {
    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'ds', colors, fonts }),
      })
      const check: Check = await res.json()
      setChecks(prev => [check, ...prev.filter(c => c.id !== check.id)])
      setDsState('done')
    } catch {
      setDsError('Failed to run DS compliance check.')
      setDsState('error')
    }
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const target = scanTargetRef.current
      if (!target) return

      if (e.data?.type === 'argus-scan-complete') {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        cleanup()

        const { axeViolations, axePassCount, texts, colors, fonts } = e.data as {
          axeViolations: AxeViolation[]
          axePassCount: number
          texts: TextSample[]
          colors: StyleSample[]
          fonts: FontSample[]
        }

        if (target === 'all' || target === 'a11y') handleA11y(axeViolations, axePassCount)
        if (target === 'all' || target === 'copy') handleCopy(texts)
        if (target === 'all' || target === 'ds')   handleDS(colors, fonts)

      } else if (e.data?.type === 'argus-axe-error') {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        cleanup()
        const msg = `Scan error: ${e.data.message}`
        if (target === 'all' || target === 'a11y') { setA11yError(msg); setA11yState('error') }
        if (target === 'all' || target === 'copy') { setCopyError(msg); setCopyState('error') }
        if (target === 'all' || target === 'ds')   { setDsError(msg);   setDsState('error') }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function triggerScan(target: 'a11y' | 'copy' | 'ds' | 'all') {
    scanTargetRef.current = target

    // flushSync: force loading state to paint BEFORE the iframe is created.
    // Without this, cached prototypes post results in < 100ms — before React's
    // batched render cycle — so the spinner is never visible.
    flushSync(() => {
      if (target === 'all' || target === 'a11y') { setA11yState('loading'); setA11yError('') }
      if (target === 'all' || target === 'copy') { setCopyState('loading'); setCopyError('') }
      if (target === 'all' || target === 'ds')   { setDsState('loading');   setDsError('') }
    })

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:800px;opacity:0;pointer-events:none;'
    iframe.src = serveUrl + (serveUrl.includes('?') ? '&' : '?') + '_argusScan=1'
    document.body.appendChild(iframe)
    iframeRef.current = iframe

    timeoutRef.current = setTimeout(() => {
      const msg = 'Timed out (30s). The prototype may not load in an iframe.'
      if (target === 'all' || target === 'a11y') { setA11yError(msg); setA11yState('error') }
      if (target === 'all' || target === 'copy') { setCopyError(msg); setCopyState('error') }
      if (target === 'all' || target === 'ds')   { setDsError(msg);   setDsState('error') }
      cleanup()
    }, 30_000)
  }

  return (
    <div className="space-y-4">
      {/* Health summary header */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ background: '#111119', border: '1px solid #1c1c2b' }}>
        <div>
          <h2 className="text-sm font-semibold text-white">UX Health</h2>
          <p className="text-xs mt-0.5" style={{ color: '#5c5c78' }}>
            {scores.length > 0
              ? `Based on ${scores.length} of 3 check${scores.length !== 1 ? 's' : ''}`
              : 'Run all three checks to see an overall score'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overallScore !== null && <ScoreBadge score={overallScore} />}
          <button
            onClick={() => triggerScan('all')}
            disabled={isScanning}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#2945F0' }}
          >
            {isScanning ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin inline-block" />
                Scanning…
              </span>
            ) : 'Run all checks'}
          </button>
        </div>
      </div>

      {/* A11y */}
      <CheckSection
        title="Accessibility"
        subtitle="WCAG 2.1 AA — contrast, labels, roles, focus order"
        icon="♿"
        runState={a11yState}
        error={a11yError}
        latestCheck={latestA11y}
        passCount={a11yPassCount}
        isScanning={isScanning}
        onRun={() => triggerScan('a11y')}
        serveUrl={serveUrl}
      />

      {/* Copy */}
      <CheckSection
        title="Copywriting"
        subtitle="Clarity, tone, jargon, CTAs, error messages"
        icon="✍️"
        runState={copyState}
        error={copyError}
        latestCheck={latestCopy}
        isScanning={isScanning}
        onRun={() => triggerScan('copy')}
        serveUrl={serveUrl}
      />

      {/* Design system */}
      <CheckSection
        title="Design System"
        subtitle="DART palette — colors, spacing, typography"
        icon="🎨"
        runState={dsState}
        error={dsError}
        latestCheck={latestDs}
        isScanning={isScanning}
        onRun={() => triggerScan('ds')}
        serveUrl={serveUrl}
      />
    </div>
  )
}
