import { anthropic } from '@/lib/anthropic'
import type { CheckIssue } from '@/lib/db'

export interface TextSample {
  text: string
  tag: string
  selector: string
}

export interface CopyCheckResult {
  summary: string
  issues: CheckIssue[]
}

// ─── Heuristic fallback (no API key needed) ───────────────────────────────────

const JARGON = ['tokenize', 'tokenization', 'onboard', 'ingest', 'ingestion', 'dedup', 'deduplicate', 'pipeline', 'endpoint', 'schema', 'payload', 'blob', 'config', 'dataset', 'namespace']
const VAGUE_CTAS = ['click here', 'submit', 'ok', 'yes', 'no', 'go', 'next']
const PASSIVE_PATTERNS = [/was\s+\w+ed/, /is\s+being/, /has\s+been/]

function heuristicCopyCheck(texts: TextSample[]): CopyCheckResult {
  const issues: CheckIssue[] = []
  const seen = new Set<string>()

  for (const t of texts.slice(0, 80)) {
    const lower = t.text.toLowerCase().trim()
    if (lower.length < 2) continue

    // Technical jargon in user-facing copy
    for (const word of JARGON) {
      if (lower.includes(word) && t.tag !== 'code' && t.tag !== 'pre') {
        const key = `jargon:${word}`
        if (!seen.has(key)) {
          seen.add(key)
          issues.push({
            severity: 'medium',
            description: `"${word}" is technical jargon — replace with plain language or add a tooltip explanation`,
            element: t.selector,
            wcagCriteria: 'jargon',
          })
        }
        break
      }
    }

    // Vague CTA buttons
    if ((t.tag === 'button' || t.tag === 'a') && VAGUE_CTAS.includes(lower)) {
      const key = `vague:${lower}`
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({
          severity: 'medium',
          description: `Button "${t.text}" is vague — use action-oriented copy that describes what will happen`,
          element: t.selector,
          wcagCriteria: 'button-copy',
        })
      }
    }

    // Very long button labels (> 40 chars)
    if ((t.tag === 'button' || t.tag === 'label') && t.text.length > 40) {
      const key = `long-btn:${t.selector}`
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({
          severity: 'low',
          description: `Label is ${t.text.length} chars — button labels work best under 4–5 words`,
          element: t.selector,
          wcagCriteria: 'button-copy',
        })
      }
    }

    // Passive voice in descriptions / paragraphs
    if ((t.tag === 'p' || t.tag === 'span') && t.text.length > 20) {
      for (const pat of PASSIVE_PATTERNS) {
        if (pat.test(lower)) {
          const key = `passive:${t.selector}`
          if (!seen.has(key)) {
            seen.add(key)
            issues.push({
              severity: 'low',
              description: `"${t.text.slice(0, 60)}…" uses passive voice — active voice is clearer and more direct`,
              element: t.selector,
              wcagCriteria: 'tone',
            })
          }
          break
        }
      }
    }

    // ALL CAPS (excluding short acronyms)
    if (t.text === t.text.toUpperCase() && /[A-Z]/.test(t.text) && t.text.replace(/\s/g, '').length > 4) {
      const key = `allcaps:${t.selector}`
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({
          severity: 'low',
          description: `"${t.text.slice(0, 40)}" uses ALL CAPS — switch to sentence case for readability`,
          element: t.selector,
          wcagCriteria: 'tone',
        })
      }
    }
  }

  const result = issues.slice(0, 30)
  const highCount = result.filter(i => i.severity === 'high').length
  const medCount  = result.filter(i => i.severity === 'medium').length
  const lowCount  = result.filter(i => i.severity === 'low').length

  const summary = result.length === 0
    ? `Copy looks clear across ${texts.length} text samples — no major clarity or jargon issues found.`
    : `Found ${result.length} issue${result.length !== 1 ? 's' : ''} across ${texts.length} samples: ${medCount} clarity/jargon, ${lowCount} tone/style.` +
      (highCount > 0 ? ` ${highCount} critical.` : '')

  return { summary, issues: result }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function runCopyCheck(texts: TextSample[]): Promise<CopyCheckResult> {
  if (texts.length === 0) {
    return { summary: 'No text samples found to analyze.', issues: [] }
  }

  const textBlock = texts
    .slice(0, 80)
    .map((t, i) => `${i + 1}. [${t.tag}] "${t.text}" — ${t.selector}`)
    .join('\n')

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a UX copywriting reviewer. Analyze these UI text samples from a product prototype for:
- Clarity: Is it obvious what the action or content is?
- Tone: Is it appropriate — professional but human, not robotic or overly casual?
- Jargon: Any technical, internal, or unclear terms a user wouldn't understand?
- Button / CTA copy: Is it clear, action-oriented, and specific?
- Error / status messages: Are they helpful and actionable?

UI text samples:
${textBlock}

Respond ONLY with valid JSON — no markdown fences, no explanation outside the JSON:
{
  "summary": "One sentence summary of the overall copy quality.",
  "issues": [
    {
      "severity": "high|medium|low",
      "description": "Concise description of the issue and how to fix it.",
      "element": "the selector string from the sample",
      "wcagCriteria": "clarity|tone|jargon|button-copy|error-copy"
    }
  ]
}

Only flag real issues. If copy is good, return an empty issues array. Keep descriptions under 120 characters.`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      const parsed = JSON.parse(jsonMatch[0]) as { summary: string; issues: CheckIssue[] }
      return {
        summary: parsed.summary ?? 'Copy analysis complete.',
        issues: (parsed.issues ?? []).slice(0, 30),
      }
    } catch {
      return { summary: 'Copy analysis complete.', issues: [] }
    }
  } catch (err) {
    // Auth error or missing API key — fall back to heuristic analysis
    const msg = String(err).toLowerCase()
    if (msg.includes('auth') || msg.includes('api') || msg.includes('key') || msg.includes('credential') || msg.includes('resolve')) {
      return heuristicCopyCheck(texts)
    }
    throw err
  }
}
