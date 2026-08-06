// Attaches recording listeners to a same-origin iframe FROM the parent window.
// No script injection — pure contentDocument event attachment.

import type { PathEvent } from '@/lib/db'

export type { PathEvent }

export interface RecorderHandle {
  getPath(): PathEvent[]
  getScreen(): string
  detach(): void
}

function getRole(el: Element): string {
  return el.getAttribute('role') || el.tagName.toLowerCase()
}

function getLabel(el: Element): string {
  // Capture identity — never input values (privacy spec)
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.slice(0, 80)
  const title = el.getAttribute('title')
  if (title) return title.slice(0, 80)
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return ''
  return ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function stableSelector(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  const doc = el.ownerDocument

  for (let depth = 0; depth < 6 && cur && cur !== doc?.body; depth++) {
    for (const attr of ['data-testid', 'data-cy', 'data-test', 'data-qa']) {
      const val = cur.getAttribute(attr)
      if (val) { parts.unshift(`[${attr}="${val}"]`); return parts.join(' > ').slice(0, 200) }
    }
    const ariaLabel = cur.getAttribute('aria-label')
    if (ariaLabel && ariaLabel.length < 50) {
      parts.unshift(`${cur.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`)
      return parts.join(' > ').slice(0, 200)
    }
    const id = cur.id
    if (id && !/^(mantine|:r|radix-|chakra|rc-)/.test(id)) {
      parts.unshift(`#${id}`)
      return parts.join(' > ').slice(0, 200)
    }
    const tag = cur.tagName.toLowerCase()
    const parent = cur.parentElement
    let seg = tag
    if (parent) {
      const sibs = Array.from(parent.children).filter(c => c.tagName === cur!.tagName)
      if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(cur) + 1})`
    }
    parts.unshift(seg)
    cur = cur.parentElement
  }

  return parts.join(' > ').slice(0, 200)
}

export function attachRecorder(
  iframe: HTMLIFrameElement,
  onEvent?: (e: PathEvent) => void,
): RecorderHandle {
  const path: PathEvent[] = []
  let lastUrl = ''
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function emit(e: PathEvent) {
    path.push(e)
    onEvent?.(e)
  }

  function setup() {
    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) return

    // Emit navigation for the page now loaded
    const url = win.location.href
    if (url !== lastUrl) {
      lastUrl = url
      emit({ type: 'navigation', url, timestamp: new Date().toISOString() })
    }

    // For MPA navigations the old document is gone, so old listeners are auto-removed.
    // For SPAs this listener persists on the same document across route changes.
    const onClick = (e: Event) => {
      const tgt = e.target as Element
      emit({
        type: 'click',
        selector: stableSelector(tgt),
        role: getRole(tgt),
        label: getLabel(tgt),
        url: win.location.href,
        timestamp: new Date().toISOString(),
      })
    }
    doc.addEventListener('click', onClick, true)

    // Poll URL for SPA route changes (MutationObserver misses history.pushState)
    if (pollTimer !== null) clearInterval(pollTimer)
    pollTimer = setInterval(() => {
      try {
        const href = iframe.contentWindow?.location.href
        if (href && href !== lastUrl) {
          lastUrl = href
          emit({ type: 'navigation', url: href, timestamp: new Date().toISOString() })
        }
      } catch { /* cross-origin guard */ }
    }, 600)
  }

  iframe.addEventListener('load', setup)
  if (iframe.contentDocument?.readyState !== 'loading') setup()

  return {
    getPath: () => [...path],
    getScreen: () => {
      try { return iframe.contentWindow?.location.href ?? '' } catch { return '' }
    },
    detach: () => {
      iframe.removeEventListener('load', setup)
      if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
    },
  }
}
