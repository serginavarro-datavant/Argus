'use client'

import { useState } from 'react'
import type { Session, Comment, Scenario, PathEvent } from '@/lib/types'
import { formatDate, elapsed } from '@/lib/utils'

interface Props {
  projectId: string
  initialSessions: Session[]
  initialScenarios: Scenario[]
  initialComments: Comment[]
}

export default function ModeratorView({ projectId, initialSessions, initialScenarios, initialComments }: Props) {
  const [sessions] = useState<Session[]>(initialSessions)
  const [comments] = useState<Comment[]>(initialComments)
  const [selected, setSelected] = useState<Session | null>(sessions[0] ?? null)

  const scenarioMap = Object.fromEntries(initialScenarios.map(s => [s.id, s]))

  const sessionComments = selected ? comments.filter(c => c.sessionId === selected.id) : []
  const scenario = selected?.scenarioId ? scenarioMap[selected.scenarioId] : null

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Session list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Sessions</h2>
          <p className="text-gray-600 text-xs mt-0.5">{sessions.length} recorded</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-sm">No sessions yet.</div>
          ) : (
            sessions.map(s => {
              const sc = s.scenarioId ? scenarioMap[s.scenarioId] : null
              const sessionCommentCount = comments.filter(c => c.sessionId === s.id).length
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/60 hover:bg-gray-800/50 transition-colors ${selected?.id === s.id ? 'bg-gray-800/80 border-l-2 border-l-indigo-500' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300">
                      {s.testerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-200 font-medium truncate">{s.testerName}</span>
                  </div>
                  {sc && <div className="text-xs text-indigo-400 truncate mb-1">{sc.title}</div>}
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>{formatDate(s.startedAt)}</span>
                    <span>{sessionCommentCount} comments</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Session detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">Select a session to review.</div>
        ) : (
          <SessionDetail session={selected} comments={sessionComments} scenario={scenario} />
        )}
      </div>
    </div>
  )
}

function SessionDetail({ session, comments, scenario }: {
  session: Session
  comments: Comment[]
  scenario: Scenario | null
}) {
  const navEvents = session.events.filter(e => e.type === 'navigation')
  const clickEvents = session.events.filter(e => e.type === 'click')
  const completedCount = session.completedTasks.length
  const taskCount = scenario?.tasks.length ?? 0

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl bg-indigo-950 border border-indigo-800/40 flex items-center justify-center text-indigo-300 font-bold text-lg">
          {session.testerName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-white font-semibold text-lg">{session.testerName}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            <span>Started {formatDate(session.startedAt)}</span>
            {session.endedAt && <span>Duration {elapsed(session.startedAt, session.endedAt)}</span>}
            {taskCount > 0 && <span className="text-indigo-400">{completedCount}/{taskCount} tasks completed</span>}
          </div>
        </div>
        <StatusBadge session={session} />
      </div>

      {/* Scenario */}
      {scenario && (
        <div className="bg-indigo-950/50 border border-indigo-800/30 rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Scenario</div>
          <div className="text-white font-medium text-sm">{scenario.title}</div>
          <div className="mt-3 space-y-1.5">
            {scenario.tasks.map((task, i) => {
              const done = session.completedTasks.includes(i)
              return (
                <div key={task.id} className={`flex items-center gap-2 text-xs ${done ? 'text-green-400' : 'text-gray-500'}`}>
                  <span>{done ? '✓' : '○'}</span>
                  <span>{task.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Path */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Navigation path</span>
            <span className="text-xs text-gray-600">{navEvents.length} pages</span>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {session.events.map((ev, i) => (
              <EventRow key={i} event={ev} />
            ))}
            {session.events.length === 0 && <p className="text-gray-600 text-xs p-2">No events recorded.</p>}
          </div>
        </div>

        {/* Comments */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Pinned comments</span>
            <span className="text-xs text-gray-600">{comments.length}</span>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-gray-200 text-sm">{c.text}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="text-gray-600 text-xs truncate font-mono flex-1">{c.selector}</code>
                  <span className="text-gray-700 text-xs flex-shrink-0">{new Date(c.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-gray-600 text-xs p-2">No comments pinned.</p>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Page views', value: navEvents.length },
          { label: 'Clicks', value: clickEvents.length },
          { label: 'Comments', value: comments.length },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-gray-600 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: PathEvent }) {
  if (event.type === 'navigation') {
    const url = event.url ?? ''
    const path = url.replace(/https?:\/\/[^/]+/, '') || url
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-indigo-400 flex-shrink-0">→</span>
        <span className="text-gray-300 font-mono truncate">{path || '/'}</span>
        <span className="text-gray-700 flex-shrink-0">{new Date(event.timestamp).toLocaleTimeString()}</span>
      </div>
    )
  }
  if (event.type === 'click') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-amber-500 flex-shrink-0">•</span>
        <span className="text-gray-500 font-mono truncate">{(event.selector ?? '').slice(0, 60)}</span>
      </div>
    )
  }
  if (event.type === 'task_complete') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-green-400 flex-shrink-0">✓</span>
        <span className="text-green-400">Task {(event.taskIndex ?? 0) + 1} complete</span>
      </div>
    )
  }
  return null
}

function StatusBadge({ session }: { session: Session }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
      session.endedAt ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'
    }`}>
      {session.endedAt ? 'Completed' : 'In progress'}
    </span>
  )
}
