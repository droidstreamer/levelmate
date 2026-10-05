import type { LineClass } from './classifier'

export interface ListItem {
  line: number
  indent: number
  /** Last line of the item including continuation lines and descendants, inclusive. */
  end: number
  parent: ListItem | null
  children: ListItem[]
}

function indentWidth(line: string, tabSize: number): number {
  let w = 0
  for (const ch of line) {
    if (ch === ' ') w++
    else if (ch === '\t') w += tabSize
    else break
  }
  return w
}

/**
 * Builds list items. A list block ends at a blank line or a line that is neither a list item
 * nor indented deeper than the last item (its continuation/note lines).
 */
export function buildLists(lines: string[], kinds: LineClass[], tabSize = 4): { roots: ListItem[]; all: ListItem[] } {
  const roots: ListItem[] = []
  const all: ListItem[] = []
  let stack: ListItem[] = []

  const close = (upTo: number) => {
    for (const s of stack) s.end = Math.max(s.end, upTo)
  }

  lines.forEach((text, line) => {
    const k = kinds[line]
    const blank = text.trim() === ''
    const indent = indentWidth(text, tabSize)
    if (k === 'LIST' || k === 'LIST_HEADING') {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      const parent = stack[stack.length - 1] ?? null
      const item: ListItem = { line, indent, end: line, parent, children: [] }
      ;(parent ? parent.children : roots).push(item)
      all.push(item)
      stack.push(item)
      close(line)
    } else if (!blank && stack.length && indent > stack[stack.length - 1].indent) {
      // continuation line (note, indented code fence, ...) belongs to the deepest open item
      close(line)
    } else if (!blank && stack.length && indent > stack[0].indent) {
      // dedented continuation still inside an outer item
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      close(line)
    } else {
      stack = []
    }
  })
  return { roots, all }
}

/** Deepest item whose lines include `line`. */
export function itemAt(all: ListItem[], line: number): ListItem | undefined {
  let best: ListItem | undefined
  for (const it of all) if (it.line <= line && line <= it.end) best = it
  return best
}
