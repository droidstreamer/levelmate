// Live checks for LevelMate in a real Obsidian, with real key and mouse events. `npm run build` first, then `npm run obsidian:check`.
import { call, check, cursor, done, ev, key, mouse, note, setOpt, shot, sleep, text, type } from './drive.mjs'

// Settings live in memory only; the vault's data.json stays untouched.
await ev(`const p = app.plugins.plugins.levelmate; p.saveData = async () => {}; return 1`)
const DEFAULTS = { enableTabOnHeadings: true, headingMode: 'heading', enhanceTab: true, enhanceEnter: true, stickCursor: true, enhanceSelectAll: true, improvedListStyles: true, indentLines: false, indentLineClick: 'fold', dragAndDrop: true, showLimitNotices: true }
const fresh = async (t, line = 0, col = 0) => { await setOpt(DEFAULTS); await note(t, line, col) }
const is = async (name, expected) => { const got = await text(); check(name, got === expected, got === expected ? '' : `got ${JSON.stringify(got)}`) }
await call('Page.bringToFront'); await call('Emulation.clearDeviceMetricsOverride')
const version = await ev(`return app.plugins.plugins.levelmate.manifest.version`)
console.log('LevelMate', version)

// --- Tab / Shift+Tab on lists
await fresh('- a\n  - a1\n- b\n- c', 0, -1)
await key('Tab')
await is('Tab on the first item does nothing (no previous sibling)', '- a\n  - a1\n- b\n- c')
await note('- a\n  - a1\n- b\n- c', 2, -1); await key('Tab')
await is('Tab indents an item under the previous one', '- a\n  - a1\n\t- b\n- c')
await key('Tab', ['shift'])
await is('Shift+Tab outdents it again', '- a\n  - a1\n- b\n- c')
await note('- a\n- b\n  - b1\n- c', 1, 0); await key('Tab')
await is('Tab from the start of the line moves the item with its children', '- a\n\t- b\n\t  - b1\n- c')
await key('z', ['ctrl'])
await is('Ctrl+Z undoes the Tab in one step', '- a\n- b\n  - b1\n- c')

// --- Tab on headings
await fresh('# H1\n## H2\n### H3\ntext', 1, -1); await key('Tab')
await is('Tab demotes a heading (heading only)', '# H1\n### H2\n### H3\ntext')
await key('Tab', ['shift'])
await is('Shift+Tab promotes it', '# H1\n## H2\n### H3\ntext')
await setOpt({ headingMode: 'children' }); await key('Tab')
await is('Tab in "Heading + children" mode shifts sub-headings too', '# H1\n### H2\n#### H3\ntext')
await fresh('# H1\n## H2', 0, -1); await key('Tab', ['shift'])
await is('Shift+Tab on H1 changes nothing', '# H1\n## H2')
await setOpt({ enableTabOnHeadings: false }); await note('# H1', 0, -1); await key('Tab')
check('Tab on headings off: LevelMate does not shift the heading', !(await text()).includes('## H1'), JSON.stringify(await text()))

// --- Enter, Shift+Enter, Backspace
await fresh('- a\n  - a1\n- b', 0, -1); await key('Enter')
await is('Enter on an item with children starts the first child', '- a\n  - \n  - a1\n- b')
await fresh('- a\n- b', 1, -1); await key('Enter'); await type('x')
await is('Enter at the end of an item adds a sibling', '- a\n- b\n- x')
await fresh('- a\n- ', 1, -1); await key('Enter')
await is('Enter on an empty item removes its bullet', '- a\n')
await fresh('1. a\n2. b', 1, -1); await key('Enter'); await type('c')
await is('Enter in a numbered list continues the numbering', '1. a\n2. b\n3. c')
await fresh('- a\n- b', 0, -1); await key('Enter', ['shift']); await type('x')
await is('Shift+Enter adds a line inside the item', '- a\n  x\n- b')
await fresh('- a\n- b', 1, 2); await key('Backspace')
await is('Backspace at the start of the text joins with the line above', '- ab')

// --- Stick cursor
await fresh('- abc', 0, 0)
check('caret set before the bullet jumps to the text start', (await cursor())[1] === 2 || (await key('ArrowRight'), (await cursor())[1]) >= 2, JSON.stringify(await cursor()))
await key('Home')
check('Home stops at the start of the text, not the bullet', (await cursor())[1] === 2, JSON.stringify(await cursor()))

// --- Ctrl+A steps
await fresh('intro\n\n- a\n  - a1\n- b\n\nouter', 2, 3)
const sel = () => ev(`return app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.getSelection()`)
await key('a', ['ctrl']); const s1 = await sel()
await key('a', ['ctrl']); const s2 = await sel()
await key('a', ['ctrl']); const s3 = await sel()
await key('a', ['ctrl']); const s4 = await sel()
check('Ctrl+A selects the item with its children, then the whole list, then the note (PRD F5; settings text claims four steps)', s1 === 'a\n  - a1' && s2 === 'a\n  - a1\n- b' && s3.startsWith('intro') && s4.startsWith('intro'), JSON.stringify([s1, s2, s3.length, s4.length]))

// --- Move and fold hotkeys: no defaults ship (review of 1.5.1); bind them here as a user would, then use real keystrokes
const defaults = await ev(`return ['move-up', 'move-down', 'fold', 'unfold'].map(c => app.commands.commands['levelmate:' + c]?.hotkeys?.length ?? 0)`)
check('Move and fold commands ship without default hotkeys', defaults.every(n => n === 0), JSON.stringify(defaults))
await ev(`const hm = app.hotkeyManager, k = (key, ...modifiers) => [{ modifiers, key }]
  hm.setHotkeys('levelmate:move-up', k('ArrowUp', 'Mod', 'Shift')); hm.setHotkeys('levelmate:move-down', k('ArrowDown', 'Mod', 'Shift'))
  hm.setHotkeys('levelmate:fold', k('ArrowUp', 'Mod')); hm.setHotkeys('levelmate:unfold', k('ArrowDown', 'Mod')); hm.bake(); return 1`)
await fresh('- a\n- b\n  - b1\n- c', 1, -1); await key('ArrowDown', ['ctrl', 'shift'])
await is('Ctrl+Shift+Down moves the item with its children', '- a\n- c\n- b\n  - b1')
await key('ArrowUp', ['ctrl', 'shift']); await key('ArrowUp', ['ctrl', 'shift'])
await is('Ctrl+Shift+Up moves it back and further up', '- b\n  - b1\n- a\n- c')
await fresh('# A\ntext\n# B\nmore', 0, -1); await key('ArrowDown', ['ctrl', 'shift'])
await is('Ctrl+Shift+Down on a heading moves the whole section', '# B\nmore\n# A\ntext')
await fresh('- a\n  - a1\n- b', 0, -1); await key('ArrowUp', ['ctrl'])
const folded = await ev(`const cm = app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.cm; return cm.dom.querySelectorAll('.cm-fold-indicator.is-collapsed, .is-collapsed').length + '|' + cm.contentDOM.innerText.includes('a1')`)
check('Ctrl+Up folds the item', /\|false$/.test(folded), folded)
await key('ArrowDown', ['ctrl'])
check('Ctrl+Down unfolds it', (await ev(`return app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.cm.contentDOM.innerText.includes('a1')`)) === true)

// --- Improved list styles and indentation lines
await fresh('- a\n  - a1\n    - a2\n- b')
check('improved list styles class is on the body', await ev(`return document.body.classList.contains('tabwise-list-styles')`))
await setOpt({ improvedListStyles: false })
check('turning it off removes the class', !(await ev(`return document.body.classList.contains('tabwise-list-styles')`)))
await setOpt({ indentLines: true }); await sleep(500)
const lines = () => ev(`return [...document.querySelectorAll('.workspace-leaf.mod-active .tabwise-indent-line')].map(l => { const r = l.getBoundingClientRect(); return { line: l.dataset.line, x: r.x, y: r.y, w: r.width, h: r.height } })`)
let gl = await lines()
check('indent lines drawn for items with children (2)', gl.length === 2 && gl.every(g => g.h > 0), JSON.stringify(gl))
await shot('tabwise-indent-lines')
if (gl[0]) {
  const cy = gl[0].y + gl[0].h - 6, cx = gl[0].x + gl[0].w / 2
  const hit = await ev(`return document.elementFromPoint(${cx}, ${cy}).className`)
  check('guide is the element under the pointer along its whole length (not covered by a fold chevron)', hit === 'tabwise-indent-line', hit)
  const up = await ev(`return document.elementFromPoint(${cx}, ${gl[0].y + 10}).className`)
  check('guide is not covered by the fold chevron of a nested item in its upper rows', up === 'tabwise-indent-line', up)
  await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy)
  await sleep(300)
  check('clicking a line folds that item', (await ev(`return app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.cm.contentDOM.innerText.includes('a2')`)) === false)
}
// Round 4: the file explorer keeps its own lines while LevelMate's are on, and a guide hangs from the marker of a wrapped item.
await ev(`for (const p of ['Fixtures/pa', 'Fixtures/pa/pb']) if (!app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p)
  if (!app.vault.getAbstractFileByPath('Fixtures/pa/pb/x.md')) await app.vault.create('Fixtures/pa/pb/x.md', 'x')
  app.workspace.getLeavesOfType('file-explorer')[0].view.revealInFolder(app.vault.getAbstractFileByPath('Fixtures/pa/pb/x.md')); await new Promise(r => setTimeout(r, 500)); return 1`)
const navW = () => ev(`const c = document.querySelector('.nav-files-container .tree-item-children'); return c ? getComputedStyle(c).borderInlineStartWidth : null`)
const navOn = await navW()
await setOpt({ indentLines: false }); await sleep(300)
const navOff = await navW()
check('the file explorer keeps its indentation lines whether LevelMate lines are on or off (round 4)', navOn !== null && navOn === navOff && parseFloat(navOn) > 0, `${navOn} ${navOff}`)
// Round 6: the explorer's lines are FolderMate's, LevelMate has no setting for them; "LevelMate indentation lines" swaps Obsidian's guides for its own.
const guideW = () => ev(`return getComputedStyle(document.querySelector('.workspace-leaf-content[data-type=markdown]')).getPropertyValue('--indentation-guide-width').trim()`)
await setOpt({ indentLines: true }); await sleep(300); const guideOn = await guideW()
await setOpt({ indentLines: false }); await sleep(300); const guideOff = await guideW()
check('LevelMate lines on hides Obsidian\'s guides in notes; off gives them back (round 6)', parseFloat(guideOn) === 0 && parseFloat(guideOff) > 0, `${guideOn} ${guideOff}`)
check('no "File explorer indentation lines" setting or class any more (round 6)', !(await ev(`return document.body.classList.contains('tabwise-no-explorer-lines')`)))
await setOpt({ indentLines: true }); await fresh('1. parent ' + 'long words '.repeat(60) + '\n   1. child\n- [ ] task\n  - [ ] sub'); await setOpt({ indentLines: true }); await sleep(600)
const anchor = await ev(`const l = document.querySelector('.workspace-leaf.mod-active .tabwise-indent-line'), cm = app.workspace.getLeavesOfType('markdown').find(x => x.view.file?.path === 'Fixtures/_check.md').view.editor.cm
  const gr = l.getBoundingClientRect(), first = cm.coordsAtPos(cm.state.doc.line(1).from + 3), last = cm.coordsAtPos(cm.state.doc.line(1).to), mk = document.querySelector('.workspace-leaf.mod-active .cm-formatting-list-ol')?.getBoundingClientRect()
  return { gy: gr.y, firstBottom: first.bottom, lastTop: last.top, gx: gr.x + gr.width / 2, mx: mk && mk.left + mk.width / 2 }`)
check('a guide starts under the first line\'s marker and runs beside the wrapped lines, centered on the number (round 4)', anchor.lastTop > anchor.firstBottom + 10 && Math.abs(anchor.gy - anchor.firstBottom) <= 3 && Math.abs(anchor.gx - anchor.mx) <= 3, JSON.stringify(anchor))
await shot('tabwise-indent-anchor')
await setOpt({ indentLines: false }); await sleep(300)
check('indent lines off removes them', (await lines()).length === 0)

// --- Drag and drop
await fresh('- a\n- b\n- c\n\n# H1\ntext\n# H2\nmore')
const geo = () => ev(`const cm = app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.cm, doc = cm.state.doc
  return doc.toString().split('\\n').map((t, i) => { const l = doc.line(i + 1), c = cm.coordsAtPos(l.from + (/^\\s*[-#]/.test(t) ? t.search(/\\S/) : 0)), e = cm.coordsAtPos(l.to); return { t, x: c?.left, y: c && (c.top + c.bottom) / 2, endX: e?.right, top: c?.top, bottom: c?.bottom } })`)
let g = await geo()
await mouse('mouseMoved', g[0].x + 20, g[0].y)
const handle = () => ev(`const h = document.querySelector('.workspace-leaf.mod-active .tabwise-drag-handle'); if (!h || h.hidden) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, left: r.right <= ${g[0].x} }`)
let h = await handle()
const clip = await ev(`const s = document.querySelector('.workspace-leaf.mod-active .cm-scroller').getBoundingClientRect(), h = document.querySelector('.workspace-leaf.mod-active .tabwise-drag-handle').getBoundingClientRect(); return [h.left - s.left, document.elementFromPoint(h.x + 8, h.y + 8)?.className]`)
check('grip sits inside the editor pane in a narrow (1024px) window, not clipped or under the sidebar', clip[0] >= 0, JSON.stringify(clip))
await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false }) // wide pane: the grip is visible and clickable
await fresh('- a\n- b\n- c\n\n# H1\ntext\n# H2\nmore'); g = await geo(); await mouse('mouseMoved', g[1].x + 20, g[1].y); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle()
check('hovering a list item shows the grip, left of the bullet', !!h && h.left, JSON.stringify(h))
if (h) {
  await mouse('mousePressed', h.x, h.y)
  await mouse('mouseMoved', h.x + 10, h.y + 10); await mouse('mouseMoved', g[2].x, g[2].y + 8)
  const st = await ev(`const q = s => document.querySelector('.workspace-leaf.mod-active ' + s); return { bar: q('.tabwise-drop-bar') && !q('.tabwise-drop-bar').hidden, ghost: q('.tabwise-drag-ghost') && !q('.tabwise-drag-ghost').hidden, body: document.body.classList.contains('tabwise-dragging') }`)
  check('mid-drag: drop bar, ghost and grabbing cursor class shown', st.bar && st.ghost && st.body, JSON.stringify(st))
  await shot('tabwise-drag')
  await key('Escape')
  check('Esc cancels the drag', !(await ev(`return document.body.classList.contains('tabwise-dragging')`)))
  await mouse('mouseReleased', g[2].x, g[2].y + 8)
  await is('a cancelled drag changes nothing', '- a\n- b\n- c\n\n# H1\ntext\n# H2\nmore')
  g = await geo(); await mouse('mouseMoved', g[0].x + 24, g[0].y); h = await handle()
  check('grip comes back after a cancelled drag when the pointer moves on the same line', !!h)
  if (!h) { await mouse('mouseMoved', g[1].x + 20, g[1].y); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle() }
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 10, h.y + 10); await mouse('mouseMoved', g[2].x, g[2].y + 8); await mouse('mouseReleased', g[2].x, g[2].y + 8)
  await is('dropping below the last item moves the item there', '- b\n- c\n- a\n\n# H1\ntext\n# H2\nmore')
  await key('z', ['ctrl'])
  await is('Ctrl+Z undoes the drop in one step', '- a\n- b\n- c\n\n# H1\ntext\n# H2\nmore')
}
g = await geo(); await mouse('mouseMoved', g[4].x + 20, g[4].y); h = await handle()
check('hovering a heading shows the grip', !!h, JSON.stringify(h))
if (h) {
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 10, h.y + 10); await mouse('mouseMoved', g[7].x + 30, g[7].y + 8); await mouse('mouseReleased', g[7].x + 30, g[7].y + 8)
  await is('dragging a heading moves its whole section', '- a\n- b\n- c\n\n# H2\nmore\n# H1\ntext')
}
// Round 6: a # section never lands inside another # section's ## children; a ## may move between # sections.
const gapY = (i) => (g[i - 1].bottom + g[i].top) / 2 // middle of the gap above line i
await fresh('# A\n## A1\n# B\n## B1\n# C'); g = await geo(); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle()
if (h) {
  const bar = () => ev(`const b = document.querySelector('.workspace-leaf.mod-active .tabwise-drop-bar'); return !!b && !b.hidden`)
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 10, h.y + 10); await mouse('mouseMoved', g[3].x + 30, gapY(3))
  check('a # heading shows no drop slot before another # section\'s ## (round 6)', !(await bar()))
  await mouse('mouseMoved', g[4].x + 30, gapY(4)); await mouse('mouseReleased', g[4].x + 30, gapY(4))
  await is('a # section drops between # sections and keeps its own ## children (round 6)', '# B\n## B1\n# A\n## A1\n# C')
}
await fresh('# A\n## A1\n# B\n## B1\n# C'); g = await geo(); await mouse('mouseMoved', g[3].x + 20, g[3].y); h = await handle()
if (h) {
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 10, h.y + 10); await mouse('mouseMoved', g[1].x + 30, gapY(1)); await mouse('mouseReleased', g[1].x + 30, gapY(1))
  await is('a ## moves out of its # into another # (round 6)', '# A\n## B1\n## A1\n# B\n# C')
}
// Round 4: the drop bar shows at the pointer, and the pointer's x picks the level.
await fresh('- one\n  - one a\n  - one b\n- two\n  - two a\n  - two b\n- three'); g = await geo()
await mouse('mouseMoved', g[1].x + 20, g[1].y); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle()
if (h) {
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 10, h.y + 10)
  const barY = () => ev(`const b = document.querySelector('.workspace-leaf.mod-active .tabwise-drop-bar'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  await mouse('mouseMoved', g[3].x + 30, g[3].y + 9) // just below "two" (lower half of its row)
  const bar1 = await barY()
  check('dragging just below an item that has sub-items puts the bar right there, not below its whole branch (round 4)', !!bar1 && Math.abs(bar1.y - (g[3].y + 12)) <= 14, JSON.stringify([bar1, g[3].y]))
  await mouse('mouseMoved', g[5].x + 200, g[5].y + 9) // below "two b", pointer far right: the deepest level
  const deep = await barY()
  await mouse('mouseMoved', g[5].x - 40, g[5].y + 9) // same gap, pointer left of everything: the top level
  const shallow = await barY()
  check('in one gap the pointer\'s x picks the level: right = nested, left = top level (round 4)', !!deep && !!shallow && deep.x > shallow.x + 8, JSON.stringify([deep, shallow]))
  await mouse('mouseMoved', g[5].x - 40, g[5].y + 9); await mouse('mouseReleased', g[5].x - 40, g[5].y + 9)
  await is('dropping at the left of that gap makes it a top-level item after the whole "two" branch', '- two\n  - two a\n  - two b\n- one\n  - one a\n  - one b\n- three')
}
// Round 5: grabbing lights nothing; faint bands mark every valid slot; a slot lights only when the pointer is near it.
await fresh('1. HEADER 1\n\t1. SUB 1\n\t2. SUB 2\n2. HEADER 2\n\t1. SUB 1\n3. HEADER 3'); g = await geo()
await mouse('mouseMoved', g[1].x + 20, g[1].y); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle()
if (h) {
  const bar = () => ev(`const b = document.querySelector('.workspace-leaf.mod-active .tabwise-drop-bar'); return !!b && !b.hidden`)
  const bands = () => ev(`return document.querySelectorAll('.workspace-leaf.mod-active .tabwise-drop-slot').length`)
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 2, h.y + 1)
  check('grabbing a list item and holding still lights no drop slot (round 5)', !(await bar()))
  const nb = await bands()
  check('on grab, faint bands mark the valid drop slots (round 5)', nb >= 3, String(nb))
  await shot('tabwise-drop-slots')
  await mouse('mouseMoved', g[3].x + 30, g[3].y) // middle of "HEADER 2": no slot is near
  check('pointer mid-line, away from any slot: still no drop bar (round 5)', !(await bar()))
  await mouse('mouseMoved', g[3].x + 30, (g[3].bottom + g[4].top) / 2) // on the gap below "HEADER 2"
  check('pointer on a slot: the drop bar lights there (round 5)', await bar())
  await key('Escape'); await mouse('mouseReleased', g[3].x, g[3].y)
  check('bands go when the drag ends', (await bands()) === 0)
}
await fresh('# H1\ntext\n# H2\nmore\n# H3\nend'); g = await geo(); await mouse('mouseMoved', g[0].x + 20, g[0].y); h = await handle()
if (h) {
  const bar = () => ev(`const b = document.querySelector('.workspace-leaf.mod-active .tabwise-drop-bar'); return !!b && !b.hidden`)
  await mouse('mousePressed', h.x, h.y); await mouse('mouseMoved', h.x + 2, h.y + 1)
  check('grabbing a heading and holding still does not jump to the next heading (round 5)', !(await bar()))
  await mouse('mouseMoved', g[2].x + 30, g[2].y)
  check('heading drag, pointer mid-line: no drop bar (round 5)', !(await bar()))
  await key('Escape'); await mouse('mouseReleased', g[2].x, g[2].y)
}
await call('Emulation.clearDeviceMetricsOverride')
await setOpt({ dragAndDrop: true }); await note('- a\n- b'); g = await geo(); await mouse('mouseMoved', g[1].x + 20, g[1].y); await mouse('mouseMoved', g[0].x + 20, g[0].y)
const shownBefore = await handle()
await setOpt({ dragAndDrop: false }); await sleep(200)
check('Drag-and-drop turned off while the grip shows: the grip goes at once and cannot be hit (round 4)', !!shownBefore && (await handle()) === null && await ev(`const l = document.querySelector('.workspace-leaf.mod-active .tabwise-drag-layer'); return getComputedStyle(l).display === 'none'`))
await note('- a\n- b'); g = await geo(); await mouse('mouseMoved', g[1].x + 20, g[1].y)
check('Drag-and-drop off: no grip', (await handle()) === null)

// --- Settings window
await setOpt(DEFAULTS)
await ev(`app.setting.open(); app.setting.openTabById('levelmate'); await new Promise(r => setTimeout(r, 500)); return 1`)
const ui = await ev(`const c = app.setting.activeTab.containerEl; return { name: c.querySelector('.tabwise-about-name')?.textContent, title: c.querySelector('.tabwise-about-title')?.textContent, toggles: c.querySelectorAll('.checkbox-container').length, dropdowns: c.querySelectorAll('select').length, descs: [...c.querySelectorAll('.setting-item:not(.setting-item-heading):not(.tabwise-about-row)')].filter(x => x.offsetParent).every(s => s.querySelector('.setting-item-description')?.textContent.length > 10), whatsNew: /What's new/.test(c.textContent), coffee: !!c.querySelector('.tabwise-coffee img') }`)
check('about block shows name, version and author', ui.name === 'LevelMate' && ui.title === `v${version} · by Droid`, JSON.stringify(ui))
const hdr = await ev(`const c = app.setting.activeTab.containerEl, tip = c.querySelector('.tabwise-about-tip'), f = c.querySelector('.tabwise-about-footer'), img = f?.querySelector('img')
  return { tip: tip?.textContent, tipLeft: !!tip && ['left','start'].includes(getComputedStyle(tip).textAlign), end: !!f && getComputedStyle(f).justifyContent === 'flex-end',
    order: f ? [...f.children].map(x => x.tagName + ':' + (x.textContent || '')).join('|') : '', imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
    below: !!tip && !!f && f.getBoundingClientRect().top >= tip.getBoundingClientRect().bottom, href: f?.querySelector('a')?.getAttribute('href') }`)
check('header matches MindmapMate: tip line, then "Made with care" beside the 30px coffee button, right-aligned', hdr.tip === 'If you enjoy this plugin, please consider a small tip, I would greatly appreciate it!' && hdr.tipLeft && hdr.end && hdr.order === 'SPAN:Made with care|A:' && hdr.imgH === 30 && hdr.below && hdr.href === 'https://buymeacoffee.com/droidstreamer', JSON.stringify(hdr))
check('every setting has a description', ui.descs)
check('10 toggles in the settings tab', ui.toggles === 10, String(ui.toggles))
check("no What's new in settings (plugin rule: docs/release-notes.md instead)", !ui.whatsNew)
const st2 = (await (await fetch('http://127.0.0.1:9335/json')).json()).find(t => t.type === 'page' && t.title.startsWith('Settings'))
if (st2) {
  const w = new WebSocket(st2.webSocketDebuggerUrl); await new Promise(r => w.onopen = r)
  const data = await new Promise(r => { w.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) r(m.result.data) }; w.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } })) })
  const { writeFileSync } = await import('node:fs'); const { SHOTS } = await import('./drive.mjs')
  writeFileSync(`${SHOTS}/tabwise-settings.png`, Buffer.from(data, 'base64')); console.log('shot', `${SHOTS}/tabwise-settings.png`); w.close()
}
await ev(`const c = app.setting.activeTab.containerEl; [...c.querySelectorAll('.setting-item')].find(s => /Enhance Tab key/.test(s.textContent)).querySelector('.checkbox-container').click(); await new Promise(r => setTimeout(r, 200)); return 1`)
check('clicking a toggle changes the live setting', (await ev(`return app.plugins.plugins.levelmate.settings.enhanceTab`)) === false)
await ev(`app.setting.close(); return 1`)

await ev(`for (const p of ['Fixtures/_check.md', 'Fixtures/pa']) { const f = app.vault.getAbstractFileByPath(p); f && await app.vault.delete(f, true) } return 1`)
done()
