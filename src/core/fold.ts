import type { analyze } from './doc'
import { itemAt } from './listTree'
import { sectionAt } from './sectionTree'

type Doc = ReturnType<typeof analyze>

/**
 * The fold for the list item or heading section at `line`: from the end of line `line`
 * to the end of line `end` (0-based). Null when there is nothing to fold.
 */
export function foldTarget(doc: Doc, line: number): { line: number; end: number } | null {
  if (doc.kinds[line] === 'HEADING') {
    const s = sectionAt(doc.sections.all, line)!
    let end = s.end
    while (end > line && doc.lines[end].trim() === '') end--
    return end > line ? { line, end } : null
  }
  const item = itemAt(doc.lists.all, line)
  return item && item.end > item.line ? { line: item.line, end: item.end } : null
}
