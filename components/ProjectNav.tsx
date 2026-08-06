'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Project } from '@/lib/types'
import { ArgusLogo } from './ArgusLogo'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <rect x="0.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="0.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconScenarios({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <rect x="0.5" y="2.5" width="13" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="0.5" y="9" width="13" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconComments({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <path d="M1 2a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H8l-3 3v-3H2a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

function IconPaths({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <circle cx="2" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="7" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="12" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="7" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.5 7H5.5M8.5 7H10.5M7 3.5V5.5M7 8.5V10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconMetrics({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <path d="M1 13L4.5 8L7 10.5L10 5L13 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconInteractions({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <path d="M3 1v5l2-1.5 2 1.5V1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 7h12" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 10h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconSessions({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: active ? '#818cf8' : 'currentColor' }}>
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Nav group + item types ─────────────────────────────────────────────────────

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ active: boolean }>
  exact?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectNav({ project }: { project: Project }) {
  const pathname = usePathname()
  const base = `/project/${project.id}`

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: base, label: 'Dashboard', icon: IconDashboard, exact: true },
        { href: `${base}/scenarios`, label: 'Scenarios', icon: IconScenarios },
        { href: `${base}/sessions`, label: 'Sessions', icon: IconSessions },
      ],
    },
    {
      label: 'Research',
      items: [
        { href: `${base}/comments`, label: 'Comments', icon: IconComments },
        { href: `${base}/paths`, label: 'Paths', icon: IconPaths },
        { href: `${base}/metrics`, label: 'Metrics', icon: IconMetrics },
        { href: `${base}/interactions`, label: 'Interactions', icon: IconInteractions },
      ],
    },
  ]

  return (
    <nav
      className="w-52 flex-shrink-0 flex flex-col border-r sticky top-0 h-screen"
      style={{ background: '#0e0e18', borderColor: '#1c1c2b' }}
    >
      {/* Brand header */}
      <div className="px-4 py-4 flex items-center gap-3 border-b" style={{ borderColor: '#1c1c2b' }}>
        <ArgusLogo size={36} />
        <div>
          <div className="text-white font-semibold text-[15px] leading-tight tracking-tight">Argus</div>
          <div className="text-[13px] leading-tight font-bold" style={{ color: '#5c5cbb' }}>datavant</div>
        </div>
      </div>

      {/* Project context */}
      <div className="px-4 py-3 border-b" style={{ borderColor: '#1c1c2b' }}>
        <Link href="/" className="flex items-center gap-1.5 mb-3 group w-fit">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: '#3a3a52' }}>
            <path d="M6 2L3 5L6 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs transition-colors group-hover:text-white" style={{ color: '#3a3a52' }}>
            All projects
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white font-medium text-sm leading-snug truncate">{project.name}</div>
            {project.description && (
              <div className="text-xs leading-relaxed line-clamp-1 mt-0.5" style={{ color: '#5c5c78' }}>
                {project.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div
              className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#2e2e44' }}
            >
              {group.label}
            </div>
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: active ? '#a5a8ff' : '#5c5c78',
                    }}
                  >
                    <item.icon active={active} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Start test session */}
      <div className="p-3 border-t" style={{ borderColor: '#1c1c2b' }}>
        <Link
          href={`/t/${project.id}`}
          target="_blank"
          className="flex items-center justify-center gap-2 w-full text-white text-xs py-2.5 rounded-lg font-medium transition-all"
          style={{ background: '#5046e5' }}
        >
          ▶ Start test session
        </Link>
      </div>
    </nav>
  )
}
