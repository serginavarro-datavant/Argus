import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serves axe-core from node_modules so the injected iframe script doesn't need an external CDN.
export async function GET() {
  const filePath = path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js')
  try {
    const src = fs.readFileSync(filePath)
    return new NextResponse(src, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse('axe-core not found', { status: 404 })
  }
}
