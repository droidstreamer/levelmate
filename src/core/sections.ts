import type { analyze } from './doc'
import type { ListResult } from './lists'
import { sectionAt } from './sectionTree'

type Doc = ReturnType<typeof analyze>

/** Swaps the section at heading `line` with its previous/next sibling of the same parent (F4). */
export function moveSection(doc: Doc, line: number, dir: 1 | -1): ListResult | null {
  const s = doc.kinds[line] === 'HEADING' ? sectionAt(doc.sections.all, line) : undefined
  if (!s) return null
  const sibs = s.parent ? s.parent.children : doc.sections.roots
  const other = sibs[sibs.indexOf(s) + dir]
  if (!other) return { edits: [] }
  const mine = doc.lines.slice(s.line, s.end + 1)
  const theirs = doc.lines.slice(other.line, other.end + 1)
  return dir < 0
    ? { edits: [], block: { from: other.line, to: s.end, lines: [...mine, ...theirs] }, lineDelta: -theirs.length }
    : { edits: [], block: { from: s.line, to: other.end, lines: [...theirs, ...mine] }, lineDelta: theirs.length }
}
