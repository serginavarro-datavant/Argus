import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
}

function getMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ project: string; path: string[] }> }
) {
  const { project, path: segments } = await params

  // Try exact path, then with index.html appended
  const base = path.join(process.cwd(), 'data', 'uploads', project)

  // Check for a single hoisted sub-directory
  let root = base
  if (fs.existsSync(base)) {
    const entries = fs.readdirSync(base)
    if (entries.length === 1 && fs.statSync(path.join(base, entries[0])).isDirectory()) {
      root = path.join(base, entries[0])
    }
  }

  const rel = segments.join('/')
  const candidates = [
    path.join(root, rel),
    path.join(root, rel, 'index.html'),
    path.join(base, rel),
    path.join(base, rel, 'index.html'),
  ]

  for (const candidate of candidates) {
    // Prevent path traversal
    if (!candidate.startsWith(path.join(process.cwd(), 'data', 'uploads'))) continue
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const buf = fs.readFileSync(candidate)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': getMime(candidate),
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
