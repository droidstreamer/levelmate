import { EditorSelection, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { applyEdits } from './apply'
import { analyze } from './core/doc'
import { EditResult, enter, parsePrefix, prefixLen, selectAll, shiftEnter } from './core/editing'
import type LevelMatePlugin from './main'

type Doc = ReturnType<typeof analyze>

/** Enter / Shift+Enter: runs a core edit at the cursor. False falls through to Obsidian. */
function runEdit(view: EditorView, fn: (d: Doc, line: number, col: number) => EditResult | null): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const l = state.doc.lineAt(sel.head)
  const res = fn(analyze(state.doc.toString()), l.number - 1, sel.head - l.from)
  if (!res) return false
  applyEdits(view, res.edits, res.cursor)
  return true
}

/** Backspace / Delete across a bullet: joins the lines and drops the marker. */
function join(view: EditorView, forward: boolean): boolean {
  const { state } = view
  const sel = state.selection.main
  const l = state.doc.lineAt(sel.head)
  const n = forward ? l.number + 1 : l.number // the line whose marker goes
  if (!sel.empty || n < 2 || n > state.doc.lines || (forward && sel.head !== l.to)) return false
  const len = prefixLen(analyze(state.doc.toString()), n - 1)
  const marked = state.doc.line(n)
  if (len === null || (!forward && sel.head !== marked.from + len)) return false
  const from = state.doc.line(n - 1).to
  view.dispatch({
    changes: { from, to: marked.from + len },
    selection: { anchor: from },
    userEvent: forward ? 'delete.forward' : 'delete.backward',
  })
  return true
}

function selectAllList(view: EditorView): boolean {
  const { state } = view
  const pos = (o: number) => {
    const l = state.doc.lineAt(o)
    return { line: l.number - 1, col: o - l.from }
  }
  const { from, to } = state.selection.main
  const res = selectAll(analyze(state.doc.toString()), pos(from), pos(to))
  if (!res) return false
  const abs = (p: { line: number; col: number }) => state.doc.line(p.line + 1).from + p.col
  view.dispatch({ selection: { anchor: abs(res[0]), head: abs(res[1]) }, userEvent: 'select' })
  return true
}

export function registerEditing(plugin: LevelMatePlugin) {
  const on = (key: 'enhanceEnter' | 'stickCursor' | 'enhanceSelectAll', run: (v: EditorView) => boolean) =>
    (v: EditorView) => plugin.settings[key] && run(v)

  plugin.registerEditorExtension([
    Prec.high(
      keymap.of([
        { key: 'Enter', run: on('enhanceEnter', (v) => runEdit(v, enter)) },
        { key: 'Shift-Enter', run: on('enhanceEnter', (v) => runEdit(v, shiftEnter)) },
        { key: 'Backspace', run: on('stickCursor', (v) => join(v, false)) },
        { key: 'Delete', run: on('stickCursor', (v) => join(v, true)) },
        { key: 'Mod-a', run: on('enhanceSelectAll', selectAllList) },
      ]),
    ),
    // Keeps the caret and selection ends out of the bullet marker.
    EditorState.transactionFilter.of((tr) => {
      if (!plugin.settings.stickCursor || !tr.selection || tr.docChanged) return tr
      let doc: Doc | undefined // ponytail: whole-note parse, only when a caret lands in a marker; limit to the list block if slow
      const fix = (pos: number, prevHead?: number) => {
        const l = tr.newDoc.lineAt(pos)
        const p = parsePrefix(l.text)
        if (!p || pos - l.from >= p.len) return pos
        doc ??= analyze(tr.newDoc.toString())
        const len = prefixLen(doc, l.number - 1)
        if (len === null || pos - l.from >= len) return pos
        const start = l.from + len
        // one step left from the content start crosses to the previous line instead of sticking
        return prevHead === start && pos === start - 1 && l.number > 1 && !tr.isUserEvent('select.pointer')
          ? tr.newDoc.line(l.number - 1).to
          : start
      }
      const ranges = tr.selection.ranges.map((r, i) =>
        EditorSelection.range(fix(r.anchor), fix(r.head, tr.startState.selection.ranges[i]?.head)),
      )
      return [tr, { selection: EditorSelection.create(ranges, tr.selection.mainIndex) }]
    }),
  ])
}
