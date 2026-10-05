import type { analyze } from './doc'
import { sectionAt } from './sectionTree'

type Doc = ReturnType<typeof analyze>

/** Replace columns [from, to) of `line` with `insert`. */
export interface LineEdit {
  line: number
  from: number
  to: number
  insert: string
}

export interface HeadingResult {
  edits: LineEdit[]
  notice?: string
}

export type HeadingAction =
  | { kind: 'shift'; dir: 1 | -1; children: boolean }
  | { kind: 'shiftListHeading'; dir: 1 | -1 }
  | { kind: 'remove' }

const H6_TARGET = 'Heading is already H6.'

// Everything before the `#` run (indent, list marker, checkbox) never contains '#'.
const MARK = /^([^#]*)(#{1,6})([ \t]?)/

function levelEdit(doc: Doc, line: number, dir: 1 | -1): LineEdit | null {
  const m = MARK.exec(doc.lines[line])!
  const at = m[1].length + m[2].length
  if (dir > 0) return m[2].length >= 6 ? null : { line, from: at, to: at, insert: '#' }
  return m[2].length <= 1 ? null : { line, from: at - 1, to: at, insert: '' }
}

function shift(doc: Doc, line: number, dir: 1 | -1, children: boolean): HeadingResult {
  const sec = sectionAt(doc.sections.all, line)!
  if (dir > 0 && sec.level >= 6) return { edits: [], notice: H6_TARGET }
  const targets = children ? doc.sections.all.filter((s) => s.line >= sec.line && s.line <= sec.end) : [sec]
  const edits: LineEdit[] = []
  let clamped = 0
  for (const s of targets) {
    const e = levelEdit(doc, s.line, dir)
    if (e) edits.push(e)
    else if (dir > 0) clamped++
  }
  const notice = clamped ? `${clamped} heading${clamped > 1 ? 's were' : ' was'} already H6 and stayed at H6.` : undefined
  return { edits, notice }
}

/** Multi-line selection: every heading line shifts one level; the children setting is ignored (F5). */
function shiftRange(doc: Doc, from: number, to: number, dir: 1 | -1): HeadingResult {
  const edits: LineEdit[] = []
  let clamped = 0
  let listLines = false
  for (let l = from; l <= to; l++) {
    if (doc.kinds[l] === 'LIST' || doc.kinds[l] === 'LIST_HEADING') listLines = true
    if (doc.kinds[l] !== 'HEADING') continue
    const e = levelEdit(doc, l, dir)
    if (e) edits.push(e)
    else if (dir > 0) clamped++
  }
  const notes = [
    clamped && `${clamped} heading${clamped > 1 ? 's were' : ' was'} already H6 and stayed at H6.`,
    listLines && 'List items in the selection were skipped.',
  ].filter(Boolean)
  return { edits, notice: notes.join(' ') || undefined }
}

/**
 * Runs a heading action on lines [from, to] (0-based). Returns null when the action does not
 * apply, so the caller lets the key fall through to Obsidian's default.
 */
export function runHeadingAction(doc: Doc, from: number, to: number, action: HeadingAction): HeadingResult | null {
  const kind = doc.kinds[from]
  if (action.kind === 'shift') {
    if (kind !== 'HEADING') return null
    return from === to ? shift(doc, from, action.dir, action.children) : shiftRange(doc, from, to, action.dir)
  }
  if (action.kind === 'shiftListHeading') {
    if (kind !== 'LIST_HEADING' || from !== to) return null
    const e = levelEdit(doc, from, action.dir)
    if (e) return { edits: [e] }
    return { edits: [], notice: action.dir > 0 ? H6_TARGET : undefined }
  }
  const edits: LineEdit[] = []
  for (let l = from; l <= to; l++) {
    if (doc.kinds[l] !== 'HEADING' && doc.kinds[l] !== 'LIST_HEADING') continue
    const m = MARK.exec(doc.lines[l])!
    edits.push({ line: l, from: m[1].length, to: m[1].length + m[2].length + m[3].length, insert: '' })
  }
  return edits.length ? { edits } : null
}

