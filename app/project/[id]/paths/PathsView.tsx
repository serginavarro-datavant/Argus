'use client'

import { useState, useMemo } from 'react'
import type { Session, Scenario, TaskResult } from '@/lib/types'

const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

function normUrl(raw: string) {
  return raw.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
}

interface Props {
  sessions: Session[]
  scenarios: Scenario[]
  taskResults: TaskResult[]
}

export default function PathsView({ sessions, scenarios, taskResults }: Props) {
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')

  const visibleSessions = useMemo(() =>
    scenarioFilter === 'all' ? sessions : sessions.filter(s => s.scenarioId === scenarioFilter),
    [sessions, scenarioFilter],
  )

  const activeScenario = scenarioFilter !== 'all' ? (scenarios.find(s => s.id === scenarioFilter) ?? null) : null

  const filteredTaskResults = useMemo(() => {
    const ids = new Set(visibleSessions.map(s => s.id))
    return taskResults.filter(r => ids.has(r.sessionId))
  }, [visibleSessions, taskResults])

  const urlCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>()
    for (const s of visibleSessions) {
      for (const ev of s.path) {
        if (ev.type !== 'navigation' || !ev.url) continue
        const p = normUrl(ev.url)
        if (!counts.has(p)) counts.set(p, new Set())
        counts.get(p)!.add(s.id)
      }
    }
    return [...counts.entries()]
      .map(([url, sids]) => ({ url, count: sids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  }, [visibleSessions])

  // Consecutive navigation transitions
  const transitions = useMemo(() => {
    const map = new Map<string, { from: string; to: string; count: number; sessionIds: Set<string> }>()
    for (const s of visibleSessions) {
      const navs = s.path
        .filter(e => e.type === 'navigation' && e.url)
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
      for (let i = 0; i < navs.length - 1; i++) {
        const from = normUrl(navs[i].url!)
        const to = normUrl(navs[i + 1].url!)
        if (from === to) continue
        const key = `${from}|||${to}`
        if (!map.has(key)) map.set(key, { from, to, count: 0, sessionIds: new Set() })
        const e = map.get(key)!
        e.count++
        e.sessionIds.add(s.id)
      }
    }
    return [...map.values()]
      .sort((a, b) => b.sessionIds.size - a.sessionIds.size || b.count - a.count)
      .slice(0, 15)
      .map(e => ({ ...e, uniqueSessions: e.sessionIds.size }))
  }, [visibleSessions])

  // Most common full navigation paths
  const commonPaths = useMemo(() => {
    const pathMap = new Map<string, { pages: string[]; count: number; testers: string[] }>()
    for (const s of visibleSessions) {
      const navs = s.path
        .filter(e => e.type === 'navigation' && e.url)
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
      const pages: string[] = []
      for (const ev of navs) {
        const p = normUrl(ev.url!)
        if (pages[pages.length - 1] !== p) pages.push(p)
      }
      if (pages.length === 0) continue
      const key = pages.join('\n')
      if (!pathMap.has(key)) pathMap.set(key, { pages, count: 0, testers: [] })
      const e = pathMap.get(key)!
      e.count++
      if (!e.testers.includes(s.testerName)) e.testers.push(s.testerName)
    }
    return [...pathMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [visibleSessions])

  const total = visibleSessions.length

  // Node-link flow for SVG Sankey
  const sankeyData = useMemo(() => {
    if (transitions.length === 0) return null
    // Collect all unique nodes
    const nodeSet = new Set<string>()
    transitions.forEach(t => { nodeSet.add(t.from); nodeSet.add(t.to) })
    const nodes = [...nodeSet]

    // Assign column depth via BFS from nodes that have no incoming edges
    const incomingEdges = new Map<string, number>()
    nodes.forEach(n => incomingEdges.set(n, 0))
    transitions.forEach(t => incomingEdges.set(t.to, (incomingEdges.get(t.to) ?? 0) + 1))

    const depths = new Map<string, number>()
    const queue: string[] = nodes.filter(n => (incomingEdges.get(n) ?? 0) === 0)
    queue.forEach(n => depths.set(n, 0))
    const visited = new Set(queue)
    let qi = 0
    while (qi < queue.length) {
      const cur = queue[qi++]
      const curDepth = depths.get(cur) ?? 0
      transitions.filter(t => t.from === cur).forEach(t => {
        const next = t.to
        const existing = depths.get(next)
        const newDepth = curDepth + 1
        if (existing === undefined || newDepth > existing) depths.set(next, newDepth)
        if (!visited.has(next)) { visited.add(next); queue.push(next) }
      })
    }
    // Fallback: unvisited get depth 0
    nodes.filter(n => !depths.has(n)).forEach(n => depths.set(n, 0))

    const maxDepth = Math.max(...[...depths.values()])
    const numCols = maxDepth + 1

    // Group nodes by column
    const cols: string[][] = Array.from({ length: numCols }, () => [])
    nodes.forEach(n => cols[depths.get(n) ?? 0].push(n))

    const maxSessionsForEdge = Math.max(...transitions.map(t => t.uniqueSessions), 1)

    return { nodes, depths, cols, numCols, maxSessionsForEdge }
  }, [transitions])

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Paths</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>Navigation flow and task completion funnel</p>
        </div>
        {scenarios.length > 0 && (
          <select
            value={scenarioFilter}
            onChange={e => setScenarioFilter(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
          >
            <option value="all">All sessions ({sessions.length})</option>
            {scenarios.map(sc => (
              <option key={sc.id} value={sc.id}>
                {sc.title} ({sessions.filter(s => s.scenarioId === sc.id).length})
              </option>
            ))}
          </select>
        )}
      </div>

      {total === 0 ? (
        <Empty label="No sessions to show paths." />
      ) : (
        <>
          {/* Task funnel */}
          {activeScenario && activeScenario.tasks.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-1">{activeScenario.title}</h2>
              <p className="text-xs mb-5" style={{ color: S.muted }}>
                Task completion funnel — {total} session{total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-3">
                {activeScenario.tasks.map((task, i) => {
                  const results = filteredTaskResults.filter(r => r.taskIndex === i)
                  const completed = results.filter(r => r.completed).length
                  const attempted = results.length
                  const pct = attempted ? Math.round(completed / attempted * 100) : (total > 0 ? 0 : null)
                  const prevResults = i > 0 ? filteredTaskResults.filter(r => r.taskIndex === i - 1) : null
                  const prevAttempted = prevResults?.length ?? total
                  const dropOff = prevAttempted > 0 && attempted < prevAttempted
                    ? Math.round((prevAttempted - attempted) / prevAttempted * 100)
                    : null

                  return (
                    <div key={task.id}>
                      {dropOff !== null && dropOff > 0 && (
                        <div className="flex items-center gap-2 mb-1 pl-2">
                          <span className="text-[10px]" style={{ color: '#f87171' }}>↓ {dropOff}% dropped off</span>
                        </div>
                      )}
                      <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                              style={{ background: pct !== null && pct >= 60 ? '#059669' : pct !== null && pct >= 30 ? '#d97706' : '#dc2626' }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm text-white truncate">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <span className="text-xs font-semibold" style={{ color: '#e0e7ff' }}>
                              {completed}/{attempted || total}
                            </span>
                            {pct !== null && (
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background: pct >= 60 ? 'rgba(5,150,105,0.15)' : pct >= 30 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
                                  color: pct >= 60 ? '#34d399' : pct >= 30 ? '#fbbf24' : '#f87171',
                                }}
                              >
                                {pct}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-full overflow-hidden h-1.5" style={{ background: S.border }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct ?? 0}%`,
                              background: pct !== null && pct >= 60 ? '#059669' : pct !== null && pct >= 30 ? '#d97706' : '#dc2626',
                            }}
                          />
                        </div>
                        {task.description && (
                          <p className="text-xs mt-2 line-clamp-1" style={{ color: S.dim }}>{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {visibleSessions.map((s) => {
                            const r = filteredTaskResults.find(r => r.sessionId === s.id && r.taskIndex === i)
                            const color = r?.completed ? '#34d399' : r ? '#f87171' : S.border
                            return (
                              <span
                                key={s.id}
                                title={`${s.testerName}: ${r?.completed ? 'completed' : r ? 'stuck' : 'no data'}`}
                                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white"
                                style={{ background: color }}
                              >
                                {s.testerName.charAt(0).toUpperCase()}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Flow transitions */}
          {transitions.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-1">Flow transitions</h2>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Page-to-page navigation steps — {total} session{total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5 max-w-2xl">
                {transitions.map((t, i) => {
                  const sessionPct = total > 0 ? Math.round(t.uniqueSessions / total * 100) : 0
                  return (
                    <div
                      key={i}
                      className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: S.card, border: `1px solid ${S.border}` }}
                    >
                      <span className="text-xs w-4 flex-shrink-0 text-center" style={{ color: S.dim }}>{i + 1}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span
                          className="text-xs font-mono truncate max-w-[160px]"
                          style={{ color: '#94a3b8' }}
                          title={t.from}
                        >
                          {t.from}
                        </span>
                        <span style={{ color: S.dim, flexShrink: 0 }}>→</span>
                        <span
                          className="text-xs font-mono truncate max-w-[160px]"
                          style={{ color: '#e0e7ff' }}
                          title={t.to}
                        >
                          {t.to}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs tabular-nums" style={{ color: '#a5b4fc' }}>
                          {t.uniqueSessions}/{total}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: S.border, width: 48 }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${sessionPct}%`,
                                background: sessionPct >= 67 ? '#f97316' : sessionPct >= 34 ? '#4f46e5' : '#4a4a6a',
                              }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums" style={{ color: S.dim }}>{sessionPct}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Common paths */}
          {commonPaths.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-1">Common paths</h2>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Most frequent end-to-end navigation sequences
              </p>
              <div className="space-y-3 max-w-3xl">
                {commonPaths.map((cp, pi) => (
                  <div
                    key={pi}
                    className="rounded-xl p-4"
                    style={{ background: S.card, border: `1px solid ${S.border}` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ background: USER_COLORS[pi % USER_COLORS.length] }}
                        >
                          {pi + 1}
                        </span>
                        <span className="text-xs font-semibold text-white">{cp.count} session{cp.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex gap-1">
                        {cp.testers.slice(0, 4).map((t, ti) => (
                          <span
                            key={ti}
                            title={t}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: USER_COLORS[ti % USER_COLORS.length] }}
                          >
                            {t.charAt(0).toUpperCase()}
                          </span>
                        ))}
                        {cp.testers.length > 4 && (
                          <span className="text-[9px]" style={{ color: S.dim }}>+{cp.testers.length - 4}</span>
                        )}
                      </div>
                    </div>
                    {/* Page sequence chips */}
                    <div className="flex items-center flex-wrap gap-1">
                      {cp.pages.map((page, gi) => (
                        <span key={gi} className="flex items-center gap-1">
                          <span
                            className="text-[10px] font-mono px-2 py-1 rounded-md"
                            style={{ background: '#0c0c18', border: `1px solid ${S.border}`, color: '#94a3b8' }}
                            title={page}
                          >
                            {page.length > 28 ? page.slice(0, 28) + '…' : page}
                          </span>
                          {gi < cp.pages.length - 1 && (
                            <span className="text-[10px]" style={{ color: S.dim }}>→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sankey flow diagram */}
          {sankeyData && sankeyData.numCols >= 2 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-1">Flow diagram</h2>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Transition connections between pages — line weight = session volume
              </p>
              <FlowDiagram
                transitions={transitions}
                sankeyData={sankeyData}
                total={total}
              />
            </section>
          )}

          {/* Page visits */}
          {urlCounts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white mb-1">Page visits</h2>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Unique screens visited — {total} session{total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2 max-w-2xl">
                {urlCounts.map(({ url, count }, i) => (
                  <div key={url} className="flex items-center gap-4 rounded-xl p-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                    <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: S.dim }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono truncate" style={{ color: '#94a3b8' }}>{url}</span>
                        <span className="text-xs ml-3 flex-shrink-0 font-semibold" style={{ color: '#a5b4fc' }}>{count}/{total}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: S.border }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(count / total * 100)}%`, background: '#4f46e5' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!activeScenario && urlCounts.length === 0 && transitions.length === 0 && (
            <Empty label="No navigation data recorded yet." />
          )}
        </>
      )}
    </div>
  )
}

// ── Flow Diagram ──────────────────────────────────────────────────────────────

interface SankeyData {
  nodes: string[]
  depths: Map<string, number>
  cols: string[][]
  numCols: number
  maxSessionsForEdge: number
}

interface TransitionRow {
  from: string
  to: string
  count: number
  uniqueSessions: number
}

function FlowDiagram({ transitions, sankeyData, total }: {
  transitions: TransitionRow[]
  sankeyData: SankeyData
  total: number
}) {
  const { cols, numCols, maxSessionsForEdge } = sankeyData

  const NODE_W = 140
  const NODE_H = 28
  const COL_GAP = 120
  const ROW_GAP = 12
  const PAD_X = 16
  const PAD_Y = 16

  const colX = (col: number) => PAD_X + col * (NODE_W + COL_GAP)
  const nodeYs = new Map<string, number>()
  let svgH = PAD_Y * 2

  cols.forEach((colNodes, ci) => {
    const colH = colNodes.length * NODE_H + Math.max(0, colNodes.length - 1) * ROW_GAP
    const startY = PAD_Y
    colNodes.forEach((node, ri) => {
      nodeYs.set(node, startY + ri * (NODE_H + ROW_GAP))
    })
    svgH = Math.max(svgH, PAD_Y * 2 + colH)
  })

  const svgW = PAD_X * 2 + numCols * NODE_W + (numCols - 1) * COL_GAP

  return (
    <div className="rounded-xl overflow-auto" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <svg
        width={Math.max(svgW, 400)}
        height={Math.max(svgH, 120)}
        style={{ display: 'block' }}
      >
        {/* Edges */}
        {transitions.map((t, i) => {
          const x1 = colX(sankeyData.depths.get(t.from) ?? 0) + NODE_W
          const y1 = (nodeYs.get(t.from) ?? 0) + NODE_H / 2
          const x2 = colX(sankeyData.depths.get(t.to) ?? 0)
          const y2 = (nodeYs.get(t.to) ?? 0) + NODE_H / 2
          const cpX = (x1 + x2) / 2
          const strokeW = Math.max(1, Math.round(t.uniqueSessions / maxSessionsForEdge * 6))
          const opacity = 0.2 + (t.uniqueSessions / maxSessionsForEdge) * 0.55
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${cpX} ${y1}, ${cpX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#4f46e5"
              strokeWidth={strokeW}
              strokeOpacity={opacity}
            />
          )
        })}
        {/* Nodes */}
        {sankeyData.nodes.map(node => {
          const col = sankeyData.depths.get(node) ?? 0
          const x = colX(col)
          const y = nodeYs.get(node) ?? 0
          const label = node.length > 18 ? node.slice(0, 18) + '…' : node
          return (
            <g key={node}>
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill="#1a1a2e"
                stroke="#2a2a4a"
                strokeWidth={1}
              />
              <text
                x={x + NODE_W / 2}
                y={y + NODE_H / 2 + 4}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={9}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="px-4 py-2 border-t text-[10px]" style={{ borderColor: S.border, color: S.dim }}>
        Line weight = session volume · {total} session{total !== 1 ? 's' : ''} · {transitions.length} transitions
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm" style={{ color: S.dim }}>{label}</p>
    </div>
  )
}
