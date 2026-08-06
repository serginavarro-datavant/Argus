// Extracts a lightweight screen map from an uploaded prototype build.
// Reads all HTML files in the project's upload directory and pulls out:
// headings, button/link labels, form field labels, and page titles.
// This map is passed to Claude as context for scenario generation.

import fs from 'fs'
import path from 'path'

export interface ScreenEntry {
  file: string        // relative path within the build
  title: string
  headings: string[]
  buttons: string[]
  links: string[]
  inputs: string[]    // placeholder / aria-label / associated label text
}

export interface ScreenMap {
  screens: ScreenEntry[]
  summary: string     // compact text digest for prompt injection
}

function extractText(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([^<]{1,120})</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const t = m[1].trim().replace(/\s+/g, ' ')
    if (t) out.push(t)
  }
  return [...new Set(out)]
}

function extractAttr(html: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]{1,120})"`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const t = m[1].trim().replace(/\s+/g, ' ')
    if (t) out.push(t)
  }
  return [...new Set(out)]
}

function extractTitle(html: string): string {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html)
  return m ? m[1].trim() : ''
}

function parseScreen(file: string, html: string): ScreenEntry {
  const title = extractTitle(html)
  const headings = [
    ...extractText(html, 'h1'),
    ...extractText(html, 'h2'),
    ...extractText(html, 'h3'),
  ].slice(0, 12)

  const buttonTexts = [
    ...extractText(html, 'button'),
    ...extractAttr(html, 'button', 'aria-label'),
    ...extractAttr(html, 'input', 'value'),
  ].filter(t => t.length > 1 && t.length < 60).slice(0, 20)

  const linkTexts = extractText(html, 'a')
    .filter(t => t.length > 1 && t.length < 60)
    .slice(0, 20)

  const inputs = [
    ...extractAttr(html, 'input', 'placeholder'),
    ...extractAttr(html, 'input', 'aria-label'),
    ...extractAttr(html, 'textarea', 'placeholder'),
    ...extractText(html, 'label'),
  ].filter(t => t.length > 1 && t.length < 60).slice(0, 15)

  return { file, title, headings, buttons: buttonTexts, links: linkTexts, inputs }
}

export function extractScreenMap(projectId: string, uploadPath: string, entryPath: string): ScreenMap {
  const base = path.join(process.cwd(), 'data', 'uploads', projectId)
  const dir = uploadPath ? path.join(base, uploadPath) : base

  const screens: ScreenEntry[] = []

  // Walk all .html files (limit to 20 to stay fast)
  function walk(d: string, depth = 0) {
    if (depth > 3 || screens.length >= 20) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (screens.length >= 20) break
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        walk(full, depth + 1)
      } else if (e.name.endsWith('.html') || e.name.endsWith('.htm')) {
        try {
          const html = fs.readFileSync(full, 'utf-8').slice(0, 40_000)
          const rel = path.relative(base, full)
          screens.push(parseScreen(rel, html))
        } catch { /* skip unreadable */ }
      }
    }
  }

  walk(dir)

  // Build compact summary string for the Claude prompt
  const summary = screens.map(s => {
    const parts = [`### ${s.file}${s.title ? ` — "${s.title}"` : ''}`]
    if (s.headings.length) parts.push(`Headings: ${s.headings.slice(0, 4).join(' | ')}`)
    if (s.buttons.length) parts.push(`Buttons: ${s.buttons.slice(0, 8).join(', ')}`)
    if (s.inputs.length) parts.push(`Inputs: ${s.inputs.slice(0, 6).join(', ')}`)
    if (s.links.length) parts.push(`Links: ${s.links.slice(0, 6).join(', ')}`)
    return parts.join('\n')
  }).join('\n\n') || '(no HTML screens found — infer from project name)'

  return { screens, summary }
}
