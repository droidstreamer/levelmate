import type { analyze } from './doc'
import type { LineEdit } from './headings'
import { itemAt, ListItem } from './listTree'
import { renumberBlock } from './renumber'

type Doc = ReturnType<typeof analyze>

export type ListAction = 'indent' | 'outdent' | 'moveUp' | 'moveDown'

export interface ListResult {
  edits: LineEdit[]
  /** Replace whole lines [from, to] (0-based, inclusive) with `lines`; used by moves. */
  block?: { from: number; to: number; lines: string[] }
  /** How many lines the cursor travels with a moved block. */
  lineDelta?: number
  notice?: string
}

const NONE: ListResult = { edits: [] }

/** Chars of leading whitespace worth `width` columns (tab = 4), so children keep their relative depth. */
function unindent(text: string, width: number): number {
  let n = 0
  for (let w = 0; w < width && (text[n] === ' ' || text[n] === '\t'); n++) w += text[n] === '\t' ? 4 : 1
  return n
}

/** Items in lines [from, to] with their sub-items, as top-most selected items (parent not selected). */
function selectedRoots(doc: Doc, start: ListItem, from: number, to: number): ListItem[] {
  const set = new Set(doc.lists.all.filter((i) => i.line >= from && i.line <= to))
  set.add(start)
  return [...set].filter((i) => !i.parent || !set.has(i.parent))
}

/**
 * Indent, outdent or move the list items in lines [line, toLine] (0-based), with their sub-items.
 * Returns null when `line` is not in a list (caller falls through); a blocked action
 * returns an empty result so the key is still consumed, as Outliner does.
 */
export function runListAction(doc: Doc, line: number, action: ListAction, indentUnit = '\t', toLine = line): ListResult | null {
  const start = itemAt(doc.lists.all, line)
  if (!start) return null
  const moving = action === 'moveUp' || action === 'moveDown'
  if (!moving && start.line !== line) return null

  const group = toLine === line ? [start] : selectedRoots(doc, start, line, toLine)
  const first = group[0]
  const last = group[group.length - 1]
  const skipped = doc.kinds.slice(line, toLine + 1).includes('HEADING')
  const notice = skipped ? 'Headings in the selection were skipped.' : undefined
  if (group.some((g) => g.parent !== first.parent)) return { ...NONE, notice }

  const sibs = first.parent ? first.parent.children : doc.lists.roots
  const range: number[] = []
  for (let l = first.line; l <= last.end; l++) range.push(l)

  if (action === 'indent') {
    return sibs.indexOf(first) === 0 ? NONE : { edits: range.map((l) => ({ line: l, from: 0, to: 0, insert: indentUnit })), notice }
  }
  if (action === 'outdent') {
    if (!first.parent) return NONE
    const step = first.indent - first.parent.indent
    return { edits: range.map((l) => ({ line: l, from: 0, to: unindent(doc.lines[l], step), insert: '' })), notice }
  }

  const other = sibs[action === 'moveUp' ? sibs.indexOf(first) - 1 : sibs.indexOf(last) + 1]
  // Roots of every list in the note share one array: only a neighbour right next to the block is a sibling, so a move never
  // swaps across a heading or blank line between two lists (that dropped the heading and merged the lists).
  if (!other || (action === 'moveUp' ? other.end !== first.line - 1 : other.line !== last.end + 1)) return NONE
  const mine = doc.lines.slice(first.line, last.end + 1)
  const theirs = doc.lines.slice(other.line, other.end + 1)
  return action === 'moveUp'
    ? { edits: [], block: renumberBlock(doc, { from: other.line, to: last.end, lines: [...mine, ...theirs] }), lineDelta: -theirs.length, notice }
    : { edits: [], block: renumberBlock(doc, { from: first.line, to: other.end, lines: [...theirs, ...mine] }), lineDelta: theirs.length, notice }
}
