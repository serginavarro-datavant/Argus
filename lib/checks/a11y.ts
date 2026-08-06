import { anthropic } from '../anthropic'
import type { CheckIssue } from '../types'

export async function runA11yCheck(html: string): Promise<{
  summary: string
  issues: CheckIssue[]
}> {
  const truncated = html.slice(0, 10000)

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a WCAG accessibility auditor. Analyze this HTML and return a JSON object with exactly this shape — no markdown fences, just raw JSON:
{"summary":"one sentence summary","issues":[{"severity":"high","description":"...","element":"optional css selector or tag"},{"severity":"medium","description":"..."}]}

Check for: missing alt text on images, missing form labels, missing button text, missing ARIA roles where needed, heading level skips, color contrast warnings (mention suspicious inline styles), keyboard-inaccessible interactive elements, empty links.

Return at most 8 issues, most severe first.

HTML:
${truncated}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      summary: 'Could not parse AI response.',
      issues: [{ severity: 'low', description: text.slice(0, 200) }],
    }
  }
}
