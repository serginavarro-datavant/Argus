'use client'

import { useEffect, useState } from 'react'
import type { Task } from '@/lib/db'

interface Props {
  tasks: Task[]
  currentTaskIdx: number
  startedAt: Date
  commentMode: boolean
  onToggleComment: () => void
  onTaskDone: () => void
  onStuck: () => void
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function TaskBar({ tasks, currentTaskIdx, startedAt, commentMode, onToggleComment, onTaskDone, onStuck }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const base = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    setElapsed(base)
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])

  const task = tasks[currentTaskIdx]
  const label = task ? `Task ${currentTaskIdx + 1} / ${tasks.length}` : 'Free exploration'
  const desc = task?.description ?? 'Look around and share thoughts.'

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-950/95 backdrop-blur border-b border-gray-800 text-sm select-none">
      <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded shrink-0">
        {label}
      </span>
      <span className="text-gray-300 flex-1 leading-snug text-xs">{desc}</span>
      <span className="text-gray-500 text-xs font-mono shrink-0">{fmt(elapsed)}</span>
      <button
        onClick={onToggleComment}
        className={`text-xs px-2.5 py-1 rounded border transition-colors shrink-0 ${
          commentMode
            ? 'bg-indigo-600 border-indigo-500 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
        }`}
      >
        {commentMode ? '📌 Click element…' : '📌 Pin'}
      </button>
      <button
        onClick={onStuck}
        className="text-xs px-2.5 py-1 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-amber-400 hover:border-amber-700 transition-colors shrink-0"
      >
        Stuck
      </button>
      <button
        onClick={onTaskDone}
        className="text-xs px-2.5 py-1 rounded border border-emerald-700 bg-emerald-900/60 text-emerald-400 hover:bg-emerald-800/60 transition-colors shrink-0"
      >
        ✓ Done
      </button>
    </div>
  )
}
