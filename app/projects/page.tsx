import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArgusLogo } from '@/components/ArgusLogo'
import NewProjectModal from './NewProjectModal'

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

export default async function ProjectsPage() {
  const projects = prisma.project.findMany()
  const allSessions = Object.fromEntries(
    projects.map(p => [p.id, prisma.session.findMany({ where: { projectId: p.id } }).length])
  )
  const allScenarios = Object.fromEntries(
    projects.map(p => [p.id, prisma.scenario.findMany({ where: { projectId: p.id } }).length])
  )

  return (
    <div className="min-h-screen p-8" style={{ background: S.bg }}>
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ArgusLogo size={36} />
          <div>
            <div className="text-white font-bold text-lg leading-tight">Argus</div>
            <div className="text-xs font-bold" style={{ color: '#5c5cbb' }}>datavant</div>
          </div>
        </div>

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="text-sm mt-1" style={{ color: S.muted }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <NewProjectModal />
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center rounded-2xl"
            style={{ border: `1px dashed ${S.border}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" stroke="#3a3a52" strokeWidth="1.5"/>
                <rect x="13" y="3" width="8" height="8" rx="2" stroke="#3a3a52" strokeWidth="1.5"/>
                <rect x="3" y="13" width="8" height="8" rx="2" stroke="#3a3a52" strokeWidth="1.5"/>
                <rect x="13" y="13" width="8" height="8" rx="2" stroke="#3a3a52" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">No projects yet</p>
              <p className="text-sm mt-1" style={{ color: S.muted }}>Upload a prototype ZIP or paste a GitHub URL to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="group rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-indigo-500/40"
                style={{ background: S.card, border: `1px solid ${S.border}` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  >
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                      {project.name}
                    </div>
                    {project.description && (
                      <div className="text-xs mt-0.5 line-clamp-1" style={{ color: S.muted }}>
                        {project.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(80,70,229,0.12)', color: '#818cf8' }}>
                    {allScenarios[project.id]} scenario{allScenarios[project.id] !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: S.muted }}>
                    {allSessions[project.id]} session{allSessions[project.id] !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="text-xs pt-1 border-t" style={{ borderColor: S.border, color: S.dim }}>
                  Created {formatDate(project.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
