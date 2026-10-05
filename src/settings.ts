import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian'
import { COFFEE_BUTTON, COFFEE_URL } from './coffeeButton'
import type LevelMatePlugin from './main'

export interface LevelMateSettings {
  enableTabOnHeadings: boolean
  headingMode: 'heading' | 'children'
  showLimitNotices: boolean
  enhanceTab: boolean
  enhanceEnter: boolean
  stickCursor: boolean
  enhanceSelectAll: boolean
  improvedListStyles: boolean
  indentLines: boolean
  indentLineClick: 'fold' | 'none'
  dragAndDrop: boolean
  debug: boolean
  conflictNoticeShown: boolean
}

export const DEFAULT_SETTINGS: LevelMateSettings = {
  enableTabOnHeadings: true,
  headingMode: 'heading',
  showLimitNotices: true,
  enhanceTab: true,
  enhanceEnter: true,
  stickCursor: true,
  enhanceSelectAll: true,
  improvedListStyles: true,
  indentLines: false,
  indentLineClick: 'fold',
  dragAndDrop: true,
  debug: false,
  conflictNoticeShown: false,
}

type Key = Exclude<keyof LevelMateSettings, 'conflictNoticeShown'>

// Declarative settings (Obsidian 1.13+), so every row shows up in Obsidian's settings search.
export class LevelMateSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LevelMatePlugin) {
    super(app, plugin)
  }

  setControlValue(key: string, value: unknown) {
    ;(this.plugin.settings as unknown as Record<string, unknown>)[key] = value
    void this.plugin.saveSettings()
    this.plugin.applySettings()
  }

  getSettingDefinitions(): SettingDefinitionItem<Key>[] {
    return [
      { name: 'LevelMate', searchable: false, render: row => this.header(row) },
      { type: 'group', heading: 'Headings', items: [
        { name: 'Tab on heading shifts', desc: '"Heading only" changes just the line the cursor is on. "Heading + children" also shifts every sub-heading below it, so the outline keeps its shape.',
          control: { type: 'dropdown', key: 'headingMode', options: { heading: 'Heading only', children: 'Heading + children' } } },
        { name: 'Enable Tab on headings', desc: 'Tab demotes and Shift+Tab promotes a heading (adds or removes a #). Off: Tab does what Obsidian normally does on a heading line.', control: { type: 'toggle', key: 'enableTabOnHeadings' } },
        { name: 'Show limit notices', desc: 'Show a short message when a heading or list item cannot move any further, for example a heading already at H1 or H6.', control: { type: 'toggle', key: 'showLimitNotices' } },
      ] },
      { type: 'group', heading: 'Lists', items: [
        { name: 'Enhance Tab key', desc: 'Tab indents the list item together with all its sub-items, and Shift+Tab outdents it, from anywhere on the line. Off: Obsidian\'s own Tab.', control: { type: 'toggle', key: 'enhanceTab' } },
        { name: 'Enhance Enter key', desc: 'Enter in a list starts a new item at the same level, or as the first child if the item has sub-items. Enter on an empty item removes its bullet. Shift+Enter adds a line inside the item.', control: { type: 'toggle', key: 'enhanceEnter' } },
        { name: 'Stick cursor to content', desc: 'The cursor never lands on the bullet or number: clicking, arrow keys and Home stop at the start of the text. Backspace there joins the line with the one above and drops the bullet.', control: { type: 'toggle', key: 'stickCursor' } },
        { name: 'Enhance Ctrl+A', desc: 'Ctrl+A (Cmd+A) selects step by step: first the text of the item, then the item with its sub-items, then the whole list, then the note.', control: { type: 'toggle', key: 'enhanceSelectAll' } },
      ] },
      { type: 'group', heading: 'Appearance', items: [
        { name: 'Improved list styles', desc: 'Tighter spacing, smaller bullets and a clearer indent for lists, using your theme\'s own colors.', control: { type: 'toggle', key: 'improvedListStyles' } },
        { name: 'LevelMate indentation lines', desc: 'Draw LevelMate\'s own line beside each item\'s sub-items, in place of Obsidian\'s. Off brings Obsidian\'s lines back; to remove all lines, also turn off Settings > Editor > Show indentation guides.', control: { type: 'toggle', key: 'indentLines' } },
        { name: 'Indentation line click action', desc: 'What clicking one of the vertical lines does: fold the item (hide its sub-items) or nothing.',
          control: { type: 'dropdown', key: 'indentLineClick', options: { fold: 'Toggle folding', none: 'None' } } },
      ] },
      { type: 'group', heading: 'Interaction', items: [
        { name: 'Drag-and-drop', desc: 'Show a grip left of list items and headings. Drag it to move the item with its sub-items, or the heading with its whole section. Esc cancels.', control: { type: 'toggle', key: 'dragAndDrop' } },
      ] },
      { type: 'group', heading: 'Advanced', items: [
        { name: 'Debug mode', desc: 'Writes what LevelMate is doing (each action and the edits it makes) to the developer console, for troubleshooting. Open it with Ctrl+Shift+I (Cmd+Option+I), Console tab, filter "LevelMate".', control: { type: 'toggle', key: 'debug' } },
      ] },
      { type: 'group', heading: 'Hotkeys', items: [
        { name: 'Default bindings', desc: 'Move up/down: Ctrl+Shift+Up/Down. Fold/unfold: Ctrl+Up/Down. Change them in Settings > Hotkeys.',
          render: row => { row.addButton(b => b.setButtonText('Open hotkeys').onClick(() => {
            // setting API is not in the public typings
            const setting = (this.app as unknown as { setting: { openTabById(id: string): { setQuery(q: string): void } } }).setting
            setting.openTabById('hotkeys').setQuery('LevelMate')
          })) } },
      ] },
    ]
  }

  // About block, same layout as MindmapMate and FolderMate: name, version and author, what it does, tip line, coffee button.
  private header(row: Setting) {
    const el = row.settingEl
    el.empty()
    el.addClass('tabwise-about-row')
    const { version, author } = this.plugin.manifest
    const about = el.createDiv({ cls: 'tabwise-about' })
    about.createDiv({ cls: 'tabwise-about-name', text: 'LevelMate' })
    about.createDiv({ cls: 'tabwise-about-title', text: `v${version} · by ${author}` })
    about.createEl('p', {
      text: 'Tab and Shift+Tab that work on whatever the cursor is on: they indent and outdent list items, and promote and demote headings. It also brings Outliner-style list editing (Enter, moving and folding items, drag-and-drop) and lets you move whole heading sections.',
    })
    about.createDiv({ cls: 'tabwise-about-tip', text: 'If you enjoy this plugin, please consider a small tip, I would greatly appreciate it!' })
    const footer = about.createDiv({ cls: 'tabwise-about-footer' })
    footer.createSpan({ text: 'Made with care' })
    const coffee = footer.createEl('a', { cls: 'tabwise-coffee', href: COFFEE_URL, attr: { target: '_blank', rel: 'noopener', 'aria-label': 'Buy me a coffee' } })
    coffee.createEl('img', { attr: { src: COFFEE_BUTTON, alt: 'Buy me a coffee' } })
  }
}
