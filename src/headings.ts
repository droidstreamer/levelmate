import { Prec, Text } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { Editor, Notice } from 'obsidian'
import { applyEdits } from './apply'
import { analyze } from './core/doc'
import { HeadingAction, runHeadingAction } from './core/headings'
import type LevelMatePlugin from './main'

const lastLine = (doc: Text, from: number, to: number) => {
  const l = doc.lineAt(to)
  return (from < to && to === l.from ? l.number - 1 : l.number) - 1 // to-line start is not selected
}

/** Runs a heading action on the editor as one transaction. Returns false when it does not apply. */
export function runOnView(plugin: LevelMatePlugin, view: EditorView, action: HeadingAction, dryRun = false): boolean {
  const { doc, selection } = view.state
  const sel = selection.main
  const res = runHeadingAction(
    analyze(doc.toString()),
    doc.lineAt(sel.from).number - 1,
    lastLine(doc, sel.from, sel.to),
    action,
  )
  if (!res) return false
  if (dryRun) return true
  plugin.log(action, res)
  if (res.edits.length) applyEdits(view, res.edits)
  if (res.notice && plugin.settings.showLimitNotices) new Notice(res.notice)
  return true
}

// Editor.cm is not in the public typings.
const cmOf = (editor: Editor) => (editor as unknown as { cm: EditorView }).cm

const COMMANDS: { id: string; name: string; action: HeadingAction }[] = [
  { id: 'demote-heading-children', name: 'Demote heading with children', action: { kind: 'shift', dir: 1, children: true } },
  { id: 'promote-heading-children', name: 'Promote heading with children', action: { kind: 'shift', dir: -1, children: true } },
  { id: 'demote-heading-only', name: 'Demote heading only', action: { kind: 'shift', dir: 1, children: false } },
  { id: 'promote-heading-only', name: 'Promote heading only', action: { kind: 'shift', dir: -1, children: false } },
  { id: 'demote-list-heading', name: 'Demote list-item heading', action: { kind: 'shiftListHeading', dir: 1 } },
  { id: 'promote-list-heading', name: 'Promote list-item heading', action: { kind: 'shiftListHeading', dir: -1 } },
  { id: 'remove-heading', name: 'Remove heading', action: { kind: 'remove' } },
]

export function registerHeadings(plugin: LevelMatePlugin) {
  for (const c of COMMANDS) {
    plugin.addCommand({
      id: c.id,
      name: c.name,
      editorCheckCallback: (checking, editor) => runOnView(plugin, cmOf(editor), c.action, checking),
    })
  }

  const tab = (dir: 1 | -1) => (view: EditorView) =>
    plugin.settings.enableTabOnHeadings &&
    runOnView(plugin, view, { kind: 'shift', dir, children: plugin.settings.headingMode === 'children' })
  plugin.registerEditorExtension(
    Prec.high(keymap.of([{ key: 'Tab', run: tab(1) }, { key: 'Shift-Tab', run: tab(-1) }])),
  )
}
