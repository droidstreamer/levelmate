import type { analyze } from './doc'
import type { ListResult } from './lists'

type Block = NonNullable<ListResult['block']>
type Doc = ReturnType<typeof analyze>

const ORDERED = /^([ \t]*)(\d+)([.)])/
const BULLET = /^([ \t]*)[-*+](?:[ \t]|$)/

/**
 * Renumbers the ordered runs a moved block touches. The block is spliced into the note, then the whole
 * list block around it is walked; a run that starts above the block continues its numbering, any other starts at 1.
 * Returns the block widened to cover the renumbered lines (line count is unchanged, so indexes stay valid).
 * ponytail: a run that starts inside the block restarts at 1, not at its old start number.
 */
export function renumberBlock(doc: Doc, block: Block): Block {
  const all = doc.lines.slice()
  all.splice(block.from, block.to - block.from + 1, ...block.lines)
  let s = block.from
  while (s > 0 && all[s - 1].trim()) s--
  let e = block.to
  while (e + 1 < all.length && all[e + 1].trim()) e++
  const runs: { len: number; n: number }[] = []
  for (let i = s; i <= e; i++) {
    const o = ORDERED.exec(all[i])
    if (!o) {
      const b = BULLET.exec(all[i])
      while (b && runs.length && runs[runs.length - 1].len >= b[1].length) runs.pop()
      continue
    }
    const len = o[1].length
    while (runs.length && runs[runs.length - 1].len > len) runs.pop()
    let run = runs[runs.length - 1]
    if (run?.len === len) run.n++
    else runs.push((run = { len, n: i < block.from ? +o[2] : 1 }))
    all[i] = o[1] + run.n + all[i].slice(o[1].length + o[2].length)
  }
  return { from: s, to: e, lines: all.slice(s, e + 1) }
}
