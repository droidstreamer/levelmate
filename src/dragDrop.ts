import { foldedRanges, indentUnit } from '@codemirror/language'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { dragKind, dropCandidates, dropItem, dropSection, sectionBoundaries } from './core/dnd'
import { analyze } from './core/doc'
import { parsePrefix } from './core/editing'
import { itemAt } from './core/listTree'
import type { ListResult } from './core/lists'
import type LevelMatePlugin from './main'

type Doc = ReturnType<typeof analyze>
interface Drag {
  kind: 'list' | 'heading'
  line: number
}
/** A pending drop: the change to make and where to draw the indicator (px relative to the scroller). */
interface Drop {
  res: ListResult
  x: number
  y: number
}
/** A slot lights up only once the pointer is this share of a line height from it (round 5: grabbing does nothing). */
const NEAR = 0.3 // ponytail: fixed share of the default line height; per-theme tuning if themes with big gaps complain

/** Drag handle beside list items and headings; dropping moves the item or whole section (F6). Desktop only. */
export function dragDrop(plugin: LevelMatePlugin) {
  return ViewPlugin.fromClass(
    class {
      layer = createDiv()
      handle = createDiv()
      bar = createDiv()
      ghost = createDiv()
      slots = createDiv()
      doc: { text: unknown; parsed: Doc } | null = null
      hover = -1
      drag: Drag | null = null
      drop: Drop | null = null

      constructor(private view: EditorView) {
        this.layer.className = 'tabwise-drag-layer'
        this.handle.className = 'tabwise-drag-handle'
        this.handle.textContent = '⠿'
        this.bar.className = 'tabwise-drop-bar'
        this.ghost.className = 'tabwise-drag-ghost'
        this.handle.hidden = this.bar.hidden = this.ghost.hidden = true
        this.slots.className = 'tabwise-drop-slots'
        this.layer.append(this.slots, this.handle, this.bar, this.ghost)
        view.scrollDOM.appendChild(this.layer)
        view.contentDOM.addEventListener('mousemove', this.onHover)
        view.dom.addEventListener('mouseleave', this.onLeave)
        this.handle.addEventListener('mousedown', this.onDown)
      }

      parsed(): Doc {
        const text = this.view.state.doc
        if (this.doc?.text !== text) this.doc = { text, parsed: analyze(text.toString()) }
        return this.doc.parsed
      }

      update(u: ViewUpdate) {
        // Round 4: off means gone, even a grip that was showing when the setting was turned off.
        this.layer.style.display = plugin.settings.dragAndDrop ? '' : 'none'
        if (this.drag) {
          // lines scrolled into view get their slot bands too
          if (u.viewportChanged || u.geometryChanged) this.view.requestMeasure({ key: this, read: () => this.slotSpots(), write: (s) => this.drawSlots(s) })
          return
        }
        this.handle.hidden = true // positions are stale after any edit or scroll; next mousemove shows it again
        this.hover = -1
      }

      /** Position relative to the scroller's content. */
      rel(c: { left: number; top: number; bottom: number }) {
        const r = this.view.scrollDOM.getBoundingClientRect()
        return { x: c.left - r.left + this.view.scrollDOM.scrollLeft, top: c.top - r.top + this.view.scrollDOM.scrollTop, bottom: c.bottom - r.top + this.view.scrollDOM.scrollTop }
      }

      onHover = (e: MouseEvent) => {
        if (this.drag || !plugin.settings.dragAndDrop) return
        const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY }, false)
        const line = this.view.state.doc.lineAt(pos).number - 1
        if (line === this.hover) return
        this.hover = line
        const doc = this.parsed()
        const kind = dragKind(doc, line)
        const head = this.view.state.doc.line(line + 1)
        const c = kind && this.view.coordsAtPos(head.from + (parsePrefix(head.text)?.indent.length ?? 0))
        if (!c) {
          this.handle.hidden = true
          return
        }
        const p = this.rel(c)
        this.handle.hidden = false
        this.handle.style.cssText = `left:${Math.max(p.x - 56, this.view.scrollDOM.scrollLeft + 2)}px;top:${p.top}px;height:${p.bottom - p.top}px`
      }

      onLeave = () => {
        if (!this.drag) this.handle.hidden = true
        this.hover = -1
      }

      onDown = (e: MouseEvent) => {
        if (e.button !== 0 || this.hover < 0) return
        const kind = dragKind(this.parsed(), this.hover)
        if (!kind) return
        e.preventDefault()
        this.drag = { kind, line: this.hover }
        this.layer.classList.add('dragging')
        document.body.classList.add('tabwise-dragging') // keeps the grabbing hand over everything (D23)
        this.ghost.textContent = this.view.state.doc.line(this.hover + 1).text.trim()
        this.drawSlots(this.slotSpots())
        document.addEventListener('mousemove', this.onMove)
        document.addEventListener('mouseup', this.onUp)
        document.addEventListener('keydown', this.onKey, true)
      }

      onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        this.drop = null
        this.end()
      }

      onMove = (e: MouseEvent) => {
        const { view } = this
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false)
        this.drop = this.drag && this.target(this.drag, pos, e.clientX, e.clientY)
        this.bar.hidden = !this.drop
        if (this.drop) this.bar.style.cssText = `left:${this.drop.x}px;top:${this.drop.y}px`
        const g = this.rel({ left: e.clientX, top: e.clientY, bottom: e.clientY })
        this.ghost.hidden = false
        this.ghost.style.cssText = `left:${g.x + 14}px;top:${g.top + 10}px`
      }

      target(drag: Drag, pos: number, clientX: number, clientY: number): Drop | null {
        const { view } = this
        const doc = this.parsed()
        const lines = view.state.doc
        const line = lines.lineAt(pos)
        const lineIdx = line.number - 1
        const c = view.coordsAtPos(line.from)
        if (!c) return null
        const upper = clientY < (c.top + c.bottom) / 2
        if (drag.kind === 'heading') {
          // nearest section boundary to the pointer
          const f = lineIdx + (upper ? 0 : 1)
          const at = sectionBoundaries(doc, drag.line).sort((a, b) => Math.abs(a - f) - Math.abs(b - f))[0]
          const res = at === undefined ? null : dropSection(doc, drag.line, at)
          if (!res) return null
          const ref = view.coordsAtPos(lines.line(Math.min(at + 1, lines.lines)).from)
          const y = this.gap(at)
          if (!ref || y == null || !this.near(y, clientY)) return null
          return { res, x: this.rel(ref).x, y }
        }
        // The gap is the one nearest the pointer (above or below the line it is on); the pointer's x then picks the level.
        const first = c, last = view.coordsAtPos(line.to) ?? c
        const before = clientY < (first.top + last.bottom) / 2
        const hit = itemAt(doc.lists.all, lineIdx)
        if (!hit) return null
        // a folded item's sub-items are hidden, so the gap below it is below the whole item
        let folded = false
        foldedRanges(view.state).between(line.to, line.to + 1, () => void (folded = true))
        if (hit.line !== lineIdx || hit.end === lineIdx) folded = false
        const gap = before ? lineIdx : (folded ? hit.end : lineIdx) + 1
        const unit = view.state.facet(indentUnit)
        const marker = (l: number) => {
          const ln = lines.line(l + 1)
          return view.coordsAtPos(ln.from + (parsePrefix(ln.text)?.indent.length ?? 0))
        }
        let best: { res: ListResult, x: number, dx: number } | null = null
        for (const cand of dropCandidates(doc, drag.line, gap, unit)) {
          const res = dropItem(doc, drag.line, cand.target, cand.where, unit)
          if (!res) continue
          const tgt = itemAt(doc.lists.all, cand.target)!
          const kid = tgt.children[0]
          const tp = parsePrefix(lines.line(tgt.line + 1).text)
          // the dot sits where the dropped item's bullet will: its level is the level of the nearest marker
          const ref = cand.where !== 'child' ? marker(tgt.line) : kid ? marker(kid.line) : view.coordsAtPos(lines.line(tgt.line + 1).from + (tp?.len ?? 0))
          if (!ref) continue
          const dx = Math.abs(clientX - ref.left)
          if (!best || dx < best.dx) best = { res, x: this.rel(ref).x, dx }
        }
        const y = this.gap(gap)
        if (!best || y == null || !this.near(y, clientY)) return null
        return { res: best.res, x: best.x, y }
      }

      near(y: number, clientY: number) {
        return Math.abs(this.rel({ left: 0, top: clientY, bottom: clientY }).top - y) <= NEAR * this.view.defaultLineHeight
      }

      /** Every valid drop gap in the rendered viewport (round 5: faint bands on grab), as scroller-relative spots. */
      slotSpots() {
        const { view, drag } = this
        if (!drag) return []
        const doc = this.parsed()
        const lines = view.state.doc
        const first = lines.lineAt(view.viewport.from).number - 1
        const last = lines.lineAt(view.viewport.to).number
        const unit = view.state.facet(indentUnit)
        const folds = foldedRanges(view.state)
        const gaps = drag.kind === 'heading'
          ? sectionBoundaries(doc, drag.line).filter((b) => b >= first && b <= last)
          : Array.from({ length: last - first + 1 }, (_, i) => first + i).filter((g) => dropCandidates(doc, drag.line, g, unit).length)
        const spots: { x: number, y: number }[] = []
        for (const g of gaps) {
          const pos = lines.line(Math.min(g + 1, lines.lines)).from
          let hidden = false
          folds.between(pos, pos, (f, t) => void (hidden ||= pos > f && pos <= t)) // inside a folded item
          const ref = !hidden && view.coordsAtPos(pos)
          const y = ref && this.gap(g)
          if (ref && y != null) spots.push({ x: this.rel(ref).x, y })
        }
        return spots
      }

      drawSlots(spots: { x: number, y: number }[]) {
        this.slots.replaceChildren(...spots.map(({ x, y }) => {
          const el = createDiv()
          el.className = 'tabwise-drop-slot'
          el.style.cssText = `left:${x}px;top:${y}px`
          return el
        }))
      }

      /** y of the middle of the gap above line `at`, relative to the scroller. */
      gap(at: number) {
        const lines = this.view.state.doc
        const next = at < lines.lines ? this.view.coordsAtPos(lines.line(at + 1).from) : null
        const prev = at > 0 ? this.view.coordsAtPos(lines.line(at).to) : null
        if (next && prev) return (this.rel(prev).bottom + this.rel(next).top) / 2
        return next ? this.rel(next).top : prev ? this.rel(prev).bottom : null
      }

      onUp = () => {
        const drop = this.drop
        this.end()
        if (!drop?.res.block) return
        const { state } = this.view
        const { from, to, lines } = drop.res.block
        const insert = lines.join(state.lineBreak)
        if (insert === state.sliceDoc(state.doc.line(from + 1).from, state.doc.line(to + 1).to)) return
        this.view.dispatch({
          changes: { from: state.doc.line(from + 1).from, to: state.doc.line(to + 1).to, insert },
          userEvent: 'move.drop',
        })
      }

      end() {
        this.drag = null
        this.hover = -1 // so the grip shows again when the pointer moves on the same line
        this.bar.hidden = this.handle.hidden = this.ghost.hidden = true
        this.slots.replaceChildren()
        this.layer.classList.remove('dragging')
        document.body.classList.remove('tabwise-dragging')
        document.removeEventListener('mousemove', this.onMove)
        document.removeEventListener('mouseup', this.onUp)
        document.removeEventListener('keydown', this.onKey, true)
      }

      destroy() {
        this.end()
        this.layer.remove()
      }
    },
  )
}
