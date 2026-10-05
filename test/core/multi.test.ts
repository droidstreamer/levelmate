import { describe, expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'
import { runHeadingAction } from '../../src/core/headings'
import { ListResult, runListAction } from '../../src/core/lists'
import { moveSection } from '../../src/core/sections'

function apply(text: string, res: ListResult | null) {
  if (!res) return null
  const lines = text.split('\n')
  if (res.block) lines.splice(res.block.from, res.block.to - res.block.from + 1, ...res.block.lines)
  for (const e of res.edits) lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to)
  return lines.join('\n')
}

describe('section move (F4)', () => {
  const t = '## A\na\n### A1\nx\n## B\nb'
  test('swaps whole sections', () => {
    expect(apply(t, moveSection(analyze(t), 0, 1))).toBe('## B\nb\n## A\na\n### A1\nx')
    expect(apply(t, moveSection(analyze(t), 4, -1))).toBe('## B\nb\n## A\na\n### A1\nx')
  })
  test('first/last sibling: nothing, key consumed', () => {
    expect(apply(t, moveSection(analyze(t), 0, -1))).toBe(t)
    expect(apply(t, moveSection(analyze(t), 4, 1))).toBe(t)
  })
  test('stays inside its parent', () => {
    const u = '## A\n### A1\n## B\n### B1'
    expect(apply(u, moveSection(analyze(u), 1, 1))).toBe(u)
  })
  test('non-heading is null', () => {
    expect(moveSection(analyze('- a'), 0, 1)).toBeNull()
  })
})

describe('multi-line lists (F5)', () => {
  const t = '- a\n- b\n- c\n- d'
  test('indent a block under the previous sibling', () => {
    expect(apply(t, runListAction(analyze(t), 1, 'indent', '\t', 2))).toBe('- a\n\t- b\n\t- c\n- d')
  })
  test('indent blocked when the first has no previous sibling', () => {
    expect(apply(t, runListAction(analyze(t), 0, 'indent', '\t', 1))).toBe(t)
  })
  test('outdent a block', () => {
    const u = '- a\n\t- b\n\t- c\n- d'
    expect(apply(u, runListAction(analyze(u), 1, 'outdent', '\t', 2))).toBe('- a\n- b\n- c\n- d')
  })
  test('move block down and up', () => {
    expect(apply(t, runListAction(analyze(t), 0, 'moveDown', '\t', 1))).toBe('- c\n- a\n- b\n- d')
    expect(apply(t, runListAction(analyze(t), 2, 'moveUp', '\t', 3))).toBe('- a\n- c\n- d\n- b')
  })
  test('selected parent and child move once, as one block', () => {
    const u = '- a\n  - a1\n- b'
    expect(apply(u, runListAction(analyze(u), 0, 'moveDown', '\t', 1))).toBe('- b\n- a\n  - a1')
  })
  test('different parents: blocked', () => {
    const u = '- a\n  - a1\n- b'
    expect(apply(u, runListAction(analyze(u), 1, 'indent', '\t', 2))).toBe(u)
  })
  test('headings in the selection are skipped with a notice', () => {
    const u = '- a\n- b\n# H'
    expect(runListAction(analyze(u), 1, 'indent', '\t', 2)!.notice).toMatch(/skipped/)
  })
})

describe('multi-line headings (F5)', () => {
  const shift = (t: string, to: number, dir: 1 | -1) => {
    const r = runHeadingAction(analyze(t), 0, to, { kind: 'shift', dir, children: true })!
    const lines = t.split('\n')
    for (const e of r.edits) lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to)
    return [lines.join('\n'), r.notice]
  }
  test('every heading shifts, children setting ignored', () => {
    expect(shift('## A\ntext\n### B', 2, 1)[0]).toBe('### A\ntext\n#### B')
    expect(shift('## A\n### B', 1, -1)[0]).toBe('# A\n## B')
  })
  test('H6 clamps with a notice', () => {
    expect(shift('##### A\n###### B', 1, 1)).toEqual(['###### A\n###### B', '1 heading was already H6 and stayed at H6.'])
  })
  test('mixed selection: notice for skipped list items', () => {
    expect(shift('## A\n- x', 1, 1)[1]).toMatch(/List items/)
  })
})
