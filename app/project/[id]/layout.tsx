import Link from 'next/link'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ArgusLogo } from '@/components/ArgusLogo'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  return (
    <div className="min-h-screen flex" style={{ background: '#0b0b13' }}>
      {/* Sidebar */}
      <nav className="w-52 flex-shrink-0 flex flex-col border-r" style={{ background: '#0e0e18', borderColor: '#1c1c2b' }}>
        {/* Back + logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: '#1c1c2b' }}>
          <Link href="/" className="flex items-center gap-2 mb-4 group w-fit">
            <ArgusLogo size={22} />
            <span className="text-xs transition-colors group-hover:text-white" style={{ color: '#3a3a52' }}>
              ← All projects
            </span>
          </Link>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold mb-2"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-white font-semibold text-sm leading-snug">{project.name}</h1>
          {project.description && (
            <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: '#5c5c78' }}>
              {project.description}
            </p>
          )}
        </div>

        <div className="flex-1 p-2.5 space-y-0.5">
          <NavLink href={`/project/${id}`}>
            <IconDashboard /> Dashboard
          </NavLink>
          <NavLink href={`/project/${id}/scenarios`}>
            <IconScenarios /> Scenarios
          </NavLink>
          <NavLink href={`/project/${id}/moderator`}>
            <IconModerator /> Moderator
          </NavLink>
        </div>

        <div className="p-3 border-t" style={{ borderColor: '#1c1c2b' }}>
          <Link
            href={`/t/${id}`}
            target="_blank"
            className="flex items-center justify-center gap-2 w-full text-white text-xs py-2.5 rounded-lg font-medium transition-all"
            style={{ background: '#5046e5' }}
          >
            ▶ Start test session
          </Link>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
      style={{ color: '#5c5c78' }}
    >
      {children}
    </Link>
  )
}

function IconDashboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="0.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="0.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconScenarios() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="0.5" y="2.5" width="13" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="0.5" y="9" width="13" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconModerator() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
