'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Scenario } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function ScenariosPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/scenarios?projectId=${id}`)
      .then(r => r.json())
      .then(setScenarios)
      .finally(() => setLoading(false))
  }, [id])

  async function generate() {
    setGenerating(true); setError('')
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, generate: true }),
    })
    setGenerating(false)
    if (!res.ok) { setError('Generation failed — is ANTHROPIC_API_KEY set?'); return }
    const created: Scenario[] = await res.json()
    setScenarios(prev => [...created, ...prev])
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Test scenarios</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI-proposed flows your testers can run.</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {generating ? (
            <>
              <span className="animate-spin">⟳</span> Generating…
            </>
          ) : (
            '✦ Generate with AI'
          )}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : scenarios.length === 0 ? (
        <div className="border-2 border-dashed border-gray-800 rounded-xl py-16 text-center">
          <p className="text-gray-500 text-sm">No scenarios yet.</p>
          <p className="text-gray-600 text-xs mt-1">Click "Generate with AI" to create test flows from your prototype.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.map(s => (
            <ScenarioCard key={s.id} scenario={s} projectId={id} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScenarioCard({ scenario, projectId }: { scenario: Scenario; projectId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm">{scenario.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{scenario.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-600">{scenario.tasks.length} tasks</span>
          <span className="text-gray-600">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-gray-800">
          <div className="space-y-2 mt-4">
            {scenario.tasks.map((task, i) => (
              <div key={task.id} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
                <span className="w-5 h-5 rounded-full bg-indigo-900/60 border border-indigo-700/40 text-indigo-400 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <div className="text-gray-200 text-sm font-medium">{task.title}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{task.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-gray-600 text-xs">{formatDate(scenario.createdAt)}</span>
            <Link
              href={`/t/${projectId}?scenarioId=${scenario.id}`}
              target="_blank"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              ▶ Run this scenario
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
