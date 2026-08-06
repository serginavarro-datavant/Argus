import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, elapsed } from '@/lib/utils'
import ChecksPanel from './ChecksPanel'

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = prisma.project.findUnique({ where: { id } })
  if (!project) notFound()

  const sessions = prisma.session.findMany({ where: { projectId: id } })
  const scenarios = prisma.scenario.findMany({ where: { projectId: id } })
  const checks = prisma.check.findMany({ where: { projectId: id } })
  const comments = prisma.comment.findMany({ where: { projectId: id } })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Uploaded {formatDate(project.createdAt)}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Sessions', value: sessions.length },
          { label: 'Scenarios', value: scenarios.length },
          { label: 'Comments', value: comments.length },
          { label: 'Checks', value: checks.length },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Prototype preview */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-300">Prototype preview</span>
          <a
            href={`/serve/${id}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`}
            target="_blank"
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Open full ↗
          </a>
        </div>
        <div className="relative bg-gray-950 rounded-b-xl overflow-hidden" style={{ height: 400 }}>
          <iframe
            src={`/serve/${id}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`}
            className="w-full h-full"
            title="Prototype preview"
          />
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-300">Recent sessions</span>
            <Link href={`/project/${id}/moderator`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {sessions.slice(0, 5).map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-4 text-sm">
                <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                  {s.testerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-200 font-medium">{s.testerName}</div>
                  <div className="text-gray-600 text-xs">{formatDate(s.startedAt)} · {s.path.length} events</div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${s.endedAt ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
                  {s.endedAt ? `Done · ${elapsed(s.startedAt, s.endedAt)}` : 'In progress'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A11y checks */}
      <ChecksPanel projectId={id} initialChecks={checks} />
    </div>
  )
}
