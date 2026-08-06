import fs from 'fs'
import path from 'path'

export interface ParsedGitHubUrl {
  owner: string
  repo: string
  branch: string
  subpath: string
}

/**
 * Parses any GitHub URL into its components.
 * Handles:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch
 *   https://github.com/owner/repo/tree/branch/path/to/folder
 */
export function parseGitHubUrl(rawUrl: string): ParsedGitHubUrl | null {
  try {
    const url = new URL(rawUrl.trim())
    if (url.hostname !== 'github.com') return null

    // pathname: /owner/repo  or  /owner/repo/tree/branch/some/path
    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/')
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0])
    const repo = decodeURIComponent(parts[1]).replace(/\.git$/, '')
    const isTree = parts[2] === 'tree' || parts[2] === 'blob'
    const branch = isTree && parts[3] ? decodeURIComponent(parts[3]) : 'main'
    const subpath = isTree && parts.length > 4
      ? parts.slice(4).map(decodeURIComponent).join('/')
      : ''

    return { owner, repo, branch, subpath }
  } catch {
    return null
  }
}

interface TreeEntry { type: string; path: string }

/**
 * Downloads all files under `subpath` from a GitHub repo using the Git Trees API
 * + raw content URLs. No git clone required.
 *
 * Auth: pass a token directly, or set GITHUB_TOKEN env var.
 */
export async function downloadGitHubFolder(
  owner: string,
  repo: string,
  branch: string,
  subpath: string,
  destDir: string,
  token?: string,
): Promise<{ fileCount: number }> {
  const effectiveToken = token || process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Argus/1.0',
  }
  if (effectiveToken) headers.Authorization = `Bearer ${effectiveToken}`

  // Fetch the full recursive tree in one request
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  const treeRes = await fetch(treeUrl, { headers })

  if (!treeRes.ok) {
    if (treeRes.status === 401 || treeRes.status === 404) {
      throw new Error(
        treeRes.status === 401
          ? 'Repository requires authentication — add a token (or set GITHUB_TOKEN in .env)'
          : 'Repository not found — check the URL or add a token for private repos',
      )
    }
    const body = await treeRes.text().catch(() => '')
    throw new Error(`GitHub API ${treeRes.status}: ${body.slice(0, 200)}`)
  }

  const { tree } = (await treeRes.json()) as { tree: TreeEntry[]; truncated: boolean }

  // Filter to blobs inside the requested subpath
  const prefix = subpath ? subpath + '/' : ''
  const files = tree.filter(e => e.type === 'blob' && e.path.startsWith(prefix))

  if (files.length === 0) {
    throw new Error(
      subpath
        ? `No files found under "${subpath}" — check the URL path`
        : 'Repository appears to be empty',
    )
  }

  fs.mkdirSync(destDir, { recursive: true })

  // Download in parallel batches of 10
  const BATCH = 10
  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(
      files.slice(i, i + BATCH).map(async file => {
        const relPath = prefix ? file.path.slice(prefix.length) : file.path
        const destPath = path.join(destDir, relPath)
        fs.mkdirSync(path.dirname(destPath), { recursive: true })

        // raw.githubusercontent.com bypasses the API rate limit
        const encodedPath = file.path.split('/').map(encodeURIComponent).join('/')
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`
        const fileRes = await fetch(rawUrl, { headers })
        if (fileRes.ok) {
          fs.writeFileSync(destPath, Buffer.from(await fileRes.arrayBuffer()))
        }
      }),
    )
  }

  return { fileCount: files.length }
}
