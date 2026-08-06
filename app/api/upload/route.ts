import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { prisma } from '@/lib/db'
import { createId } from '@/lib/utils'

function findEntryHtml(dir: string): string {
  for (const candidate of ['index.html', 'index.htm']) {
    if (fs.existsSync(path.join(dir, candidate))) return candidate
  }
  for (const sub of fs.readdirSync(dir)) {
    const subPath = path.join(dir, sub)
    if (fs.statSync(subPath).isDirectory()) {
      for (const candidate of ['index.html', 'index.htm']) {
        if (fs.existsSync(path.join(subPath, candidate))) return `${sub}/${candidate}`
      }
    }
  }
  return 'index.html'
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string | null) ?? 'Untitled'
  const description = (formData.get('description') as string | null) ?? ''

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  const tempId = createId()
  const extractDir = path.join(process.cwd(), 'data', 'uploads', tempId)
  fs.mkdirSync(extractDir, { recursive: true })

  try {
    const zip = new AdmZip(buffer)
    zip.extractAllTo(extractDir, true)
  } catch {
    fs.rmSync(extractDir, { recursive: true, force: true })
    return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 })
  }

  const entries = fs.readdirSync(extractDir)
  let workDir = extractDir
  let uploadPath = ''
  if (entries.length === 1) {
    const candidate = path.join(extractDir, entries[0])
    if (fs.statSync(candidate).isDirectory()) {
      workDir = candidate
      uploadPath = entries[0]
    }
  }

  const entryPath = findEntryHtml(workDir)

  const project = prisma.project.create({
    data: { name, description, uploadPath, entryPath },
  })

  fs.renameSync(extractDir, path.join(process.cwd(), 'data', 'uploads', project.id))

  return NextResponse.json(project)
}
