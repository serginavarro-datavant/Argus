import type { CheckIssue } from '@/lib/db'

// DART design system color palette (datavant/dart)
const DART_HEX = [
  // DV Blue
  '#F4F4FA', '#E7EAFE', '#D6DAFF', '#B0BAF5', '#7C8CEF', '#475FF2', '#2945F0', '#102CD5', '#142592', '#091877',
  // Gray
  '#F9F9FB', '#F2F3F8', '#E4E6EB', '#C7CCD4', '#ACB3BD', '#8C94A1', '#606A78', '#383D45', '#1D2024', '#020202',
  // Semantic — error, success, warning
  '#DE1212', '#BD0909',
  '#008545', '#046338',
  '#D19200', '#855000',
  // Neutrals
  '#FFFFFF', '#000000',
]

function hexToRgb(hex: string): [number, number, number] | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null
}

function cssToRgb(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null
}

function isTransparent(css: string): boolean {
  if (css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return true
  const alpha = css.match(/rgba\s*\([^)]+,\s*([\d.]+)\s*\)/)
  return alpha ? parseFloat(alpha[1]) < 0.05 : false
}

const DART_RGB = DART_HEX.map(hexToRgb).filter(Boolean) as Array<[number, number, number]>

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function isOnPalette(rgb: [number, number, number], threshold = 22): boolean {
  return DART_RGB.some(dart => colorDistance(rgb, dart) <= threshold)
}

export interface StyleSample {
  value: string
  selector: string
  prop: string
}

export interface FontSample {
  font: string
  selector: string
}

export interface DSCheckResult {
  summary: string
  issues: CheckIssue[]
}

const ALLOWED_FONTS = ['geist', 'geist sans', 'geist mono', '-apple-system', 'system-ui', 'blinkmacsystemfont', 'arial', 'helvetica neue', 'helvetica']

export function runDSCheck(colors: StyleSample[], fonts: FontSample[]): DSCheckResult {
  const issues: CheckIssue[] = []
  const seenColors = new Set<string>()

  for (const sample of colors) {
    if (isTransparent(sample.value)) continue
    const rgb = cssToRgb(sample.value)
    if (!rgb) continue
    // Skip near-white and near-black (browser defaults)
    if (colorDistance(rgb, [255, 255, 255]) < 5 || colorDistance(rgb, [0, 0, 0]) < 5) continue

    if (!isOnPalette(rgb)) {
      if (seenColors.has(sample.value)) continue
      seenColors.add(sample.value)
      issues.push({
        severity: 'medium',
        description: `Color ${sample.value} is not in the DART palette (${sample.prop})`,
        element: sample.selector,
        wcagCriteria: 'ds-color',
      })
    }
  }

  const seenFonts = new Set<string>()
  for (const sample of fonts) {
    const normalized = sample.font.toLowerCase().replace(/['"]/g, '').trim()
    if (seenFonts.has(normalized)) continue
    if (!ALLOWED_FONTS.some(f => normalized.includes(f))) {
      seenFonts.add(normalized)
      issues.push({
        severity: 'low',
        description: `Font "${sample.font}" is not Geist — DART requires Geist as the primary typeface`,
        element: sample.selector,
        wcagCriteria: 'ds-typography',
      })
    }
  }

  const colorViolations = issues.filter(i => i.wcagCriteria === 'ds-color').length
  const fontViolations = issues.filter(i => i.wcagCriteria === 'ds-typography').length

  const summary =
    issues.length === 0
      ? 'All sampled colors and fonts match the DART design system.'
      : [
          colorViolations > 0 && `${colorViolations} off-palette color${colorViolations !== 1 ? 's' : ''}`,
          fontViolations > 0 && `${fontViolations} non-Geist font${fontViolations !== 1 ? 's' : ''}`,
        ]
          .filter(Boolean)
          .join(', ') + ' found.'

  return { summary, issues: issues.slice(0, 30) }
}
