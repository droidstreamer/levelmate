import { EditorSelection, Prec } from '@codemirror/state'
import { foldedRanges, foldEffect, indentUnit, unfoldEffect } from '@codemirror/language'
import { EditorView, keymap } from '@codemirror/view'
import { Editor, Notice } from 'obsidian'
import { applyEdits } from './apply'
import { analyze } from './core/doc'
import { foldTarget } from './core/fold'
import { ListAction, runListAction } from './core/lists'
import { moveSection } from './core/sections'
import type LevelMatePlugin from './main'

const cmOf = (editor: Editor) => (editor as unknown as { cm: EditorView }).cm

/** Runs a list action as one transaction. Returns false when it does not apply. */
function runList(plugin: LevelMatePlugin, view: EditorView, action: ListAction, dryRun = false): boolean {
  const { state } = view
  const sel = state.selection.main
  const first = state.doc.lineAt(sel.from)
  let last = state.doc.lineAt(sel.to)
  if (!sel.empty && sel.to === last.from && last.number > first.number) last = state.doc.line(last.number - 1) // to-line start is not selected
  const doc = analyze(state.doc.toString())
  const moving = action === 'moveUp' || action === 'moveDown'
  let res
  if (doc.kinds[first.number - 1] === 'HEADING') {
    if (!moving) return false
    const s = doc.sections.all.find((x) => x.line === first.number - 1)!
    if (last.number - 1 > s.end) return false // selection leaves the section
    res = moveSection(doc, first.number - 1, action === 'moveUp' ? -1 : 1)
  } else {
    res = runListAction(doc, first.number - 1, action, state.facet(indentUnit), last.number - 1)
  }
  if (!res) return false
  if (dryRun) return true
  plugin.log(action, res)
  if (res.block) {
    const { from, to, lines } = res.block
    const changes = { from: state.doc.line(from + 1).from, to: state.doc.line(to + 1).to, insert: lines.join(state.lineBreak) }
    const next = state.update({ changes }).state.doc
    const move = (pos: number) => {
      const l = state.doc.lineAt(pos)
      if (l.number - 1 < from || l.number - 1 > to) return pos
      const target = next.line(l.number + res.lineDelta!)
      return target.from + Math.min(pos - l.from, target.length)
    }
    view.dispatch({
      changes,
      selection: EditorSelection.single(move(sel.anchor), move(sel.head)),
      userEvent: 'move.line',
    })
  } else if (res.edits.length) {
    applyEdits(view, res.edits)
  }
  if (res.notice && plugin.settings.showLimitNotices) new Notice(res.notice)
  return true
}

/** Folds or unfolds the item or heading section at 0-based `line`. False when not applicable. */
export function setFold(view: EditorView, line: number, fold: boolean, dryRun = false): boolean {
  const { state } = view
  const t = foldTarget(analyze(state.doc.toString()), line)
  if (!t) return false
  const from = state.doc.line(t.line + 1).to
  const to = state.doc.line(t.end + 1).to
  let folded: { from: number; to: number } | null = null
  foldedRanges(state).between(from, to, (f, e) => {
    if (f === from) folded = { from: f, to: e }
  })
  if (fold === !!folded) return false
  if (!dryRun) view.dispatch({ effects: fold ? foldEffect.of({ from, to }) : unfoldEffect.of(folded!) })
  return true
}

const runFold = (view: EditorView, fold: boolean, dryRun = false) =>
  setFold(view, view.state.doc.lineAt(view.state.selection.main.head).number - 1, fold, dryRun)

export function registerLists(plugin: LevelMatePlugin) {
  const cmd = (
    id: string,
    name: string,
    run: (v: EditorView, dry: boolean) => boolean,
  ) =>
    // No default hotkeys (Obsidian guideline, review of 1.5.1): users bind these in Settings > Hotkeys.
    plugin.addCommand({
      id,
      name,
      editorCheckCallback: (checking, editor) => run(cmOf(editor), checking),
    })
  cmd('move-up', 'Move up', (v, d) => runList(plugin, v, 'moveUp', d))
  cmd('move-down', 'Move down', (v, d) => runList(plugin, v, 'moveDown', d))
  cmd('fold', 'Fold', (v, d) => runFold(v, true, d))
  cmd('unfold', 'Unfold', (v, d) => runFold(v, false, d))

  const tab = (action: ListAction) => (view: EditorView) => plugin.settings.enhanceTab && runList(plugin, view, action)
  plugin.registerEditorExtension(
    Prec.high(keymap.of([{ key: 'Tab', run: tab('indent') }, { key: 'Shift-Tab', run: tab('outdent') }])),
  )
}
