import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createId } from '@/lib/utils'
import { parseGitHubUrl, downloadGitHubFolder } from '@/lib/github'
import fs from 'fs'
import path from 'path'

function findEntryHtml(dir: string): string {
  for (const candidate of ['index.html', 'index.htm']) {
    if (fs.existsSync(path.join(dir, candidate))) return candidate
  }
  try {
    for (const sub of fs.readdirSync(dir)) {
      const p = path.join(dir, sub)
      if (fs.statSync(p).isDirectory()) {
        for (const candidate of ['index.html', 'index.htm']) {
          if (fs.existsSync(path.join(p, candidate))) return `${sub}/${candidate}`
        }
      }
    }
  } catch {}
  return 'index.html'
}

export async function POST(request: Request) {
  const body = await request.json()
  const { url: rawUrl, name, token } = body as {
    url: string
    name?: string
    token?: string
  }

  if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const parsed = parseGitHubUrl(rawUrl)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid GitHub URL — paste a github.com repo or folder link' },
      { status: 400 },
    )
  }

  const { owner, repo, branch, subpath } = parsed

  // Download files to a temp dir first
  const tempDir = path.join(process.cwd(), 'data', 'uploads', `_tmp_${createId()}`)
  try {
    await downloadGitHubFolder(owner, repo, branch, subpath, tempDir, token)
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true })
    return NextResponse.json({ error: String(err).replace(/^Error:\s*/, '') }, { status: 400 })
  }

  // Detect built output folder (dist > build > out > public)
  let uploadPath = ''
  for (const candidate of ['dist', 'build', 'out', 'public']) {
    if (fs.existsSync(path.join(tempDir, candidate, 'index.html'))) {
      uploadPath = candidate
      break
    }
  }

  const workDir = uploadPath ? path.join(tempDir, uploadPath) : tempDir
  const entryPath = findEntryHtml(workDir)

  const project = prisma.project.create({
    data: {
      name: name?.trim() || repo,
      description: rawUrl,
      uploadPath,
      entryPath,
      remoteBaseUrl: null,
    },
  })

  // Move temp dir to final location
  const destDir = path.join(process.cwd(), 'data', 'uploads', project.id)
  try {
    fs.renameSync(tempDir, destDir)
  } catch {
    // Cross-device fallback (shouldn't happen since both are under data/)
    fs.cpSync(tempDir, destDir, { recursive: true })
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  return NextResponse.json(project)
}
