'use client'

import { useState, useMemo } from 'react'
import type { PathEvent, Comment } from '@/lib/types'

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

interface Session {
  id: string
  testerName: string
  path: PathEvent[]
}

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

interface Props {
  sessions: Session[]
  comments: Comment[]
  stats: ClickStat[]
  totalSessions: number
  totalClickEvents: number
}

// ── Comment Heatmap ───────────────────────────────────────────────────────────

const CANVAS_W = 640
const CANVAS_H = 400
const BLOB_R = 28

function HeatmapCanvas({ points }: { points: { ox: number; oy: number; text: string }[] }) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-sm"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          background: '#0c0c18',
          border: `1px solid ${S.border}`,
          color: S.dim,
          maxWidth: '100%',
        }}
      >
        No comment pins on this page
      </div>
    )
  }

  // Density grid for background glow
  const gridW = 32
  const gridH = 20
  const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(0))
  points.forEach(p => {
    const gx = Math.min(gridW - 1, Math.floor(p.ox * gridW))
    const gy = Math.min(gridH - 1, Math.floor(p.oy * gridH))
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx; const ny = gy + dy
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
          grid[ny][nx] += dy === 0 && dx === 0 ? 1 : 0.3
        }
      }
    }
  })
  const maxDensity = Math.max(...grid.flat(), 1)

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', borderRadius: 12, border: `1px solid ${S.border}`, maxWidth: '100%' }}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          <radialGradient id="blob-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#4f46e5" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
          <filter id="blur-heat">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Background */}
        <rect width={CANVAS_W} height={CANVAS_H} fill="#0c0c18" />

        {/* Grid density background */}
        {grid.map((row, gy) =>
          row.map((val, gx) => {
            if (val === 0) return null
            const opacity = (val / maxDensity) * 0.18
            return (
              <rect
                key={`${gx}-${gy}`}
                x={gx * (CANVAS_W / gridW)}
                y={gy * (CANVAS_H / gridH)}
                width={CANVAS_W / gridW + 1}
                height={CANVAS_H / gridH + 1}
                fill="#f97316"
                fillOpacity={opacity}
              />
            )
          })
        )}

        {/* Heat blobs */}
        <g filter="url(#blur-heat)">
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.ox * CANVAS_W}
              cy={p.oy * CANVAS_H}
              r={BLOB_R}
              fill="url(#blob-grad)"
            />
          ))}
        </g>

        {/* Pin dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.ox * CANVAS_W}
              cy={p.oy * CANVAS_H}
              r={6}
              fill="#f97316"
              stroke="#0c0c18"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <circle
              cx={p.ox * CANVAS_W}
              cy={p.oy * CANVAS_H}
              r={3}
              fill="white"
              opacity={0.8}
            />
          </g>
        ))}

        {/* Coordinate guide lines */}
        <line x1={CANVAS_W / 2} y1={0} x2={CANVAS_W / 2} y2={CANVAS_H} stroke="#ffffff" strokeOpacity={0.03} strokeWidth={1} />
        <line x1={0} y1={CANVAS_H / 2} x2={CANVAS_W} y2={CANVAS_H / 2} stroke="#ffffff" strokeOpacity={0.03} strokeWidth={1} />

        {/* Legend */}
        <text x={8} y={CANVAS_H - 8} fill="#3a3a52" fontSize={9} fontFamily="monospace">0,0</text>
        <text x={CANVAS_W - 28} y={CANVAS_H - 8} fill="#3a3a52" fontSize={9} fontFamily="monospace">1,1</text>
      </svg>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function InteractionsView({ sessions, comments, stats, totalSessions, totalClickEvents }: Props) {
  // All unique pages from comments
  const commentPages = useMemo(() => {
    const pages = new Set<string>()
    comments.forEach(c => {
      if (c.pageUrl) pages.add(c.pageUrl.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/')
    })
    return [...pages].sort()
  }, [comments])

  const [selectedPage, setSelectedPage] = useState<string>('all')

  const heatmapPoints = useMemo(() => {
    return comments
      .filter(c => {
        if (c.ox == null || c.oy == null) return false
        if (selectedPage === 'all') return true
        const cPage = (c.pageUrl ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
        return cPage === selectedPage
      })
      .map(c => ({ ox: c.ox!, oy: c.oy!, text: c.text ?? '' }))
  }, [comments, selectedPage])

  const commentsForPage = useMemo(() => {
    return comments.filter(c => {
      if (selectedPage === 'all') return true
      const cPage = (c.pageUrl ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
      return cPage === selectedPage
    })
  }, [comments, selectedPage])

  if (stats.length === 0 && comments.length === 0) {
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
              Click events and comments will appear here once testers run sessions.
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

        {/* Comment heatmap */}
        {comments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Comment heatmap</h2>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  {comments.filter(c => c.ox != null && c.oy != null).length} pinned comment{comments.filter(c => c.ox != null).length !== 1 ? 's' : ''} — normalized (0,0) top-left → (1,1) bottom-right
                </p>
              </div>
              {commentPages.length > 0 && (
                <select
                  value={selectedPage}
                  onChange={e => setSelectedPage(e.target.value)}
                  className="text-xs rounded-lg px-3 py-2 outline-none"
                  style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
                >
                  <option value="all">All pages ({comments.filter(c => c.ox != null).length})</option>
                  {commentPages.map(p => (
                    <option key={p} value={p}>
                      {p.length > 40 ? p.slice(0, 40) + '…' : p}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-6 items-start flex-wrap">
              <HeatmapCanvas points={heatmapPoints} />
              {/* Comments sidebar */}
              {commentsForPage.length > 0 && (
                <div className="flex-1 min-w-0 space-y-2" style={{ maxHeight: CANVAS_H, overflowY: 'auto' }}>
                  {commentsForPage.map((c, i) => (
                    <div
                      key={c.id ?? i}
                      className="rounded-lg px-3 py-2.5"
                      style={{ background: S.card, border: `1px solid ${S.border}` }}
                    >
                      {c.ox != null && c.oy != null && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: '#f97316' }}
                          />
                          <span className="text-[10px] font-mono" style={{ color: S.dim }}>
                            ({c.ox.toFixed(2)}, {c.oy.toFixed(2)})
                          </span>
                        </div>
                      )}
                      <p className="text-xs leading-relaxed" style={{ color: '#e0e7ff' }}>{c.text}</p>
                      {c.pageUrl && (
                        <p className="text-[10px] font-mono mt-1 truncate" style={{ color: S.dim }}>
                          {(c.pageUrl ?? '').replace(/^https?:\/\/[^/]+/, '') || '/'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Click frequency table */}
        {stats.length > 0 && (
          <section>
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
          </section>
        )}
      </div>
    </div>
  )
}
