// Parent-side comment layer (active + read-only variants).
// Active layer injects a hover ring into the iframe DOM; pins and popovers are in parent.
// Read-only layer places pre-loaded pins without click-to-create.

export interface Pin {
  id: string
  selector: string
  fractX: number  // [0..1] click X within element width
  fractY: number  // [0..1] click Y within element height
  text: string
  pageUrl: string
  rect: { x: number; y: number; width: number; height: number }
}

export interface CommentLayerHandle {
  setEnabled(enabled: boolean): void
  getPins(): Pin[]
  reposition(): void
  destroy(): void
}

const UNSTABLE_ID = /^(mantine|:r|radix-|chakra|rc-)/

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
    if (id && !UNSTABLE_ID.test(id)) {
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

function popoverPos(px: number, py: number): { left: number; top: number } {
  const PW = 268, PH = 130, M = 10
  let left = px + 14
  let top = py - PH / 2
  if (left + PW > window.innerWidth - M) left = px - PW - 14
  if (top < M) top = M
  if (top + PH > window.innerHeight - M) top = window.innerHeight - PH - M
  return { left, top }
}

// ── Read-only overlay ──────────────────────────────────────────────────────────

export interface ReadOnlyPin {
  id: string
  selector: string
  fractX: number
  fractY: number
  text: string
  pageUrl: string
  color: string
  number: number
}

export interface ReadOnlyLayerHandle {
  setPins(pins: ReadOnlyPin[]): void
  reposition(): void
  highlightPin(id: string): void
  setVisible(visible: boolean): void
  destroy(): void
}

function normUrl(u: string): string {
  return u.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '') || '/'
}

export function mountReadOnlyLayer(
  iframe: HTMLIFrameElement,
  opts: { onPinClick?: (id: string) => void } = {},
): ReadOnlyLayerHandle {
  let pins: ReadOnlyPin[] = []
  let pinsVisible = true
  const dots = new Map<string, HTMLDivElement>()

  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999990;overflow:hidden;'
  document.body.appendChild(layer)

  const ro = new ResizeObserver(reposition)
  ro.observe(iframe)
  window.addEventListener('scroll', reposition, { passive: true })
  iframe.addEventListener('load', () => {
    try { iframe.contentWindow?.addEventListener('scroll', reposition, { passive: true }) } catch {}
    reposition()
  })

  function currentUrl(): string {
    try { return iframe.contentWindow?.location?.href ?? '' } catch { return '' }
  }

  function getPos(pin: ReadOnlyPin): { x: number; y: number } | null {
    try {
      const el = iframe.contentDocument?.querySelector(pin.selector)
      if (!el) return null
      const iRect = iframe.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      return { x: iRect.left + eRect.left + pin.fractX * eRect.width, y: iRect.top + eRect.top + pin.fractY * eRect.height }
    } catch { return null }
  }

  function positionDot(dot: HTMLDivElement, pin: ReadOnlyPin) {
    if (!pinsVisible) { dot.style.display = 'none'; return }
    const cur = normUrl(currentUrl())
    const pinUrl = normUrl(pin.pageUrl)
    if (cur && pinUrl && cur !== pinUrl) { dot.style.display = 'none'; return }
    const pos = getPos(pin)
    if (!pos) { dot.style.display = 'none'; return }
    const iRect = iframe.getBoundingClientRect()
    const inView = pos.x >= iRect.left && pos.x <= iRect.right && pos.y >= iRect.top && pos.y <= iRect.bottom
    dot.style.display = inView ? 'flex' : 'none'
    dot.style.left = pos.x + 'px'
    dot.style.top = pos.y + 'px'
  }

  function renderDot(pin: ReadOnlyPin) {
    dots.get(pin.id)?.remove()
    const dot = document.createElement('div')
    dot.title = pin.text
    dot.style.cssText = `position:fixed;width:20px;height:20px;background:${pin.color};border:2px solid rgba(255,255,255,0.9);border-radius:50%;color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.6);transform:translate(-50%,-50%);pointer-events:all;z-index:999991;`
    dot.textContent = String(pin.number)
    dot.addEventListener('click', (e) => { e.stopPropagation(); opts.onPinClick?.(pin.id) })
    layer.appendChild(dot)
    dots.set(pin.id, dot)
    positionDot(dot, pin)
  }

  function reposition() {
    for (const [id, dot] of dots) {
      const pin = pins.find(p => p.id === id)
      if (pin) positionDot(dot, pin)
    }
  }

  return {
    setPins(newPins: ReadOnlyPin[]) {
      const newIds = new Set(newPins.map(p => p.id))
      for (const [id, dot] of dots) { if (!newIds.has(id)) { dot.remove(); dots.delete(id) } }
      pins = newPins
      for (const pin of pins) renderDot(pin)
    },
    reposition,
    highlightPin(id: string) {
      const dot = dots.get(id)
      if (!dot) return
      dot.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease'
      dot.style.transform = 'translate(-50%,-50%) scale(2.4)'
      dot.style.boxShadow = '0 0 0 6px rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,.9)'
      dot.style.zIndex = '999995'
      setTimeout(() => {
        dot.style.transform = 'translate(-50%,-50%) scale(1.5)'
        setTimeout(() => {
          dot.style.transform = 'translate(-50%,-50%) scale(1)'
          dot.style.boxShadow = '0 2px 8px rgba(0,0,0,.6)'
          dot.style.zIndex = '999991'
          setTimeout(() => { dot.style.transition = '' }, 200)
        }, 250)
      }, 300)
    },
    setVisible(v: boolean) {
      pinsVisible = v
      reposition()
    },
    destroy() {
      ro.disconnect()
      window.removeEventListener('scroll', reposition)
      layer.remove()
    },
  }
}

// ── Active (write) layer ───────────────────────────────────────────────────────

export function mountCommentLayer(
  iframe: HTMLIFrameElement,
  opts: { onPin?: (pin: Pin) => void } = {},
): CommentLayerHandle {
  const pins: Pin[] = []
  const pinDots = new Map<string, HTMLDivElement>()
  let enabled = false
  let ring: HTMLDivElement | null = null
  let popoverEl: HTMLDivElement | null = null
  let pendingInfo: Omit<Pin, 'id' | 'text'> | null = null

  // ── Layer container in parent DOM ────────────────────────────────────────────
  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999990;overflow:hidden;'
  document.body.appendChild(layer)

  // ── ResizeObserver + scroll for repositioning ────────────────────────────────
  const ro = new ResizeObserver(reposition)
  ro.observe(iframe)
  window.addEventListener('scroll', reposition, { passive: true })
  const iWin = () => iframe.contentWindow

  // Re-attach hover/click listeners + ring when iframe reloads
  iframe.addEventListener('load', attachToDoc)
  if (iframe.contentDocument?.readyState !== 'loading') attachToDoc()

  function attachToDoc() {
    const doc = iframe.contentDocument
    if (!doc) return
    // Inject hover ring into iframe (only once per document)
    if (!doc.getElementById('__argus_hl')) {
      ring = doc.createElement('div')
      ring.id = '__argus_hl'
      ring.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #ef4444;background:rgba(239,68,68,.09);border-radius:2px;display:none;z-index:2147483645;transition:top .06s,left .06s,width .06s,height .06s;'
      doc.body.appendChild(ring)
    } else {
      ring = doc.getElementById('__argus_hl') as HTMLDivElement
    }

    // Re-attach scroll listener for iframe content
    iWin()?.addEventListener('scroll', reposition, { passive: true })

    doc.addEventListener('mousemove', onMove, true)
    doc.addEventListener('click', onClick, true)
  }

  function onMove(e: Event) {
    if (!enabled || !ring) return
    const tgt = e.target as Element
    if (tgt === ring || ring.contains(tgt)) return
    const r = (tgt as HTMLElement).getBoundingClientRect()
    Object.assign(ring.style, {
      display: 'block', top: r.top + 'px', left: r.left + 'px',
      width: r.width + 'px', height: r.height + 'px',
    })
  }

  function onClick(e: Event) {
    if (!enabled) return
    const tgt = e.target as Element
    if (tgt === ring || ring?.contains(tgt)) return
    e.preventDefault(); e.stopPropagation()

    const doc = iframe.contentDocument!
    const win = iframe.contentWindow!
    const eBcr = (tgt as HTMLElement).getBoundingClientRect()
    const me = e as MouseEvent
    const fractX = Math.max(0, Math.min(1, (me.clientX - eBcr.left) / (eBcr.width || 1)))
    const fractY = Math.max(0, Math.min(1, (me.clientY - eBcr.top) / (eBcr.height || 1)))
    const iRect = iframe.getBoundingClientRect()

    pendingInfo = {
      selector: stableSelector(tgt),
      fractX, fractY,
      pageUrl: win.location.href,
      rect: { x: Math.round(eBcr.left), y: Math.round(eBcr.top), width: Math.round(eBcr.width), height: Math.round(eBcr.height) },
    }

    const px = iRect.left + eBcr.left + fractX * eBcr.width
    const py = iRect.top + eBcr.top + fractY * eBcr.height
    showPopover(px, py, '', null)
  }

  function showPopover(px: number, py: number, initialText: string, editId: string | null) {
    popoverEl?.remove()
    const { left, top } = popoverPos(px, py)
    const pop = document.createElement('div')
    pop.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:268px;background:#1e1b4b;border:1px solid #4f46e5;border-radius:8px;padding:12px;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,.7);pointer-events:all;font-family:system-ui,sans-serif;`
    pop.innerHTML = `
      <div style="color:#e0e7ff;font-size:11px;font-weight:600;margin-bottom:7px;">${editId ? 'Edit comment' : 'Pin a comment'}</div>
      <textarea style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #4338ca;border-radius:4px;color:#e0e7ff;font-size:12px;padding:6px;resize:none;outline:none;font-family:inherit;" rows="3" placeholder="What did you notice?">${editId ? initialText : ''}</textarea>
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;">
        <button data-action="save" style="flex:1;background:#4f46e5;color:#fff;border:none;border-radius:4px;padding:6px 0;font-size:11px;cursor:pointer;font-family:inherit;">${editId ? 'Update' : 'Pin'}</button>
        ${editId ? `<button data-action="delete" style="background:#7f1d1d;color:#fca5a5;border:none;border-radius:4px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:inherit;">Delete</button>` : ''}
        <button data-action="cancel" style="background:#334155;color:#94a3b8;border:none;border-radius:4px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:inherit;">✕</button>
      </div>`

    pop.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset.action
      if (!action) return
      if (action === 'cancel') { pop.remove(); popoverEl = null; return }
      if (action === 'delete' && editId) {
        const idx = pins.findIndex(p => p.id === editId)
        if (idx !== -1) pins.splice(idx, 1)
        pinDots.get(editId)?.remove()
        pinDots.delete(editId)
        pop.remove(); popoverEl = null; return
      }
      if (action === 'save') {
        const text = (pop.querySelector('textarea') as HTMLTextAreaElement).value.trim()
        if (!text) { (pop.querySelector('textarea') as HTMLTextAreaElement).focus(); return }
        if (editId) {
          const pin = pins.find(p => p.id === editId)
          if (pin) { pin.text = text; updateDotTooltip(editId, text) }
        } else if (pendingInfo) {
          const pin: Pin = { id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text, ...pendingInfo }
          pins.push(pin)
          opts.onPin?.(pin)
          renderDot(pin)
          pendingInfo = null
        }
        pop.remove(); popoverEl = null
      }
    })

    layer.appendChild(pop)
    popoverEl = pop
    setTimeout(() => (pop.querySelector('textarea') as HTMLTextAreaElement | null)?.focus(), 40)
  }

  function renderDot(pin: Pin) {
    const dot = document.createElement('div')
    const idx = pins.indexOf(pin)
    dot.title = pin.text
    dot.style.cssText = 'position:fixed;width:20px;height:20px;background:#4f46e5;border:2px solid #fff;border-radius:50%;color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.6);transform:translate(-50%,-50%);pointer-events:all;z-index:999991;'
    dot.textContent = String(idx + 1)
    dot.addEventListener('click', (e) => {
      e.stopPropagation()
      const pos = getFixedPos(pin)
      if (pos) showPopover(pos.x, pos.y, pin.text, pin.id)
    })
    layer.appendChild(dot)
    pinDots.set(pin.id, dot)
    positionDot(dot, pin)
  }

  function updateDotTooltip(id: string, text: string) {
    const dot = pinDots.get(id)
    if (dot) dot.title = text
  }

  function getFixedPos(pin: Pin): { x: number; y: number } | null {
    try {
      const el = iframe.contentDocument?.querySelector(pin.selector)
      if (!el) return null
      const iRect = iframe.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      return { x: iRect.left + eRect.left + pin.fractX * eRect.width, y: iRect.top + eRect.top + pin.fractY * eRect.height }
    } catch { return null }
  }

  function positionDot(dot: HTMLDivElement, pin: Pin) {
    const pos = getFixedPos(pin)
    if (!pos) { dot.style.display = 'none'; return }
    // Clip to iframe bounding box
    const iRect = iframe.getBoundingClientRect()
    const inView = pos.x >= iRect.left && pos.x <= iRect.right && pos.y >= iRect.top && pos.y <= iRect.bottom
    dot.style.display = inView ? 'flex' : 'none'
    dot.style.left = pos.x + 'px'
    dot.style.top = pos.y + 'px'
  }

  function reposition() {
    for (const [id, dot] of pinDots) {
      const pin = pins.find(p => p.id === id)
      if (pin) positionDot(dot, pin)
    }
  }

  return {
    setEnabled(v: boolean) {
      enabled = v
      if (!v && ring) ring.style.display = 'none'
    },
    getPins: () => [...pins],
    reposition,
    destroy() {
      ro.disconnect()
      window.removeEventListener('scroll', reposition)
      iframe.removeEventListener('load', attachToDoc)
      try {
        const doc = iframe.contentDocument
        if (doc) {
          doc.removeEventListener('mousemove', onMove, true)
          doc.removeEventListener('click', onClick, true)
          ring?.remove()
        }
      } catch {}
      layer.remove()
    },
  }
}
