import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ProjectNav } from '@/components/ProjectNav'

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
      <ProjectNav project={project} />
      <div className="flex-1 min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  )
}
