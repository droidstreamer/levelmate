import type { EditorView } from '@codemirror/view'
import type { LineEdit } from './core/headings'

/** Dispatches line-column edits as one transaction (one undo step); `cursor` is a line/col in the new doc. */
export function applyEdits(view: EditorView, edits: LineEdit[], cursor?: { line: number; col: number }) {
  const { state } = view
  const changes = edits.map((e) => {
    const start = state.doc.line(e.line + 1).from
    return { from: start + e.from, to: start + e.to, insert: e.insert.replace(/\n/g, state.lineBreak) }
  })
  const next = cursor && state.update({ changes }).state.doc
  view.dispatch({
    changes,
    selection: cursor && next ? { anchor: next.line(cursor.line + 1).from + cursor.col } : undefined,
    userEvent: 'input',
  })
}
