import { describe, expect, test } from 'vitest'
import { dragKind, dropItem, dropSection, sectionBoundaries, DropWhere } from '../../src/core/dnd'
import { analyze } from '../../src/core/doc'
import type { ListResult } from '../../src/core/lists'

const out = (text: string, res: ListResult | null) => {
  if (!res) return null
  const lines = text.split('\n')
  lines.splice(res.block!.from, res.block!.to - res.block!.from + 1, ...res.block!.lines)
  return lines.join('\n')
}
const item = (t: string, src: number, target: number, w: DropWhere) => out(t, dropItem(analyze(t), src, target, w))

describe('list drop', () => {
  const t = '- a\n  - a1\n- b\n- c'
  test('after a later sibling', () => {
    expect(item(t, 0, 3, 'after')).toBe('- b\n- c\n- a\n  - a1')
  })
  test('before an earlier sibling', () => {
    expect(item(t, 3, 0, 'before')).toBe('- c\n- a\n  - a1\n- b')
  })
  test('as child re-indents with sub-items', () => {
    expect(item(t, 0, 2, 'child')).toBe('- b\n\t- a\n\t  - a1\n- c')
  })
  test('child of an item with children matches existing children', () => {
    expect(item(t, 2, 0, 'child')).toBe('- a\n  - a1\n  - b\n- c')
  })
  test('nested item dropped at root level', () => {
    expect(item(t, 1, 3, 'after')).toBe('- a\n- b\n- c\n- a1')
  })
  test('into itself is refused', () => {
    expect(item(t, 0, 1, 'after')).toBeNull()
    expect(item(t, 0, 0, 'child')).toBeNull()
  })
  test('note lines: target resolves to the owning item', () => {
    expect(item('- a\n  note\n- b', 2, 1, 'after')).toBeNull() // lands where it already is
  })
  test('no-op drop points are refused (right above or below itself)', () => {
    expect(item(t, 2, 3, 'before')).toBeNull()
    expect(item(t, 2, 3, 'after')).not.toBeNull()
    expect(item(t, 2, 1, 'after')).not.toBeNull() // child-level neighbour: changes indent, so offered
    expect(item(t, 2, 0, 'after')).toBeNull()
  })
  test('ordered items are renumbered after a drop', () => {
    expect(item('1. a\n2. b\n3. c', 2, 0, 'before')).toBe('1. c\n2. a\n3. b')
    expect(item('1. a\n   1. a1\n2. b', 2, 0, 'child')).toBe('1. a\n   1. a1\n   2. b')
  })
})

describe('section drop', () => {
  const t = '## A\na\n### A1\nx\n## B\nb\n## C'
  test('boundaries exclude the source', () => {
    expect(sectionBoundaries(analyze(t), 4)).toEqual([0, 7]) // not before ### A1: ## B would adopt it
  })
  test('a section never lands before a deeper heading (no adopting)', () => {
    const u = '# A\n## A1\n# B\n## B1\n## B2\n# C'
    expect(sectionBoundaries(analyze(u), 0)).toEqual([5, 6]) // a # goes only between # sections
    expect(sectionBoundaries(analyze(u), 3)).toEqual([0, 1, 2, 5, 6]) // a ## may leave its # and sit among another # 's ##
    expect(dropSection(analyze(u), 0, 4)).toBeNull()
    expect(out(u, dropSection(analyze(u), 3, 1))).toBe('# A\n## B1\n## A1\n# B\n## B2\n# C')
  })
  test('to the end', () => {
    expect(out(t, dropSection(analyze(t), 0, 7))).toBe('## B\nb\n## C\n## A\na\n### A1\nx')
  })
  test('before an earlier heading keeps levels', () => {
    expect(out(t, dropSection(analyze(t), 2, 6))).toBe('## A\na\n## B\nb\n### A1\nx\n## C')
  })
  test('middle of a body is not a boundary', () => {
    expect(dropSection(analyze(t), 4, 1)).toBeNull()
    expect(dropSection(analyze(t), 4, 5)).toBeNull()
  })
})

test('dragKind', () => {
  const d = analyze('# H\n- a\n  note\ntext')
  expect([0, 1, 2, 3].map((l) => dragKind(d, l))).toEqual(['heading', 'list', null, null])
})

import { dropCandidates } from '../../src/core/dnd'
describe('drop candidates (round 4: the indicator follows the pointer)', () => {
  const t = '- a\n  - a1\n    - a2\n- b\n- c'
  const at = (src: number, gap: number) => dropCandidates(analyze(t), src, gap).map((c) => `${c.target}${c.where[0]}`)
  test('below a deep last item: its child, then a sibling at each level it closes', () => {
    expect(at(4, 3)).toEqual(['2c', '2a', '1a', '0a', '3b']) // gap 3 is under a2; a1 and a end there too; before b repeats a's level
  })
  test('between siblings: sibling after the one above (child too when it has no children)', () => {
    expect(at(0, 4)).toEqual(['3c', '3a', '4b']) // before c repeats after b
  })
  test('the top of the list only allows before the first item', () => {
    expect(at(4, 0)).toEqual(['0b'])
  })
  test('the gap inside the dragged item is refused', () => {
    expect(at(0, 2)).toEqual([])
  })
})
