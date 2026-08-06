import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }
const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2']
const TECH_COLORS: Record<string, string> = { low: '#f59e0b', medium: '#818cf8', high: '#22c55e' }
const TECH_BG:    Record<string, string> = {
  low: 'rgba(245,158,11,0.1)', medium: 'rgba(129,140,248,0.1)', high: 'rgba(34,197,94,0.1)'
}

export default async function PersonasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const personas  = prisma.persona.findMany({ where: { projectId: id } })
  const scenarios = prisma.scenario.findMany({ where: { projectId: id } })
  const sessions  = prisma.session.findMany({ where: { projectId: id } })

  const simsByPersona: Record<string, number> = {}
  for (const s of sessions) {
    if (s.personaId && s.type === 'bot') {
      simsByPersona[s.personaId] = (simsByPersona[s.personaId] ?? 0) + 1
    }
  }

  const prebuilt = personas.filter(p => p.isPrebuilt)
  const custom   = personas.filter(p => !p.isPrebuilt)

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      <div className="max-w-3xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Personas</h1>
            <p className="text-sm mt-0.5" style={{ color: S.muted }}>
              {personas.length} persona{personas.length !== 1 ? 's' : ''} · simulate any to generate a test session
            </p>
          </div>
          <Link
            href={`/project/${id}/moderator`}
            className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#5046e5' }}
          >
            Run simulation →
          </Link>
        </div>

        {/* Prebuilt personas */}
        {prebuilt.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.dim }}>
              Datavant user types
            </h2>
            <div className="space-y-2">
              {prebuilt.map((p, i) => {
                const sims = simsByPersona[p.id] ?? 0
                return (
                  <div key={p.id}
                    className="rounded-xl p-4 flex gap-4"
                    style={{ background: S.card, border: `1px solid ${S.border}` }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: USER_COLORS[i % USER_COLORS.length] }}
                      >
                        {p.name.charAt(0)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: TECH_BG[p.techComfort], color: TECH_COLORS[p.techComfort] }}>
                          {p.techComfort} tech
                        </span>
                        {sims > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
                            🤖 {sims} sim{sims !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-1.5" style={{ color: S.muted }}>{p.role}</p>
                      <p className="text-xs leading-relaxed mb-2" style={{ color: S.dim }}>{p.description}</p>
                      {p.goals && (
                        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
                          <span className="font-medium" style={{ color: S.dim }}>Goals: </span>
                          <span style={{ color: '#94a3b8' }}>{p.goals}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Custom personas */}
        {custom.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.dim }}>
              Custom personas
            </h2>
            <div className="space-y-2">
              {custom.map((p, i) => {
                const sims = simsByPersona[p.id] ?? 0
                return (
                  <div key={p.id}
                    className="rounded-xl p-4 flex gap-4"
                    style={{ background: S.card, border: `1px solid ${S.border}` }}
                  >
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: USER_COLORS[(prebuilt.length + i) % USER_COLORS.length] }}>
                      {p.name.charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ background: TECH_BG[p.techComfort], color: TECH_COLORS[p.techComfort] }}>
                          {p.techComfort} tech
                        </span>
                        {sims > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
                            🤖 {sims} sim{sims !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {p.role && <p className="text-xs mb-1" style={{ color: S.muted }}>{p.role}</p>}
                      <p className="text-xs" style={{ color: S.dim }}>{p.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* How to add */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: S.card, border: `1px dashed ${S.border}` }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1c1c2b' }}>
            <span style={{ color: S.muted }}>+</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white">Add a custom persona</p>
            <p className="text-xs mt-0.5" style={{ color: S.dim }}>
              POST to <code className="font-mono" style={{ color: '#818cf8' }}>/api/personas</code> with name, role, goals, and techComfort (low/medium/high)
            </p>
          </div>
          <Link href={`/project/${id}/moderator`} className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: 'rgba(80,70,229,0.15)', color: '#818cf8' }}>
            Run simulation →
          </Link>
        </div>

      </div>
    </div>
  )
}
