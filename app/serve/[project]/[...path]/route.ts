import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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

function injectAxeRunner(html: string): string {
  const script = `
<script src="/api/axe-runtime"></script>
<script>
(function(){var t=0;function r(){if(typeof axe==='undefined'){if(++t<40){setTimeout(r,250);return;}}
axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','best-practice']},resultTypes:['violations','passes']})
.then(function(res){window.parent.postMessage({type:'argus-axe-results',violations:res.violations,passCount:res.passes.length},'*');})
.catch(function(e){window.parent.postMessage({type:'argus-axe-error',message:String(e)},'*');});}
window.addEventListener('load',r);})();
</script>`
  return html.includes('</body>') ? html.replace('</body>', script + '\n</body>') : html + script
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ project: string; path: string[] }> }
) {
  const { project, path: segments } = await params
  const rel = segments.join('/')
  const injectAxe = new URL(req.url).searchParams.has('_argusAxe')

  // Remote-URL projects: proxy the request to the hosted prototype
  const projectRecord = prisma.project.findUnique({ where: { id: project } })
  if (projectRecord?.remoteBaseUrl) {
    const remoteUrl = `${projectRecord.remoteBaseUrl}/${rel}`
    try {
      const upstream = await fetch(remoteUrl, { headers: { 'User-Agent': 'Argus/1.0' } })
      if (!upstream.ok) return new NextResponse('Not found', { status: 404 })
      const ct = upstream.headers.get('content-type') ?? getMime(rel)
      if (injectAxe && ct.includes('text/html')) {
        const html = injectAxeRunner(await upstream.text())
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
      }
      const body = await upstream.arrayBuffer()
      return new NextResponse(body, {
        headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
      })
    } catch {
      return new NextResponse('Upstream error', { status: 502 })
    }
  }

  const base = path.join(process.cwd(), 'data', 'uploads', project)

  // Try exact path, then path/index.html as fallback for directory URLs
  const candidates = [
    path.join(base, rel),
    path.join(base, rel, 'index.html'),
  ]

  for (const candidate of candidates) {
    // Path traversal guard: resolved path must stay within data/uploads/<project>
    if (!candidate.startsWith(base + path.sep) && candidate !== base) continue
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const mime = getMime(candidate)
      if (injectAxe && mime.includes('text/html')) {
        const html = injectAxeRunner(fs.readFileSync(candidate, 'utf-8'))
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
      }
      const buf = fs.readFileSync(candidate)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
