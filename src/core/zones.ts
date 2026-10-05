// Finds lines the plugin must never treat as headings or list items (PRD 5.1).
const FENCE = /^\s*(`{3,}|~{3,})/
const LIST_START = /^\s*(?:[-*+]|\d+[.)])(?:[ \t]|$)/
const TABLE_DELIM = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/

function indentWidth(line: string, tabSize: number): number {
  let w = 0
  for (const ch of line) {
    if (ch === ' ') w++
    else if (ch === '\t') w += tabSize
    else break
  }
  return w
}

/** protectedLines[i] is true when line i is in frontmatter, code, math or a table. */
export function scanZones(lines: string[], tabSize = 4): boolean[] {
  const prot = new Array<boolean>(lines.length).fill(false)
  let i = 0

  if (lines[0]?.trimEnd() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l))
    if (end > 0) {
      for (; i <= end; i++) prot[i] = true
    }
  }

  let fence: { ch: string; len: number } | null = null
  let math = false
  let inList = false // inside a list block, so deep indentation is continuation, not code
  let inIndented = false
  let table = false

  for (; i < lines.length; i++) {
    const line = lines[i]
    const blank = line.trim() === ''

    if (fence) {
      prot[i] = true
      const m = FENCE.exec(line)
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len && line.trim() === m[1]) fence = null
      continue
    }
    if (math) {
      prot[i] = true
      if (line.includes('$$')) math = false
      continue
    }

    const f = FENCE.exec(line)
    if (f) {
      prot[i] = true
      fence = { ch: f[1][0], len: f[1].length }
      continue
    }
    if (line.trimStart().startsWith('$$')) {
      prot[i] = true
      if ((line.match(/\$\$/g) ?? []).length % 2 === 1) math = true
      continue
    }

    if (table) {
      if (!blank && line.includes('|')) {
        prot[i] = true
        continue
      }
      table = false
    }
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && TABLE_DELIM.test(lines[i + 1])) {
      table = true
      prot[i] = true
      continue
    }

    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    const wide = indentWidth(line, tabSize) >= 4
    if (!blank && wide && !inList && (prevBlank || inIndented)) {
      prot[i] = true
      inIndented = true
      continue
    }
    if (!blank) inIndented = false

    if (LIST_START.test(line)) inList = true
    else if (!blank && !wide) inList = false
  }
  return prot
}
