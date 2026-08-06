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

// Legacy a11y-only injection (kept for backwards compat)
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

// Combined scanner: axe + text extraction + style sampling, posts argus-scan-complete
function injectScanner(html: string): string {
  const script = `
<script src="/api/axe-runtime"></script>
<script>
(function(){
var tries=0;
function run(){
  if(typeof axe==='undefined'){if(++tries<40){setTimeout(run,250);return;}}
  axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','best-practice']},resultTypes:['violations','passes']})
  .then(function(res){
    // ── Text extraction (copy check) ──────────────────────────────
    var texts=[],seen={};
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,[role="button"],a[href],label,p,li,[placeholder],[aria-label],[role="alert"]').forEach(function(el){
      if(texts.length>120)return;
      var t=(el.textContent||'').trim(),ph=el.getAttribute&&el.getAttribute('placeholder'),al=el.getAttribute&&el.getAttribute('aria-label');
      var c=t||ph||al;
      if(!c||c.length<2||c.length>250||seen[c])return;
      seen[c]=1;
      var cls=el.className&&typeof el.className==='string'?el.className.split(' ').filter(Boolean)[0]:'';
      var sel=el.id?'#'+el.id:(el.tagName.toLowerCase()+(cls?'.'+cls:''));
      texts.push({text:c,tag:el.tagName.toLowerCase(),selector:sel});
    });
    // ── Style sampling (DS check) ─────────────────────────────────
    var colorMap={},fontMap={},i=0;
    document.querySelectorAll('*').forEach(function(el){
      if(i++>400)return;
      try{
        var cs=window.getComputedStyle(el);
        ['color','background-color','border-color'].forEach(function(p){
          var v=cs.getPropertyValue(p);
          if(!v||v==='rgba(0, 0, 0, 0)'||v==='transparent'||colorMap[v])return;
          var cls2=el.className&&typeof el.className==='string'?el.className.split(' ').filter(Boolean)[0]:'';
          colorMap[v]={value:v,selector:(el.id?'#'+el.id:(el.tagName.toLowerCase()+(cls2?'.'+cls2:''))),prop:p};
        });
        var ff=cs.fontFamily.split(',')[0].replace(/['"]/g,'').trim();
        if(ff&&!fontMap[ff]){
          var cls3=el.className&&typeof el.className==='string'?el.className.split(' ').filter(Boolean)[0]:'';
          fontMap[ff]={font:ff,selector:(el.id?'#'+el.id:(el.tagName.toLowerCase()+(cls3?'.'+cls3:'')))};
        }
      }catch(e){}
    });
    window.parent.postMessage({
      type:'argus-scan-complete',
      axeViolations:res.violations,
      axePassCount:res.passes.length,
      texts:texts,
      colors:Object.values(colorMap).slice(0,80),
      fonts:Object.values(fontMap).slice(0,20),
    },'*');
  }).catch(function(e){
    window.parent.postMessage({type:'argus-axe-error',message:String(e)},'*');
  });
}
window.addEventListener('load',run);
})();
</script>`
  return html.includes('</body>') ? html.replace('</body>', script + '\n</body>') : html + script
}

// Highlight a specific element by CSS selector (for issue element linking)
function injectHighlight(html: string, selector: string): string {
  // JSON.stringify safely escapes the selector for use in a JS string literal
  const safeSelector = JSON.stringify(selector)
  const script = `
<script>
window.addEventListener('load',function(){
  try{
    var el=document.querySelector(${safeSelector});
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'center'});
      el.style.setProperty('outline','3px solid #2945F0','important');
      el.style.setProperty('outline-offset','3px','important');
      el.style.setProperty('border-radius','3px','important');
      el.style.setProperty('transition','outline 0.2s','important');
    }
  }catch(e){}
});
</script>`
  return html.includes('</body>') ? html.replace('</body>', script + '\n</body>') : html + script
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ project: string; path: string[] }> }
) {
  const { project, path: segments } = await params
  const rel = segments.join('/')
  const sp = new URL(req.url).searchParams
  const injectAxe = sp.has('_argusAxe')
  const injectScan = sp.has('_argusScan')
  const highlightSelector = sp.get('_argusHighlight') ?? null

  const projectRecord = prisma.project.findUnique({ where: { id: project } })

  // Remote-URL projects: proxy to the hosted prototype
  if (projectRecord?.remoteBaseUrl) {
    const remoteUrl = `${projectRecord.remoteBaseUrl}/${rel}`
    try {
      const upstream = await fetch(remoteUrl, { headers: { 'User-Agent': 'Argus/1.0' } })
      if (!upstream.ok) return new NextResponse('Not found', { status: 404 })
      const ct = upstream.headers.get('content-type') ?? getMime(rel)
      if (ct.includes('text/html')) {
        let html = await upstream.text()
        if (injectScan) html = injectScanner(html)
        else if (injectAxe) html = injectAxeRunner(html)
        if (highlightSelector) html = injectHighlight(html, highlightSelector)
        if (injectScan || injectAxe || highlightSelector) {
          return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
        }
      }
      const body = await upstream.arrayBuffer()
      return new NextResponse(body, { headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' } })
    } catch {
      return new NextResponse('Upstream error', { status: 502 })
    }
  }

  const base = path.join(process.cwd(), 'data', 'uploads', project)
  const candidates = [
    path.join(base, rel),
    path.join(base, rel, 'index.html'),
  ]

  for (const candidate of candidates) {
    if (!candidate.startsWith(base + path.sep) && candidate !== base) continue
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const mime = getMime(candidate)
      if (mime.includes('text/html')) {
        let html = fs.readFileSync(candidate, 'utf-8')
        if (injectScan) html = injectScanner(html)
        else if (injectAxe) html = injectAxeRunner(html)
        if (highlightSelector) html = injectHighlight(html, highlightSelector)
        if (injectScan || injectAxe || highlightSelector) {
          return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
        }
      }
      const buf = fs.readFileSync(candidate)
      return new NextResponse(buf, { headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' } })
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
