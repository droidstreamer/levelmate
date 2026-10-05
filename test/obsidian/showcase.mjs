// Store screenshots and README animation, taken in a real Obsidian on "../showcase-vault/My Vault". `npm run build`, copy dist/
// into that vault's .obsidian/plugins/levelmate/, then `npm run showcase`. Output: ../showcase/ (1200x800 PNGs, demo.gif via make-gif.py).
process.env.VAULT ??= '../showcase-vault/My Vault'; process.env.PORT ??= '9336'
const OUT = process.env.SHOTS ??= '../showcase'
const { PORT, call, ev, sleep, key, mouse } = await import('./drive.mjs')
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
mkdirSync(`${OUT}/raw`, { recursive: true })

const W = 1280, H = 800
const size = (w, h, dsf) => call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: false })
// Raw capture (2x) of a CSS-px region of the main window, kept as a data URL for the composer.
const grab = async (name, clip = { x: 0, y: 0, width: W, height: H }) => {
  const r = await call('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })
  writeFileSync(`${OUT}/raw/${name}.png`, Buffer.from(r.data, 'base64'))
  return `data:image/png;base64,${r.data}`
}

const NOTE = 'Projects/Book Draft/Outline.md'
const TEXT = readFileSync(`${process.env.VAULT}/${NOTE}`, 'utf8')
const P = `app.plugins.plugins['levelmate']`
const ED = `app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === ${JSON.stringify(NOTE)}).view.editor`
// Fresh note, settings and layout for each shot: Book Draft open in the explorer, right sidebar closed, caret at the end of `at`.
const scene = (cfg = {}, { theme = 'obsidian', source = false, at = 'A short novel' } = {}) => ev(`const p = ${P}; p.saveData = async () => {}
  Object.assign(p.settings, { headingMode: 'children', indentLines: true, improvedListStyles: true, dragAndDrop: true }, ${JSON.stringify(cfg)}); p.applySettings()
  app.changeTheme(${JSON.stringify(theme)}); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  app.workspace.leftSplit.expand(); app.workspace.rightSplit.collapse()
  const fe = app.workspace.getLeavesOfType('file-explorer')[0].view
  for (const it of Object.values(fe.fileItems)) if (it.setCollapsed && !it.collapsed) await it.setCollapsed(true)
  for (const f of ['Projects', 'Projects/Book Draft']) { const it = fe.fileItems[f]; if (it?.collapsed) await it.setCollapsed(false) }
  const file = app.vault.getAbstractFileByPath(${JSON.stringify(NOTE)}); await app.vault.modify(file, ${JSON.stringify(TEXT)})
  let leaf = app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === file.path); if (!leaf) { leaf = app.workspace.getLeaf(); await leaf.openFile(file) }
  app.workspace.setActiveLeaf(leaf, { focus: true })
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: ${source} } })
  await new Promise(r => setTimeout(r, 400)); const ed = ${ED}
  const ln = ed.getValue().split('\\n').findIndex(t => t.includes(${JSON.stringify(at)})); ed.setCursor({ line: ln, ch: ed.getLine(ln).length }); ed.focus()
  ed.cm.scrollDOM.scrollTop = 0; await new Promise(r => setTimeout(r, 500)); return 1`)
const caret = at => ev(`const ed = ${ED}; const ln = ed.getValue().split('\\n').findIndex(t => t.includes(${JSON.stringify(at)})); ed.setCursor({ line: ln, ch: ed.getLine(ln).length }); ed.focus(); await new Promise(r => setTimeout(r, 300)); return 1`)
// Screen rect of the editor line holding `t` (bullet included), and of the text column it sits in.
const line = t => ev(`const cm = ${ED}.cm, doc = cm.state.doc; for (let i = 1; i <= doc.lines; i++) { const l = doc.line(i); if (!l.text.includes(${JSON.stringify(t)})) continue
  const s = l.text.search(/\\S/), a = cm.coordsAtPos(l.from + Math.max(s, 0)), b = cm.coordsAtPos(l.to); return { x: a.left, y: (a.top + a.bottom) / 2, top: a.top, bottom: a.bottom, right: b.right } } return null`)
const column = () => ev(`const r = document.querySelector('.workspace-leaf.mod-active .cm-sizer').getBoundingClientRect(); return { x: r.x, width: r.width }`)
// A crop of the note from the line holding `from` to the line holding `to`, as wide as its longest line (pad: room for the grip).
const noteClip = (from, to, pad = 0) => ev(`const cm = ${ED}.cm, doc = cm.state.doc, col = document.querySelector('.workspace-leaf.mod-active .cm-sizer').getBoundingClientRect()
  let a = null, b = null, right = 0
  for (let i = 1; i <= doc.lines; i++) { const l = doc.line(i); if (!a && l.text.includes(${JSON.stringify(from)})) a = cm.coordsAtPos(l.from)
    if (a && !b) right = Math.max(right, cm.coordsAtPos(l.to)?.right ?? 0); if (a && !b && l.text.includes(${JSON.stringify(to)})) b = cm.coordsAtPos(l.to) }
  const x = col.x + 4 - ${pad}; return { x, y: a.top - 22, width: right + 28 - x, height: b.bottom - a.top + 40 }`)
// Moves the pointer onto plain text, then off the window, so no grip shows.
const away = async () => { const o = await line('A short novel'); await mouse('mouseMoved', o.x + 20, o.y); await mouse('mouseMoved', 1270, 790); await sleep(200) }

// Composer: a full-window overlay at exactly 1200x800, one per store image.
const ACCENT = { blue: ['#1e3a8a', '#3B82F6'], green: ['#14532d', '#16A34A'], orange: ['#7c2d12', '#F97316'], pink: ['#831843', '#DB2777'], violet: ['#4c1d95', '#8B5CF6'] }
const compose = async (name, accent, title, sub, body) => {
  const [deep, bright] = ACCENT[accent]
  await size(1200, 800, 1); await sleep(300)
  await ev(`const o = document.body.createDiv({ cls: 'lm-showcase' }); o.setAttr('style', ${JSON.stringify(`position:fixed;inset:0;z-index:99999;overflow:hidden;font-family:var(--font-interface);color:#fff;
    background:radial-gradient(1100px 700px at 85% 110%, ${bright}55, transparent 60%),radial-gradient(900px 600px at 0% 0%, ${deep}, transparent 70%),#0f1115;`)})
    o.innerHTML = ${JSON.stringify(`
      <div style="position:absolute;left:56px;top:40px;display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;letter-spacing:.02em;opacity:.85">
        ${['#3B82F6', '#16A34A', '#F97316', '#DB2777', '#8B5CF6'].map(c => `<span style="width:10px;height:10px;border-radius:3px;background:${c}"></span>`).join('')}
        <span style="margin-left:4px">LevelMate</span></div>
      <div style="position:absolute;left:56px;top:84px;right:56px;font-size:40px;font-weight:700;line-height:1.15;letter-spacing:-.01em">${title}</div>
      <div style="position:absolute;left:56px;top:${title.includes('<br>') ? 186 : 138}px;right:56px;font-size:19px;line-height:1.45;color:#c9cdd6">${sub}</div>
      ${body}`)}; await new Promise(r => setTimeout(r, 400)); return 1`)
  const r = await call('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('frame', `${OUT}/${name}.png`)
  await ev(`document.querySelector('.lm-showcase')?.remove(); return 1`)
  await size(W, H, 2); await sleep(300)
}
const card = (src, css) => `<img src="${src}" style="position:absolute;border-radius:12px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);${css}">`
const pill = (text, color, css) => `<div style="position:absolute;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:600;background:${color};box-shadow:0 8px 24px rgba(0,0,0,.4);${css}">${text}</div>`
const label = (text, css) => `<div style="position:absolute;font-size:16px;font-weight:600;color:#e5e7eb;text-align:center;${css}">${text}</div>`
const arrow = (color, css) => `<svg style="position:absolute;${css}" width="70" height="40"><path d="M6 20 H 60" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M48 9 L61 20 L48 31" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
// Shows the drag grip beside the line holding `t` (the pointer has to arrive from another line).
const hover = async t => { const o = await line('A short novel'), l = await line(t); await mouse('mouseMoved', o.x + 20, o.y); await mouse('mouseMoved', l.x + 30, l.y); await sleep(200)
  return ev(`const h = document.querySelector('.workspace-leaf.mod-active .tabwise-drag-handle'); if (!h || h.hidden) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`) }

await size(W, H, 2)

// 1. Hero: the whole app, indentation lines on, the grip showing beside an item.
await scene()
await hover('She reads the letter at last')
const hero = await grab('hero')
await compose('1-hero', 'blue', 'One key for every level.',
  'Tab and Shift+Tab indent list items and shift headings, whatever line you are on.',
  card(hero, 'left:56px;top:200px;width:1088px'))

// 2. Tab on a list item: before and after, its sub-item comes along.
await scene({ dragAndDrop: false }, { at: 'She reads the letter at last' })
const c2 = await noteClip('Act two', 'Who really sent', 30); c2.width += 40 // room for the line that Tab pushes right
const before2 = await grab('tab-before', c2)
await key('Tab')
const after2 = await grab('tab-after', c2)
const w2 = 480, h2 = Math.round(c2.height * w2 / c2.width)
await compose('2-tab', 'orange', 'Tab. Shift+Tab. Done.',
  'Put the cursor anywhere on a list item and press Tab. Its sub-items move with it, in one undo step.',
  label('Before', `left:56px;width:${w2}px;top:228px`) + label('After Tab', `right:56px;width:${w2}px;top:228px`) +
  card(before2, `left:56px;top:262px;width:${w2}px`) + card(after2, `right:56px;top:262px;width:${w2}px`) +
  arrow('#F97316', `left:565px;top:${262 + Math.round(h2 / 2) - 20}px`) +
  pill('Sub-items come along', '#F97316', `right:56px;top:${262 + h2 + 24}px`))

// 3. Headings shift too, with their sub-headings (source view, so the # marks show); labels level with their rows.
await scene({ dragAndDrop: false }, { source: true, at: '## Act two' })
const c3 = await noteClip('## Act two', 'Who really sent', 20)
const before3 = await grab('heading-before', c3)
await key('Tab')
const after3 = await grab('heading-after', c3)
const w3 = 430, k3 = w3 / c3.width, top3 = 262
const rowY = async t => { const r = await line(t); return Math.round(top3 + (r.y - c3.y) * k3 - 16) }
await compose('3-headings', 'pink', 'Headings shift too.',
  'Tab demotes a heading and Shift+Tab promotes it. Choose the heading alone, or the heading with its sub-headings.',
  label('Before', `left:56px;width:${w3}px;top:228px`) + label('After Tab', `left:${56 + w3 + 90}px;width:${w3}px;top:228px`) +
  card(before3, `left:56px;top:${top3}px;width:${w3}px`) + card(after3, `left:${56 + w3 + 90}px;top:${top3}px;width:${w3}px`) +
  arrow('#DB2777', `left:${56 + w3 + 10}px;top:${await rowY('# Act two') - 4}px`) +
  pill('## → ###', '#DB2777', `right:56px;top:${await rowY('# Act two')}px`) +
  pill('Sub-heading follows', '#334155', `right:56px;top:${await rowY('# Open questions')}px`))

// 4. Drag and drop: mid-drag (grip, ghost, drop bar) and the result.
await scene(); await away()
const c4 = await noteClip('Act one', 'It names a keeper', 70)
let g = await hover('She decides to stay the winter')
const target = await line('Mira rations the lamp oil')
await mouse('mousePressed', g.x, g.y); await mouse('mouseMoved', g.x + 10, g.y + 10)
await mouse('mouseMoved', target.x - 20, target.bottom + 6); await sleep(300)
const mid4 = await grab('drag-mid', c4)
await mouse('mouseReleased', target.x - 20, target.bottom + 6); await sleep(400)
await caret('A short novel'); await ev(`const p = ${P}; p.settings.dragAndDrop = false; p.applySettings(); return 1`); await sleep(200)
const after4 = await grab('drag-after', c4)
const w4 = 500
await compose('4-drag', 'green', 'Drag a whole branch.',
  'Grab the grip beside any list item or heading. The bar shows where it lands, and at which level.',
  label('Dragging', `left:56px;width:${w4}px;top:228px`) + label('Dropped', `right:56px;width:${w4}px;top:228px`) +
  card(mid4, `left:56px;top:262px;width:${w4}px`) + card(after4, `right:56px;top:262px;width:${w4}px`))

// 5. Settings: the Settings window is its own page target.
await scene()
await ev(`app.setting.open(); app.setting.openTabById('levelmate'); await new Promise(r => setTimeout(r, 800)); return 1`)
const st = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page' && t.title.startsWith('Settings'))
const sws = new WebSocket(st.webSocketDebuggerUrl); await new Promise(r => sws.onopen = r)
let sid = 0
const scall = (method, params = {}) => new Promise((res, rej) => { const id = ++sid
  sws.addEventListener('message', function h(e) { const x = JSON.parse(e.data); if (x.id !== id) return; sws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result) })
  sws.send(JSON.stringify({ id, method, params })) })
await scall('Emulation.setDeviceMetricsOverride', { width: 760, height: 2600, deviceScaleFactor: 2, mobile: false }); await sleep(800)
// Just the LevelMate pane (no Obsidian sidebar), as four cards: About, Headings | Lists, Appearance.
const sv = async src => { const r = await scall('Runtime.evaluate', { expression: `(() => { ${src} })()`, returnByValue: true }); return r.result.value }
const box = await sv(`const c = document.querySelector('.vertical-tab-content'), r = c.getBoundingClientRect()
  const row = t => [...c.querySelectorAll('.setting-item')].find(s => s.querySelector('.setting-item-name')?.textContent === t).getBoundingClientRect()
  const head = t => [...c.querySelectorAll('*')].find(e => !e.children.length && e.textContent === t).getBoundingClientRect()
  const about = c.querySelector('.tabwise-about').getBoundingClientRect()
  return { x: r.x + 24, w: r.width - 48, about: [about.top - 18, about.bottom + 4], aboutX: [about.left - 22, about.width + 44], headings: [head('Headings').top - 16, row('Enable Tab on headings').bottom + 14],
    lists: [head('Lists').top - 16, row('Enhance Enter key').bottom + 14], look: [head('Appearance').top - 16, row('LevelMate indentation lines').bottom + 14] }`)
const sgrab = async (name, [y0, y1], [x, width] = [box.x - 12, box.w + 24]) => { const r = await scall('Page.captureScreenshot', { format: 'png', clip: { x, y: y0, width, height: y1 - y0, scale: 1 } })
  writeFileSync(`${OUT}/raw/${name}.png`, Buffer.from(r.data, 'base64')); return `data:image/png;base64,${r.data}` }
const sAbout = await sgrab('settings-about', box.about, box.aboutX), sHead = await sgrab('settings-headings', box.headings), sLists = await sgrab('settings-lists', box.lists), sLook = await sgrab('settings-look', box.look)
const sk = 520 / (box.w + 24), ak = 520 / box.aboutX[1], sh = ([y0, y1]) => Math.round((y1 - y0) * sk)
sws.close(); await ev(`app.setting.close(); return 1`)
await compose('5-settings', 'violet', 'Make it yours.',
  'Heading only or with children, Enter and Ctrl+A that know lists, tidy list styles and lines. Your notes stay plain Markdown.',
  card(sAbout, 'left:56px;top:205px;width:520px') + card(sHead, `left:56px;top:${205 + Math.round((box.about[1] - box.about[0]) * ak) + 22}px;width:520px`) +
  card(sLists, 'right:56px;top:205px;width:520px') + card(sLook, `right:56px;top:${205 + sh(box.lists) + 22}px;width:520px`))
console.log('settings column heights', 205 + Math.round((box.about[1] - box.about[0]) * ak) + 22 + sh(box.headings), 205 + sh(box.lists) + 22 + sh(box.look))

// 6. README animation frames: Tab on a list item, back, then Tab on a heading. scripts/make-gif.py turns them into demo.gif.
await scene({ dragAndDrop: false }, { at: 'She reads the letter at last' })
await mouse('mouseMoved', 1270, 790)
const gclip = await noteClip('Act two', 'Who really sent', 30); gclip.width += 40
await grab('gif-0', gclip)
await key('Tab'); await grab('gif-1', gclip)
await key('Tab', ['shift']); await caret('## Act two'); await grab('gif-2', gclip)
await key('Tab'); await grab('gif-3', gclip)
await key('Tab', ['shift']); await caret('A short novel'); await grab('gif-4', gclip)
await scene()
process.exit(0)
