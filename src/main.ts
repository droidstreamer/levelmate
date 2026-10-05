import type { EditorView } from '@codemirror/view'
import { Notice, Platform, Plugin } from 'obsidian'
import { dragDrop } from './dragDrop'
import { registerEditing } from './editing'
import { indentLines } from './indentLines'
import { registerHeadings } from './headings'
import { registerLists } from './lists'
import { DEFAULT_SETTINGS, LevelMateSettings, LevelMateSettingTab } from './settings'

export default class LevelMatePlugin extends Plugin {
  settings: LevelMateSettings = { ...DEFAULT_SETTINGS }

  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) }
    this.addSettingTab(new LevelMateSettingTab(this.app, this))
    registerHeadings(this)
    registerLists(this)
    registerEditing(this)
    this.registerEditorExtension(indentLines(this))
    if (!Platform.isMobile) this.registerEditorExtension(dragDrop(this)) // desktop guard (D12)
    this.applySettings()
    this.app.workspace.onLayoutReady(() => this.warnAboutConflicts())
    this.register(() => document.body.classList.remove('tabwise-list-styles', 'tabwise-indent-lines', 'tabwise-dragging'))
  }

  /** Applies toggles that need more than a live read: list-style class and a redraw of open editors. */
  applySettings() {
    document.body.classList.toggle('tabwise-list-styles', this.settings.improvedListStyles)
    document.body.classList.toggle('tabwise-indent-lines', this.settings.indentLines)
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cm = (leaf.view as unknown as { editor?: { cm?: EditorView } }).editor?.cm
      cm?.dispatch({})
    })
  }

  /** One-time notice when Outliner or Heading Shifter is enabled: they claim the same keys. */
  warnAboutConflicts() {
    if (this.settings.conflictNoticeShown) return
    // app.plugins is not in the public typings
    const enabled = (this.app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins?.enabledPlugins
    const found = ['obsidian-outliner', 'obsidian-heading-shifter'].filter((id) => enabled?.has(id))
    if (!found.length) return
    new Notice('LevelMate: Outliner or Heading Shifter is also enabled. Turn off their Tab, Enter and Move features (or the plugins) to avoid key conflicts.', 15000)
    this.settings.conflictNoticeShown = true
    void this.saveSettings()
  }

  /** Debug mode: parser results and edits in the DevTools console. */
  log(...args: unknown[]) {
    if (this.settings.debug) console.debug('[LevelMate]', ...args)
  }

  saveSettings() {
    return this.saveData(this.settings)
  }
}
