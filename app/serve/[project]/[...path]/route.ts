import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  cjs: 'application/javascript; charset=utf-8',
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
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  map: 'application/json',
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

  const base = path.join(process.cwd(), 'data', 'uploads', project)
  const rel = segments.join('/')

  // Try exact path, then path/index.html as fallback for directory URLs
  const candidates = [
    path.join(base, rel),
    path.join(base, rel, 'index.html'),
  ]

  for (const candidate of candidates) {
    // Path traversal guard: resolved path must stay within data/uploads/<project>
    if (!candidate.startsWith(base + path.sep) && candidate !== base) continue
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
