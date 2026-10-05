import type { analyze } from './doc'
import type { LineEdit } from './headings'
import { itemAt, ListItem } from './listTree'
import { runListAction } from './lists'

type Doc = ReturnType<typeof analyze>

export interface Pos {
  line: number
  col: number
}

export interface EditResult {
  edits: LineEdit[]
  /** Cursor in the document after the edits; omitted when the editor's mapping is right. */
  cursor?: Pos
}

const PREFIX = /^([ \t]*)([-*+]|\d+[.)])(?:([ \t]+)(\[.\](?:[ \t]+|$))?|$)/

/** Splits a list line into indent, marker, gap and checkbox; `len` is where the content starts. */
export function parsePrefix(text: string) {
  const m = PREFIX.exec(text)
  return m && { indent: m[1], marker: m[2], gap: m[3] ?? '', box: m[4] ?? '', len: m[0].length }
}

/** Content start column of a list line, or null when the line is not a list item (zones included). */
export function prefixLen(doc: Doc, line: number): number | null {
  const k = doc.kinds[line]
  return k === 'LIST' || k === 'LIST_HEADING' ? parsePrefix(doc.lines[line])?.len ?? null : null
}

const before = (a: Pos, b: Pos) => a.line < b.line || (a.line === b.line && a.col < b.col)

function newPrefix(p: NonNullable<ReturnType<typeof parsePrefix>>, from: NonNullable<ReturnType<typeof parsePrefix>>, sibling: boolean) {
  const n = /^\d+/.exec(from.marker)
  const marker = n && sibling ? `${+n[0] + 1}${from.marker.slice(-1)}` : from.marker
  return from.indent + marker + (from.gap || ' ') + (p.box ? '[ ] ' : '')
}

/**
 * Enter on a list item line. Empty item outdents (or drops its marker at root); at the end of an
 * item with children the new line is the first child; otherwise splits into a new sibling.
 * Null falls through to Obsidian's Enter (note lines, cursor inside the marker).
 */
export function enter(doc: Doc, line: number, col: number): EditResult | null {
  const item = itemAt(doc.lists.all, line)
  const text = doc.lines[line]
  const p = item && item.line === line ? parsePrefix(text) : null
  if (!item || !p || col < p.len) return null

  if (text.slice(p.len).trim() === '') {
    return item.parent ? runListAction(doc, line, 'outdent') : { edits: [{ line, from: 0, to: text.length, insert: '' }] }
  }
  if (col >= text.length) {
    const kid = item.children[0]
    const at = kid ? kid.line - 1 : item.end // after any note lines
    const pre = kid ? newPrefix(p, parsePrefix(doc.lines[kid.line])!, false) : newPrefix(p, p, true)
    const len = doc.lines[at].length
    return { edits: [{ line: at, from: len, to: len, insert: '\n' + pre }], cursor: { line: at + 1, col: pre.length } }
  }
  const pre = newPrefix(p, p, true)
  const rest = text.slice(col).replace(/^[ \t]+/, '')
  return { edits: [{ line, from: col, to: text.length, insert: '\n' + pre + rest }], cursor: { line: line + 1, col: pre.length } }
}

/** Shift+Enter: a new note line inside the item, aligned with its content. */
export function shiftEnter(doc: Doc, line: number, col: number): EditResult | null {
  const item = itemAt(doc.lists.all, line)
  if (!item) return null
  const text = doc.lines[line]
  let pad: string
  if (item.line === line) {
    const p = parsePrefix(text)
    if (!p || col < p.len) return null
    pad = p.indent + ' '.repeat(p.marker.length + Math.max(p.gap.length, 1))
  } else {
    pad = /^[ \t]*/.exec(text)![0]
  }
  return { edits: [{ line, from: col, to: col, insert: '\n' + pad }], cursor: { line: line + 1, col: pad.length } }
}

/** Ctrl+A: selection -> item content -> whole list -> null (Obsidian's select all). */
export function selectAll(doc: Doc, from: Pos, to: Pos): [Pos, Pos] | null {
  const item = itemAt(doc.lists.all, from.line)
  if (!item) return null
  const range = (a: ListItem, b: ListItem): [Pos, Pos] => [
    { line: a.line, col: prefixLen(doc, a.line) ?? 0 },
    { line: b.end, col: doc.lines[b.end].length },
  ]
  const covers = ([a, b]: [Pos, Pos]) => !before(a, from) && !before(to, b)
  const own = range(item, item)
  if (!covers(own)) return own

  let root = item
  while (root.parent) root = root.parent
  const roots = doc.lists.roots
  let i = roots.indexOf(root)
  let j = i
  while (i > 0 && roots[i - 1].end + 1 === roots[i].line) i--
  while (j < roots.length - 1 && roots[j].end + 1 === roots[j + 1].line) j++
  const list = range(roots[i], roots[j])
  return covers(list) ? null : list
}
