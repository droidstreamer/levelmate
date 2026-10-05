// Drives a real Obsidian over the DevTools protocol (same approach as MindmapMate): launch, trust, enable LevelMate, ev(), shot(), check().
// `npm run build` first. Imported by check.mjs (feature checks).
// Uses its own profile on ../test-vault; the user's Obsidian is untouched. Screenshots go to $SHOTS (default: os tmpdir).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

// PORT and VAULT can be overridden (showcase.mjs uses its own vault for the store screenshots).
export const PORT = +(process.env.PORT ?? 9335), VAULT = resolve(process.env.VAULT ?? '../test-vault'), profile = `${tmpdir()}/levelmate-obsidian-profile-${PORT}`, SHOTS = process.env.SHOTS ?? tmpdir()
export const sleep = ms => new Promise(r => setTimeout(r, ms))
const target = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page' && !t.title.startsWith('Settings'))
try { if (!(await target())) throw 0 } catch {
  mkdirSync(profile, { recursive: true })
  writeFileSync(`${profile}/obsidian.json`, JSON.stringify({ vaults: { [`levelmate${PORT}`]: { path: VAULT, ts: 1, open: true } }, updateDisabled: true }))
  spawn('obsidian', [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 60; i++) { try { if (await target()) break } catch { /* starting */ } await sleep(500) }
}
const ws = new WebSocket((await target()).webSocketDebuggerUrl)
await new Promise(r => ws.onopen = r)
let seq = 0
export const call = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq
  ws.addEventListener('message', function h(e) { const m = JSON.parse(e.data); if (m.id !== id) return; ws.removeEventListener('message', h); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) })
  ws.send(JSON.stringify({ id, method, params }))
})
export const ev = async src => {
  const r = await call('Runtime.evaluate', { expression: `(async () => { ${src} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails))
  return r.result.value
}
export const shot = async name => { const r = await call('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('shot', `${SHOTS}/${name}.png`) }
export let failed = 0
export const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`) }

export const done = () => { console.log(failed ? `${failed} FAILED` : 'all passed'); ws.close(); process.exit(failed ? 1 : 0) }

await sleep(1500)
await ev(`[...document.querySelectorAll('.modal button')].find(b => b.textContent.includes('Trust'))?.click()
  await new Promise(r => setTimeout(r, 300)); await app.plugins.setEnable(true)
  await app.plugins.disablePlugin('levelmate'); await app.plugins.loadManifests(); await app.plugins.enablePlugin('levelmate'); await new Promise(r => setTimeout(r, 500)); return 1`)

// Real input: key presses and mouse events go through Chromium, so they reach CodeMirror and Obsidian's hotkeys like a user's.
const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 }
const VK = { Tab: 9, Enter: 13, Backspace: 8, Delete: 46, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, a: 65, z: 90 }
export const key = async (k, mods = []) => {
  const modifiers = mods.reduce((n, m) => n | MOD[m], 0), base = { key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, windowsVirtualKeyCode: VK[k] ?? k.toUpperCase().charCodeAt(0), modifiers }
  await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, ...(k === 'Enter' && !mods.includes('ctrl') ? { text: '\r' } : {}) })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(120)
}
export const type = async s => { await call('Input.insertText', { text: s }); await sleep(80) }
export const mouse = async (type, x, y, extra = {}) => { await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra }); await sleep(60) }

// A scratch note in the test vault: set its text and caret (line, col; negative col = end of line), focus it.
export const note = (text, line = 0, col = 0) => ev(`const path = 'Fixtures/_check.md'
  let f = app.vault.getAbstractFileByPath(path); if (!f) f = await app.vault.create(path, '');
  const leaf = app.workspace.getLeaf(); await leaf.openFile(f); const ed = leaf.view.editor; ed.setValue(${JSON.stringify(text)})
  const ln = ${line}, c = ${col}; ed.setCursor({ line: ln, ch: c < 0 ? ed.getLine(ln).length : c }); ed.focus(); await new Promise(r => setTimeout(r, 250)); return 1`)
export const text = () => ev(`return app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor.getValue()`)
export const cursor = () => ev(`const e = app.workspace.getLeavesOfType('markdown').find(l => l.view.file?.path === 'Fixtures/_check.md').view.editor, c = e.getCursor(); return [c.line, c.ch]`)
export const setOpt = o => ev(`Object.assign(app.plugins.plugins.levelmate.settings, ${JSON.stringify(o)}); app.plugins.plugins.levelmate.applySettings(); return 1`)
