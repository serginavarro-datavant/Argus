import Link from 'next/link'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = db.projects.get(id)
  if (!project) notFound()

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <nav className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-950 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="flex items-center gap-2 group mb-4">
            <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">A</div>
            <span className="text-gray-400 text-xs group-hover:text-white transition-colors">← All projects</span>
          </Link>
          <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800/40 flex items-center justify-center text-indigo-400 font-bold text-base mb-2">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-white font-semibold text-sm leading-snug">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">{project.description}</p>
          )}
        </div>

        <div className="flex-1 p-3 space-y-0.5">
          <NavLink href={`/project/${id}`} exact>Dashboard</NavLink>
          <NavLink href={`/project/${id}/scenarios`}>Scenarios</NavLink>
          <NavLink href={`/project/${id}/moderator`}>Moderator</NavLink>
        </div>

        <div className="p-3 border-t border-gray-800">
          <Link
            href={`/t/${id}`}
            target="_blank"
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg font-medium transition-colors"
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

function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors"
    >
      {children}
    </Link>
  )
}
