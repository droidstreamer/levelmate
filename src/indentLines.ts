import { foldedRanges } from '@codemirror/language'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { analyze } from './core/doc'
import { parsePrefix } from './core/editing'
import type { ListItem } from './core/listTree'
import { setFold } from './lists'
import type LevelMatePlugin from './main'

interface Guide {
  x: number
  top: number
  height: number
  line: number
}

/** Vertical guide beside each item's children; clicking folds the item (setting-dependent). */
export function indentLines(plugin: LevelMatePlugin) {
  return ViewPlugin.fromClass(
    class {
      layer = createDiv()
      items: ListItem[] = []
      shown = false

      constructor(private view: EditorView) {
        this.layer.className = 'tabwise-indent-layer'
        view.scrollDOM.appendChild(this.layer)
        this.layer.addEventListener('mousedown', (e) => {
          const line = (e.target as HTMLElement).dataset.line
          if (line === undefined || plugin.settings.indentLineClick !== 'fold') return
          e.preventDefault()
          setFold(view, +line, true)
        })
        this.schedule(true)
      }

      update(u: ViewUpdate) {
        const on = plugin.settings.indentLines
        if (u.docChanged || u.viewportChanged || u.geometryChanged || on !== this.shown || u.transactions.some((t) => t.effects.length)) {
          this.schedule(u.docChanged || this.items.length === 0)
        }
      }

      schedule(reparse: boolean) {
        const view = this.view
        if (!plugin.settings.indentLines) {
          this.shown = false
          this.layer.replaceChildren()
          return
        }
        this.shown = true
        view.requestMeasure({
          key: this,
          read: () => {
            // ponytail: whole-note parse on edits; cached across scrolling, limit to visible blocks if slow
            if (reparse) this.items = analyze(view.state.doc.toString()).lists.all.filter((i) => i.end > i.line)
            return this.measure()
          },
          write: (guides: Guide[]) => {
            this.layer.replaceChildren(
              ...guides.map((g) => {
                const el = createDiv()
                el.className = 'tabwise-indent-line'
                el.dataset.line = String(g.line)
                el.style.cssText = `left:${g.x}px;top:${g.top}px;height:${g.height}px`
                return el
              }),
            )
          },
        })
      }

      measure(): Guide[] {
        const { view } = this
        const { doc } = view.state
        const rect = view.scrollDOM.getBoundingClientRect()
        const { scrollLeft, scrollTop } = view.scrollDOM
        const folds = foldedRanges(view.state)
        const guides: Guide[] = []
        for (const it of this.items) {
          if (it.end >= doc.lines || it.line >= doc.lines) continue
          const head = doc.line(it.line + 1)
          const p = parsePrefix(head.text)
          if (!p) continue
          let hidden = false
          folds.between(head.to, head.to + 1, () => void (hidden = true))
          if (hidden) continue
          const marker = view.coordsAtPos(head.from + p.indent.length)
          const content = view.coordsAtPos(head.from + p.len)
          const top = content // the first visual line: the guide hangs from the marker, beside any wrapped lines
          const bottom = view.coordsAtPos(doc.line(it.end + 1).to)
          if (!marker || !content || !top || !bottom) continue // outside the rendered viewport
          // The guide runs under the center of the rendered marker (bullet, number or checkbox) when the line has one.
          const lineEl = view.domAtPos(head.from).node
          const cmLine = (lineEl.instanceOf(Element) ? lineEl : lineEl.parentElement)?.closest('.cm-line')
          const mEl = cmLine?.querySelector('input.task-list-item-checkbox') ?? cmLine?.querySelector('.cm-formatting-list')
          const mr = mEl?.getBoundingClientRect()
          guides.push({
            x: (mr && mr.width > 0 ? mr.left + mr.width / 2 : marker.left + (content.left - marker.left) * 0.3) - rect.left + scrollLeft,
            top: top.bottom - rect.top + scrollTop,
            height: bottom.bottom - top.bottom,
            line: it.line,
          })
        }
        return guides
      }

      destroy() {
        this.layer.remove()
      }
    },
  )
}
