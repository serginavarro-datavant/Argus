import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createId } from '@/lib/utils'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

function findEntryHtml(dir: string): string {
  for (const candidate of ['index.html', 'index.htm']) {
    if (fs.existsSync(path.join(dir, candidate))) return candidate
  }
  // Recurse one level
  try {
    for (const sub of fs.readdirSync(dir)) {
      const subPath = path.join(dir, sub)
      if (fs.statSync(subPath).isDirectory()) {
        for (const candidate of ['index.html', 'index.htm']) {
          if (fs.existsSync(path.join(subPath, candidate))) return `${sub}/${candidate}`
        }
      }
    }
  } catch {}
  return 'index.html'
}

function copyStatic(src: string, dest: string) {
  const SKIP = new Set(['.git', 'node_modules', '.next', '.nuxt'])
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    if (SKIP.has(entry)) continue
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copyStatic(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { repoUrl, name, description, branch, subpath: subPath, token } = body as {
    repoUrl: string
    name?: string
    description?: string
    branch?: string
    subpath?: string
    token?: string
  }

  if (!repoUrl) return NextResponse.json({ error: 'Missing repoUrl' }, { status: 400 })

  // Inject token into HTTPS GitHub URL for private repos
  let cloneUrl = repoUrl
  if (token && repoUrl.startsWith('https://')) {
    const url = new URL(repoUrl)
    url.username = token
    cloneUrl = url.toString()
  }

  const tempId = createId()
  const tempDir = path.join(process.cwd(), 'data', 'uploads', `_tmp_${tempId}`)
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const branchFlag = branch ? `--branch ${branch}` : ''
    execSync(`git clone --depth 1 ${branchFlag} ${cloneUrl} ${tempDir}`, {
      timeout: 90000,
      stdio: 'pipe',
    })
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true })
    return NextResponse.json({ error: 'Clone failed', detail: String(err) }, { status: 500 })
  }

  // Determine the source root: subpath > built output > repo root
  let srcRoot = subPath ? path.join(tempDir, subPath) : tempDir

  // Try to build if there's a package.json in srcRoot
  const pkgJson = path.join(srcRoot, 'package.json')
  if (fs.existsSync(pkgJson)) {
    try {
      execSync('npm install && npm run build', { cwd: srcRoot, timeout: 180000, stdio: 'pipe' })
      for (const outDir of ['dist', 'build', 'out', 'public']) {
        const candidate = path.join(srcRoot, outDir)
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
          srcRoot = candidate
          break
        }
      }
    } catch {
      // Build failed — serve from srcRoot as-is
    }
  }

  if (!fs.existsSync(srcRoot)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
    return NextResponse.json({ error: `subpath "${subPath}" not found in repo` }, { status: 400 })
  }

  const entryPath = findEntryHtml(srcRoot)
  const repoName = repoUrl.split('/').pop()?.replace(/\.git$/, '') ?? 'repo'

  const project = prisma.project.create({
    data: {
      name: name?.trim() || repoName,
      description: description?.trim() || repoUrl,
      uploadPath: '',
      entryPath,
    },
  })

  // Copy static files (skip .git, node_modules etc.) to data/uploads/<project>/
  const destDir = path.join(process.cwd(), 'data', 'uploads', project.id)
  try {
    copyStatic(srcRoot, destDir)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  return NextResponse.json(project)
}
