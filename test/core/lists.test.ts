import { describe, expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'
import { foldTarget } from '../../src/core/fold'
import { ListAction, runListAction } from '../../src/core/lists'

/** Applies a result like the editor would; returns new text, or null when not applicable. */
function run(text: string, line: number, action: ListAction, unit = '\t') {
  const doc = analyze(text)
  const res = runListAction(doc, line, action, unit)
  if (!res) return null
  const lines = [...doc.lines]
  if (res.block) lines.splice(res.block.from, res.block.to - res.block.from + 1, ...res.block.lines)
  for (const e of res.edits) lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to)
  return lines.join('\n')
}

describe('ordered renumbering', () => {
  test('move keeps numbers in order', () => {
    expect(run('1. a\n2. b\n3. c', 2, 'moveUp')).toBe('1. a\n2. c\n3. b')
    expect(run('1. a\n   1. a1\n   2. a2\n2. b', 3, 'moveUp')).toBe('1. b\n2. a\n   1. a1\n   2. a2')
  })
  test('nested run under a bullet', () => {
    expect(run('- x\n  1. a\n  2. b\n  3. c', 2, 'moveDown')).toBe('- x\n  1. a\n  2. c\n  3. b')
  })
})

describe('indent', () => {
  test('nests under previous sibling with its children', () => {
    expect(run('- a\n- b\n  - c', 1, 'indent')).toBe('- a\n\t- b\n\t  - c')
  })
  test('space unit', () => {
    expect(run('- a\n- b', 1, 'indent', '  ')).toBe('- a\n  - b')
  })
  test('first item is blocked but consumed', () => {
    expect(run('- a\n- b', 0, 'indent')).toBe('- a\n- b')
  })
  test('first child of a parent is blocked', () => {
    expect(run('- a\n  - b', 1, 'indent')).toBe('- a\n  - b')
  })
  test('note lines travel with the item', () => {
    expect(run('- a\n- b\n  note', 1, 'indent')).toBe('- a\n\t- b\n\t  note')
  })
  test('ordered and task items', () => {
    expect(run('1. a\n2. [ ] b', 1, 'indent')).toBe('1. a\n\t2. [ ] b')
  })
  test('LIST_HEADING indents as a list item (D7)', () => {
    expect(run('- a\n- ## T', 1, 'indent')).toBe('- a\n\t- ## T')
  })
})

describe('outdent', () => {
  test('moves item and children up a level', () => {
    expect(run('- a\n  - b\n    - c', 1, 'outdent')).toBe('- a\n- b\n  - c')
  })
  test('following siblings become children of the outdented item', () => {
    expect(run('- a\n  - b\n  - c', 1, 'outdent')).toBe('- a\n- b\n  - c')
  })
  test('tab indentation', () => {
    expect(run('- a\n\t- b', 1, 'outdent')).toBe('- a\n- b')
  })
  test('spaces when unit is a tab', () => {
    expect(run('- a\n    - b', 1, 'outdent')).toBe('- a\n- b')
  })
  test('root item is blocked but consumed', () => {
    expect(run('- a', 0, 'outdent')).toBe('- a')
  })
  test('LIST_HEADING', () => {
    expect(run('- a\n  - ## T', 1, 'outdent')).toBe('- a\n- ## T')
  })
})

describe('move', () => {
  test('down past sibling with children', () => {
    expect(run('- a\n  - a1\n- b\n- c', 0, 'moveDown')).toBe('- b\n- a\n  - a1\n- c')
  })
  test('up', () => {
    expect(run('- a\n- b\n  - b1', 1, 'moveUp')).toBe('- b\n  - b1\n- a')
  })
  test('cursor on a child line moves that child among its siblings', () => {
    expect(run('- p\n  - a\n  - b', 2, 'moveUp')).toBe('- p\n  - b\n  - a')
  })
  test('does not leave its parent', () => {
    expect(run('- p\n  - a\n- q', 1, 'moveDown')).toBe('- p\n  - a\n- q')
    expect(run('- p\n  - a\n- q', 2, 'moveUp')).toBe('- q\n- p\n  - a')
  })
  test('first up and last down are no-ops', () => {
    expect(run('- a\n- b', 0, 'moveUp')).toBe('- a\n- b')
    expect(run('- a\n- b', 1, 'moveDown')).toBe('- a\n- b')
  })
  test('reports cursor travel', () => {
    const r = runListAction(analyze('- a\n  - a1\n- b'), 0, 'moveDown')!
    expect(r.lineDelta).toBe(1)
    const u = runListAction(analyze('- a\n  - a1\n- b'), 2, 'moveUp')!
    expect(u.lineDelta).toBe(-2)
  })
  test('CRLF text', () => {
    expect(run('- a\r\n- b', 1, 'moveUp')).toBe('- b\n- a')
  })
})

describe('fall through', () => {
  test.each([['plain'], ['## H'], ['```\n- x\n```'], ['']])('%j', (t) => {
    expect(run(t, 0, 'indent')).toBeNull()
    expect(run(t, 0, 'moveUp')).toBeNull()
  })
  test('note line does not indent or outdent', () => {
    expect(run('- a\n  note', 1, 'indent')).toBeNull()
  })
})

describe('fold target', () => {
  test('item with children', () => {
    expect(foldTarget(analyze('- a\n  - b\n- c'), 0)).toEqual({ line: 0, end: 1 })
  })
  test('leaf item has none', () => {
    expect(foldTarget(analyze('- a\n- b'), 0)).toBeNull()
  })
  test('cursor on a note line targets the item', () => {
    expect(foldTarget(analyze('- a\n  note'), 1)).toEqual({ line: 0, end: 1 })
  })
  test('heading section, trailing blank lines trimmed', () => {
    expect(foldTarget(analyze('## A\ntext\n### B\nx\n\n## C'), 0)).toEqual({ line: 0, end: 3 })
  })
  test('empty heading has none', () => {
    expect(foldTarget(analyze('## A\n## B'), 0)).toBeNull()
  })
  test('plain line has none', () => {
    expect(foldTarget(analyze('text'), 0)).toBeNull()
  })
})
