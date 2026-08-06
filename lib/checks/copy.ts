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

export async function runCopyCheck(texts: TextSample[]): Promise<CopyCheckResult> {
  if (texts.length === 0) {
    return { summary: 'No text samples found to analyze.', issues: [] }
  }

  const textBlock = texts
    .slice(0, 80)
    .map((t, i) => `${i + 1}. [${t.tag}] "${t.text}" — ${t.selector}`)
    .join('\n')

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
}
