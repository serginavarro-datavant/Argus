'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
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

interface HeatPoint {
  x: number   // px from left of iframe
  y: number   // px from top of iframe
  heat: number // 0–1
  label: string
  clicks: number
}

interface Props {
  stats: ClickStat[]
  totalSessions: number
  totalClickEvents: number
  serveBaseUrl: string   // e.g. /serve/fjbpvnumsh77ah1/index.html
}

// ── Click heatmap overlay ─────────────────────────────────────────────────────

function ClickHeatmap({ stats, totalSessions, serveBaseUrl }: {
  stats: ClickStat[]
  totalSessions: number
  serveBaseUrl: string
}) {
  // All unique page URLs present in click data (path-only)
  const pageUrls = useMemo(() => {
    const pages = new Set<string>()
    stats.forEach(s => { if (s.url) pages.add(s.url) })
    return [...pages].sort()
  }, [stats])

  // Prefer /serve/ URLs (prototype pages) over bare / fallbacks
  const [selectedUrl, setSelectedUrl] = useState<string>(
    () => pageUrls.find(u => u.startsWith('/serve/')) ?? pageUrls[0] ?? ''
  )
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([])
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Stats for the currently selected page
  const statsForPage = useMemo(() =>
    stats.filter(s => s.url === selectedUrl),
    [stats, selectedUrl],
  )

  const maxSessions = Math.max(...statsForPage.map(s => s.uniqueSessions), 1)

  // Use selectedUrl if it's a prototype path, otherwise fall back to serveBaseUrl
  const iframeSrc = selectedUrl.startsWith('/serve/') ? selectedUrl : serveBaseUrl

  const computeHeat = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return

    setLookupStatus('loading')
    const points: HeatPoint[] = []

    for (const stat of statsForPage) {
      if (!stat.selector) continue
      try {
        const el = doc.querySelector(stat.selector) as HTMLElement | null
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        points.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          heat: stat.uniqueSessions / maxSessions,
          label: stat.label || stat.selector,
          clicks: stat.uniqueSessions,
        })
      } catch {}
    }

    setHeatPoints(points)
    setLookupStatus(points.length > 0 ? 'done' : 'error')
  }, [statsForPage, maxSessions])

  // Attach load listener; also fire immediately if already loaded (avoids race on hydration)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const run = () => {
      setIframeLoaded(true)
      setHeatPoints([])
      setLookupStatus('idle')
      setTimeout(computeHeat, 1400)
    }

    try {
      if (iframe.contentDocument?.readyState === 'complete') {
        run()
        return
      }
    } catch {}

    iframe.addEventListener('load', run)
    return () => iframe.removeEventListener('load', run)
  }, [computeHeat])

  // Reset when page selection changes
  useEffect(() => {
    setIframeLoaded(false)
    setHeatPoints([])
    setLookupStatus('idle')
  }, [selectedUrl])

  if (statsForPage.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm" style={{ color: S.dim }}>
        No click data for this page
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Page selector */}
      {pageUrls.length > 1 && (
        <select
          value={selectedUrl}
          onChange={e => setSelectedUrl(e.target.value)}
          className="text-xs rounded-lg px-3 py-2 outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
        >
          {pageUrls.map(p => (
            <option key={p} value={p}>{p || '/'}</option>
          ))}
        </select>
      )}

      {/* Iframe + overlay */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden"
        style={{ border: `1px solid ${S.border}`, height: 540 }}
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-full border-0"
          title="Prototype heatmap"
        />

        {/* SVG heat overlay */}
        {heatPoints.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <filter id="heat-blur">
                <feGaussianBlur stdDeviation="18" />
              </filter>
            </defs>
            {/* Blur blobs */}
            <g filter="url(#heat-blur)">
              {heatPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={36}
                  fill={`rgba(239,68,68,${0.25 + p.heat * 0.55})`}
                />
              ))}
            </g>
            {/* Crisp dots */}
            {heatPoints.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={10} fill={`rgba(239,68,68,${0.35 + p.heat * 0.45})`} />
                <circle cx={p.x} cy={p.y} r={4} fill="white" fillOpacity={0.9} />
                {/* click count badge */}
                <rect
                  x={p.x + 7} y={p.y - 10}
                  width={Math.max(20, String(p.clicks).length * 7 + 6)}
                  height={14}
                  rx={4}
                  fill="rgba(0,0,0,0.75)"
                />
                <text
                  x={p.x + 7 + Math.max(20, String(p.clicks).length * 7 + 6) / 2}
                  y={p.y - 10 + 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize={9}
                  fontWeight="600"
                >
                  {p.clicks}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Loading/status overlay */}
        {!iframeLoaded && heatPoints.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ background: 'rgba(11,11,19,0.7)', color: S.muted }}>
            Loading prototype…
          </div>
        )}
        {iframeLoaded && lookupStatus === 'loading' && (
          <div
            className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-md"
            style={{ background: 'rgba(0,0,0,0.7)', color: S.muted }}
          >
            Mapping elements…
          </div>
        )}
        {iframeLoaded && lookupStatus === 'error' && (
          <div
            className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-md"
            style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            Selectors not found — dynamic content may have shifted
          </div>
        )}
        {iframeLoaded && lookupStatus === 'done' && (
          <button
            onClick={computeHeat}
            className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-80"
            style={{ background: 'rgba(0,0,0,0.6)', color: S.dim }}
          >
            ↻ refresh
          </button>
        )}
      </div>

      {/* Element list for this page */}
      <div className="space-y-1">
        {statsForPage.slice(0, 8).map((stat, i) => {
          const heatPct = totalSessions > 0 ? Math.round(stat.uniqueSessions / totalSessions * 100) : 0
          const displayLabel = stat.label || stat.selector || `<${stat.role || 'element'}>`
          return (
            <div
              key={stat.key}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{ background: S.card, border: `1px solid ${S.border}` }}
            >
              <span className="text-xs w-4 text-center flex-shrink-0" style={{ color: S.dim }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block" style={{ color: '#e0e7ff' }}>{displayLabel}</span>
                {stat.selector !== displayLabel && (
                  <span className="text-[10px] font-mono truncate block mt-0.5" style={{ color: S.dim }}>{stat.selector}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: S.border, width: 48 }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${heatPct}%`,
                      background: heatPct >= 67 ? '#ef4444' : heatPct >= 34 ? '#f97316' : '#4f46e5',
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums" style={{ color: S.muted }}>{stat.uniqueSessions}/{totalSessions}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function InteractionsView({ stats, totalSessions, totalClickEvents, serveBaseUrl }: Props) {
  if (stats.length === 0) {
    return (
      <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Interactions</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>
            Elements clicked across {totalSessions} session{totalSessions !== 1 ? 's' : ''}
          </p>
        </div>
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
      </div>
    )
  }

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Interactions</h1>
        <p className="text-sm mt-0.5" style={{ color: S.muted }}>
          Elements clicked across {totalSessions} session{totalSessions !== 1 ? 's' : ''} — {totalClickEvents} total clicks
        </p>
      </div>

      <div className="space-y-8">
        {/* KPI strip */}
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

        {/* Click heatmap */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">Click heatmap</h2>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>
              Overlay on the live prototype — red = most clicked
            </p>
          </div>
          <ClickHeatmap stats={stats} totalSessions={totalSessions} serveBaseUrl={serveBaseUrl} />
        </section>

        {/* Full click frequency table */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Click frequency — all pages</h2>
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
                                background: heatPct >= 67 ? '#ef4444' : heatPct >= 34 ? '#f97316' : '#4a4a6a',
                              }}
                            />
                          </div>
                          <span className="text-[10px]" style={{ color: heatPct >= 67 ? '#ef4444' : S.dim }}>{heatPct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
