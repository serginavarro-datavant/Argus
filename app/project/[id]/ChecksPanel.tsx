'use client'

import { useState } from 'react'
import type { Check } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const SEVERITY_STYLES = {
  high: 'bg-red-900/30 text-red-400 border-red-800/50',
  medium: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  low: 'bg-gray-800 text-gray-400 border-gray-700',
}

export default function ChecksPanel({ projectId, initialChecks }: { projectId: string; initialChecks: Check[] }) {
  const [checks, setChecks] = useState<Check[]>(initialChecks)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function runCheck() {
    setRunning(true); setError('')
    const res = await fetch('/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, type: 'a11y' }),
    })
    setRunning(false)
    if (!res.ok) { setError('Check failed — is ANTHROPIC_API_KEY set?'); return }
    const check = await res.json()
    setChecks(prev => [check, ...prev])
  }

  const latest = checks[0]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <span className="text-sm font-medium text-gray-300">Accessibility check</span>
          {latest && <span className="text-xs text-gray-600 ml-3">Last run {formatDate(latest.createdAt)}</span>}
        </div>
        <button
          onClick={runCheck}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
        >
          {running ? 'Analyzing…' : 'Run A11y check'}
        </button>
      </div>

      {error && <div className="px-4 py-3 text-red-400 text-sm">{error}</div>}

      {latest ? (
        <div className="p-4">
          <p className="text-gray-300 text-sm mb-4">{latest.summary}</p>
          <div className="space-y-2">
            {latest.issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-3 border rounded-lg p-3 ${SEVERITY_STYLES[issue.severity]}`}>
                <span className="text-xs font-bold uppercase tracking-wide mt-0.5 flex-shrink-0">{issue.severity}</span>
                <div className="min-w-0">
                  <p className="text-sm">{issue.description}</p>
                  {issue.element && <p className="text-xs opacity-60 mt-0.5 font-mono truncate">{issue.element}</p>}
                </div>
              </div>
            ))}
          </div>
          {latest.issues.length === 0 && <p className="text-green-400 text-sm">No issues found.</p>}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-gray-600 text-sm">
          Run an accessibility check to see issues flagged by AI.
        </div>
      )}
    </div>
  )
}
