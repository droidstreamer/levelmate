import type { analyze } from './doc'
import { itemAt } from './listTree'
import type { ListResult } from './lists'
import { parsePrefix } from './editing'
import { renumberBlock } from './renumber'

type Doc = ReturnType<typeof analyze>

export type DropWhere = 'before' | 'after' | 'child'

const ws = (s: string) => /^[ \t]*/.exec(s)![0]

/** Moves lines [s, e] to just before original line `at`, replacing `moved`; null when `at` is inside the source. */
function relocate(doc: Doc, s: number, e: number, at: number, moved: string[]): ListResult | null {
  if (at > s && at <= e) return null
  const lo = Math.min(s, at)
  const hi = Math.max(e, at - 1)
  const out: string[] = []
  for (let l = lo; l <= hi; l++) {
    if (l === at) out.push(...moved)
    if (l < s || l > e) out.push(doc.lines[l])
  }
  if (at > hi) out.push(...moved)
  return { edits: [], block: renumberBlock(doc, { from: lo, to: hi, lines: out }) }
}

/** Where the dropped item lands: the line to insert before, and the indent its lines get. */
export function listDropSpot(doc: Doc, srcLine: number, targetLine: number, where: DropWhere, indentUnit = '\t') {
  const src = itemAt(doc.lists.all, srcLine)
  const target = itemAt(doc.lists.all, targetLine)
  if (!src || src.line !== srcLine || !target) return null
  if (target.line >= src.line && target.line <= src.end) return null // into itself
  const own = ws(doc.lines[target.line])
  const kid = target.children[0]
  const indent = where === 'child' ? (kid ? ws(doc.lines[kid.line]) : own + indentUnit) : own
  const at = where === 'before' ? target.line : target.end + 1
  if ((at === src.line || at === src.end + 1) && indent === ws(doc.lines[src.line])) return null // drop would change nothing (D22)
  return { src, at, indent }
}

export interface DropCandidate { target: number; where: DropWhere }

/**
 * Every place the dragged item can land in the gap just above line `gap`, one per level the gap allows, deepest
 * first: a last child of the item above, a sibling after it or after any ancestor that ends there, or a sibling
 * before the item below. The pointer's x picks among them, so the indicator stays where the pointer is.
 */
export function dropCandidates(doc: Doc, srcLine: number, gap: number, indentUnit = '\t'): DropCandidate[] {
  const out: DropCandidate[] = []
  const add = (target: number, where: DropWhere) => {
    if (listDropSpot(doc, srcLine, target, where, indentUnit)) out.push({ target, where })
  }
  let d = gap > 0 ? itemAt(doc.lists.all, gap - 1) : undefined
  if (d?.end === gap - 1) add(d.line, 'child')
  for (; d?.end === gap - 1; d = d.parent ?? undefined) add(d.line, 'after')
  const next = itemAt(doc.lists.all, gap)
  if (next?.line === gap) add(gap, 'before')
  return out
}

/** Drag-and-drop of a list item with its sub-items (F6): re-indents to the drop level. */
export function dropItem(doc: Doc, srcLine: number, targetLine: number, where: DropWhere, indentUnit = '\t'): ListResult | null {
  const spot = listDropSpot(doc, srcLine, targetLine, where, indentUnit)
  if (!spot) return null
  const { src, at, indent } = spot
  const old = ws(doc.lines[src.line])
  const moved = doc.lines.slice(src.line, src.end + 1).map((l) => (l.startsWith(old) ? indent + l.slice(old.length) : indent + l.trimStart()))
  return relocate(doc, src.line, src.end, at, moved)
}

/**
 * Lines a heading section may be dropped before: a heading of the same or a higher level, or the end of the note.
 * Before a deeper heading the section would adopt it (a `#` landing inside another `#`'s `##` children).
 */
export function sectionBoundaries(doc: Doc, srcLine: number): number[] {
  const s = doc.sections.all.find((x) => x.line === srcLine)
  if (!s) return []
  return [...doc.sections.all.filter((x) => x.level <= s.level).map((x) => x.line), doc.lines.length].filter((b) => b < s.line || b > s.end + 1)
}

/** Drag-and-drop of a heading section to a boundary; levels are kept (F6, no auto re-level). */
export function dropSection(doc: Doc, srcLine: number, at: number): ListResult | null {
  const s = doc.sections.all.find((x) => x.line === srcLine)
  if (!s || !sectionBoundaries(doc, srcLine).includes(at)) return null
  return relocate(doc, s.line, s.end, at, doc.lines.slice(s.line, s.end + 1))
}

/** Whether a line may start a drag: a list item line (not a note) or a heading. */
export function dragKind(doc: Doc, line: number): 'list' | 'heading' | null {
  if (doc.kinds[line] === 'HEADING') return 'heading'
  const item = itemAt(doc.lists.all, line)
  return item && item.line === line && parsePrefix(doc.lines[line]) ? 'list' : null
}
