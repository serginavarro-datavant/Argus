'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Scenario, Task } from '@/lib/types'
import Link from 'next/link'

const C = {
  bg: '#0b0b13', surface: '#0e0e18', card: '#111119',
  border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52',
  accent: '#4f46e5', accentBg: 'rgba(79,70,229,0.15)',
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiCreate(scenario: Omit<Scenario, 'id' | 'createdAt'>): Promise<Scenario> {
  const r = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  })
  return r.json()
}

async function apiUpdate(id: string, data: Partial<Omit<Scenario, 'id' | 'createdAt'>>): Promise<Scenario> {
  const r = await fetch('/api/scenarios', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  })
  return r.json()
}

async function apiDelete(id: string) {
  return fetch(`/api/scenarios?id=${id}`, { method: 'DELETE' })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(): Task {
  return { id: Math.random().toString(36).slice(2), title: '', description: '' }
}

const DRAFT_PREFIX = '_draft_'
function isDraft(id: string) { return id.startsWith(DRAFT_PREFIX) }

// ─── Task row in editor ───────────────────────────────────────────────────────

function TaskRow({ task, index, total, onChange, onDelete, onMove }: {
  task: Task; index: number; total: number
  onChange: (t: Task) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
          style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}40` }}>
          {index + 1}
        </span>
        <input
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none border-b focus:border-indigo-500 transition-colors"
          style={{ borderColor: C.border }}
          placeholder="Task title"
          value={task.title}
          onChange={e => onChange({ ...task, title: e.target.value })}
        />
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            className="w-5 h-5 text-[10px] disabled:opacity-20 hover:text-white transition-colors" style={{ color: C.muted }}>↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-5 h-5 text-[10px] disabled:opacity-20 hover:text-white transition-colors" style={{ color: C.muted }}>↓</button>
          <button onClick={onDelete}
            className="w-5 h-5 text-[10px] hover:text-red-400 transition-colors" style={{ color: C.muted }}>✕</button>
        </div>
      </div>
      <textarea rows={2}
        className="w-full bg-transparent text-xs text-gray-400 placeholder-gray-700 outline-none resize-none"
        placeholder="What the tester should accomplish (goal, not instructions)"
        value={task.description}
        onChange={e => onChange({ ...task, description: e.target.value })}
      />
      <input
        className="w-full bg-transparent text-xs placeholder-gray-700 outline-none border-t pt-1"
        style={{ borderColor: C.border, color: C.muted }}
        placeholder="Optional hint (shown if tester is stuck)"
        value={task.hint ?? ''}
        onChange={e => onChange({ ...task, hint: e.target.value || undefined })}
      />
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <label className="block text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: C.dim }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Scenario editor panel ────────────────────────────────────────────────────

function ScenarioEditor({ scenario, projectId, onSaved, onDelete, onClose }: {
  scenario: Scenario
  projectId: string
  onSaved: (s: Scenario) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(scenario.title)
  const [description, setDescription] = useState(scenario.description)
  const [startScreen, setStartScreen] = useState(scenario.startScreen || '/')
  const [successCriteria, setSuccessCriteria] = useState(scenario.successCriteria)
  const [tasks, setTasks] = useState<Task[]>(scenario.tasks.length ? scenario.tasks : [makeTask()])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const data = { projectId, title, description, startScreen, successCriteria, tasks, order: scenario.order }
    const saved = isDraft(scenario.id)
      ? await apiCreate(data)
      : await apiUpdate(scenario.id, data)
    setSaving(false)
    onSaved(saved)
  }

  function moveTask(i: number, dir: -1 | 1) {
    const next = [...tasks]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setTasks(next)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: C.border }}>
        <h2 className="text-sm font-semibold text-white">{isDraft(scenario.id) ? 'New scenario' : 'Edit scenario'}</h2>
        <button onClick={onClose} className="text-xs hover:text-white transition-colors" style={{ color: C.muted }}>✕ Close</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <Field label="Title">
          <input className="w-full bg-transparent text-sm text-white placeholder-gray-600 outline-none"
            placeholder="e.g. First-time onboarding"
            value={title} onChange={e => setTitle(e.target.value)} />
        </Field>

        <Field label="Goal">
          <textarea rows={2}
            className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none resize-none"
            placeholder="What the tester is trying to accomplish in this scenario"
            value={description} onChange={e => setDescription(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start screen">
            <input className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
              placeholder="/ or /dashboard"
              value={startScreen} onChange={e => setStartScreen(e.target.value)} />
          </Field>
          <Field label="Success criteria">
            <input className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
              placeholder="Tester reaches confirmation"
              value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{ color: C.muted }}>Tasks</label>
            <button onClick={() => setTasks(t => [...t, makeTask()])}
              className="text-xs hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
              + Add task
            </button>
          </div>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <TaskRow key={t.id} task={t} index={i} total={tasks.length}
                onChange={next => setTasks(ts => ts.map((x, j) => j === i ? next : x))}
                onDelete={() => setTasks(ts => ts.filter((_, j) => j !== i))}
                onMove={dir => moveTask(i, dir)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: C.border }}>
        <button onClick={onDelete} className="text-xs hover:text-red-400 transition-colors" style={{ color: C.muted }}>
          {isDraft(scenario.id) ? 'Discard' : 'Delete'}
        </button>
        <button onClick={save} disabled={saving || !title.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: C.accent }}>
          {saving ? 'Saving…' : 'Save scenario'}
        </button>
      </div>
    </div>
  )
}

// ─── Propose with AI modal ────────────────────────────────────────────────────

function ProposeModal({ projectId, onProposed, onClose }: {
  projectId: string
  onProposed: (scenarios: Scenario[]) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'form' | 'loading' | 'review'>('form')
  const [targetUsers, setTargetUsers] = useState('')
  const [mainGoal, setMainGoal] = useState('')
  const [toValidate, setToValidate] = useState('')
  const [drafts, setDrafts] = useState<Scenario[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  async function propose() {
    setStep('loading'); setError('')
    try {
      const r = await fetch('/api/agent/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, targetUsers, mainGoal, toValidate, count: 3 }),
      })
      if (!r.ok) throw new Error('request failed')
      const scenarios: Scenario[] = await r.json()
      setDrafts(scenarios)
      setSelected(new Set(scenarios.map(s => s.id)))
      setStep('review')
    } catch {
      setError('Something went wrong. Is ANTHROPIC_API_KEY set?')
      setStep('form')
    }
  }

  async function saveSelected() {
    const toSave = drafts.filter(s => selected.has(s.id))
    const saved = await Promise.all(toSave.map(s => apiCreate({
      projectId: s.projectId,
      title: s.title,
      description: s.description,
      startScreen: s.startScreen,
      successCriteria: s.successCriteria,
      tasks: s.tasks,
      order: s.order,
    })))
    onProposed(saved)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, maxHeight: '88vh' }}>

        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: C.border }}>
          <div>
            <h2 className="text-sm font-semibold text-white">Propose scenarios with AI</h2>
            {step === 'form' && <p className="text-xs mt-0.5" style={{ color: C.muted }}>3 questions · ~10 seconds</p>}
            {step === 'review' && <p className="text-xs mt-0.5" style={{ color: C.muted }}>Select which to add. You can edit them after.</p>}
          </div>
          <button onClick={onClose} className="text-xs hover:text-white transition-colors" style={{ color: C.muted }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'form' && (
            <div className="space-y-4">
              {[
                { n: 1, label: 'Who are the target users?', placeholder: 'e.g. New customers who haven\'t used this product before', val: targetUsers, set: setTargetUsers },
                { n: 2, label: 'What is the main goal of this test?', placeholder: 'e.g. Validate users can complete setup without help', val: mainGoal, set: setMainGoal },
                { n: 3, label: 'What specifically do you want to validate?', placeholder: 'e.g. Navigation clarity, label comprehension, error recovery', val: toValidate, set: setToValidate },
              ].map(({ n, label, placeholder, val, set }) => (
                <div key={n} className="rounded-lg px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: C.accentBg, color: C.accent }}>{n}</span>
                    <label className="text-xs font-medium text-white">{label}</label>
                  </div>
                  <textarea rows={2}
                    className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none resize-none"
                    placeholder={placeholder} value={val} onChange={e => set(e.target.value)} />
                </div>
              ))}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-sm" style={{ color: C.muted }}>Analysing prototype and drafting scenarios…</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              {drafts.map(s => (
                <DraftCard key={s.id} scenario={s}
                  checked={selected.has(s.id)}
                  onToggle={() => setSelected(prev => {
                    const next = new Set(prev)
                    next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                    return next
                  })}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 flex-shrink-0" style={{ borderColor: C.border }}>
          {step === 'form' && (
            <>
              <button onClick={onClose} className="text-sm hover:text-white transition-colors" style={{ color: C.muted }}>Cancel</button>
              <button onClick={propose} disabled={!targetUsers.trim() && !mainGoal.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: C.accent }}>
                Propose scenarios
              </button>
            </>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('form')} className="text-sm hover:text-white transition-colors" style={{ color: C.muted }}>Back</button>
              <button onClick={saveSelected} disabled={selected.size === 0}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: C.accent }}>
                Add {selected.size} scenario{selected.size !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DraftCard({ scenario, checked, onToggle }: { scenario: Scenario; checked: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{ border: `1px solid ${checked ? C.accent : C.border}`, background: checked ? C.accentBg : C.surface }}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={onToggle}
          className="w-4 h-4 mt-0.5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: checked ? C.accent : C.surface, border: `1px solid ${checked ? C.accent : C.dim}` }}>
          {checked && <span className="text-white text-[9px]">✓</span>}
        </button>
        <div className="flex-1 min-w-0" onClick={() => setOpen(v => !v)}>
          <p className="text-sm font-medium text-white">{scenario.title}</p>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: C.muted }}>{scenario.description}</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-xs flex-shrink-0 mt-1" style={{ color: C.dim }}>
          {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1.5 border-t" style={{ borderColor: C.border }}>
          {scenario.startScreen && (
            <p className="text-xs mt-2" style={{ color: C.muted }}>
              Start: <span className="text-gray-300">{scenario.startScreen}</span>
            </p>
          )}
          {scenario.successCriteria && (
            <p className="text-xs" style={{ color: C.muted }}>
              Success: <span className="text-gray-300">{scenario.successCriteria}</span>
            </p>
          )}
          {scenario.tasks.map((t, i) => (
            <div key={t.id} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5"
                style={{ background: C.accentBg, color: C.accent }}>{i + 1}</span>
              <div>
                <span className="text-xs font-medium text-gray-200">{t.title}</span>
                {t.description && <span className="text-xs ml-1.5" style={{ color: C.muted }}>{t.description}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Scenario list item ───────────────────────────────────────────────────────

function ScenarioListItem({ scenario, index, total, isSelected, onSelect, onMove }: {
  scenario: Scenario; index: number; total: number; isSelected: boolean
  onSelect: () => void; onMove: (dir: -1 | 1) => void
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all group"
      style={{
        background: isSelected ? C.accentBg : C.card,
        border: `1px solid ${isSelected ? C.accent : C.border}`,
      }}
      onClick={onSelect}
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: C.surface, color: C.muted, border: `1px solid ${C.dim}` }}>
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{scenario.title || 'Untitled'}</p>
        <p className="text-xs truncate" style={{ color: C.muted }}>
          {scenario.tasks.length} task{scenario.tasks.length !== 1 ? 's' : ''}
          {scenario.description ? ` · ${scenario.description.slice(0, 38)}` : ''}
        </p>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onMove(-1) }} disabled={index === 0}
          className="w-5 h-5 text-[10px] disabled:opacity-20 hover:text-white transition-colors" style={{ color: C.muted }}>↑</button>
        <button onClick={e => { e.stopPropagation(); onMove(1) }} disabled={index === total - 1}
          className="w-5 h-5 text-[10px] disabled:opacity-20 hover:text-white transition-colors" style={{ color: C.muted }}>↓</button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPropose, setShowPropose] = useState(false)

  const load = useCallback(async () => {
    const data = await fetch(`/api/scenarios?projectId=${projectId}`).then(r => r.json())
    setScenarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const selected = scenarios.find(s => s.id === selectedId) ?? null

  function addNew() {
    const draft: Scenario = {
      id: DRAFT_PREFIX + Date.now(),
      projectId,
      title: '',
      description: '',
      startScreen: '/',
      successCriteria: '',
      tasks: [],
      order: scenarios.length,
      createdAt: new Date().toISOString(),
    }
    setScenarios(prev => [...prev, draft])
    setSelectedId(draft.id)
  }

  function handleSaved(saved: Scenario) {
    setScenarios(prev => {
      const idx = prev.findIndex(s => s.id === selectedId)
      if (idx === -1) return [...prev, saved]
      const next = [...prev]
      next[idx] = saved
      return next
    })
    setSelectedId(saved.id)
  }

  async function handleDelete() {
    if (!selectedId) return
    if (!isDraft(selectedId)) await apiDelete(selectedId)
    setScenarios(prev => prev.filter(s => s.id !== selectedId))
    setSelectedId(null)
  }

  async function moveScenario(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= scenarios.length) return
    const next = [...scenarios]
    ;[next[index], next[j]] = [next[j], next[index]]
    setScenarios(next)
    await Promise.all([
      apiUpdate(next[index].id, { order: index }),
      apiUpdate(next[j].id, { order: j }),
    ])
  }

  function handleProposed(saved: Scenario[]) {
    setScenarios(prev => [...prev, ...saved])
    setShowPropose(false)
    if (saved.length > 0) setSelectedId(saved[0].id)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, color: 'white' }}>
      {/* Left: scenario list */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r" style={{ borderColor: C.border }}>
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-semibold text-white">Scenarios</h1>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {loading ? '…' : `${scenarios.filter(s => !isDraft(s.id)).length} saved`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addNew}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: C.accent }}>
              + New
            </button>
            <button onClick={() => setShowPropose(true)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}40` }}>
              Propose with AI
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <p className="text-xs text-center py-8" style={{ color: C.muted }}>Loading…</p>
          ) : scenarios.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs" style={{ color: C.muted }}>No scenarios yet.</p>
              <p className="text-xs mt-1" style={{ color: C.dim }}>Create manually or propose with AI.</p>
            </div>
          ) : (
            scenarios.map((s, i) => (
              <ScenarioListItem key={s.id}
                scenario={s} index={i} total={scenarios.length}
                isSelected={s.id === selectedId}
                onSelect={() => setSelectedId(s.id)}
                onMove={dir => moveScenario(i, dir)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: editor or empty state */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <ScenarioEditor
            key={selectedId}
            scenario={selected}
            projectId={projectId}
            onSaved={handleSaved}
            onDelete={handleDelete}
            onClose={() => {
              if (selectedId && isDraft(selectedId)) {
                setScenarios(prev => prev.filter(s => s.id !== selectedId))
              }
              setSelectedId(null)
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  stroke={C.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Select a scenario to edit</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>
                Or create one manually, or let AI propose a set based on your prototype.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={addNew}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                style={{ background: C.accent }}>
                + New scenario
              </button>
              {scenarios.filter(s => !isDraft(s.id)).length > 0 && (
                <Link href={`/t/${projectId}?scenarioId=${scenarios.find(s => !isDraft(s.id))!.id}`} target="_blank"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}40` }}>
                  Run first scenario
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {showPropose && (
        <ProposeModal
          projectId={projectId}
          onProposed={handleProposed}
          onClose={() => setShowPropose(false)}
        />
      )}
    </div>
  )
}
