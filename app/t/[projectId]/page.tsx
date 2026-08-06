'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import type { Project, Scenario } from '@/lib/types'
import { ArgusLogo } from '@/components/ArgusLogo'

export default function TesterEntry() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = params.projectId
  const presetScenarioId = searchParams.get('scenarioId')

  const [project, setProject] = useState<Project | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [name, setName] = useState('')
  const [scenarioId, setScenarioId] = useState<string>(presetScenarioId ?? '__free__')
  const [starting, setStarting] = useState(false)
  const [consented, setConsented] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/scenarios?projectId=${projectId}`).then(r => r.json()),
    ]).then(([p, s]) => { setProject(p); setScenarios(s) })
  }, [projectId])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!consented) { setError('Please agree to the session recording.'); return }
    setStarting(true)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        scenarioId: scenarioId === '__free__' ? null : scenarioId,
        testerName: name.trim(),
      }),
    })
    if (!res.ok) { setStarting(false); setError('Failed to start session.'); return }
    const session = await res.json()
    router.push(`/t/${projectId}/run?sessionId=${session.id}`)
  }

  if (!project) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><ArgusLogo size={40} /></div>
          <h1 className="text-white font-semibold text-lg">{project.name}</h1>
          <p className="text-gray-500 text-sm mt-1">User testing session</p>
        </div>

        <form onSubmit={start} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Your first name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {scenarios.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Test scenario</label>
              <select
                value={scenarioId}
                onChange={e => setScenarioId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="__free__">Free exploration (no tasks)</option>
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Consent */}
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 text-xs text-gray-400 space-y-2">
            <p className="font-medium text-gray-300">Before you start</p>
            <p>This session will record your clicks, page navigation, and any comments you pin. No personal data or form values are captured. Your feedback helps improve the product.</p>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500" />
              <span className="text-gray-300">I understand and agree</span>
            </label>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={starting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {starting ? 'Starting…' : 'Start session →'}
          </button>
        </form>
      </div>
    </div>
  )
}
