import { describe, expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'
import { enter, EditResult, pullUpItem, selectAll, shiftEnter } from '../../src/core/editing'

/** Applies edits like the editor; `|` marks the cursor in input and output. Null when not applicable. */
function run(fn: (d: ReturnType<typeof analyze>, line: number, col: number) => EditResult | null, input: string) {
  const at = input.indexOf('|')
  const text = input.replace('|', '')
  const line = text.slice(0, at).split('\n').length - 1
  const col = at - (text.slice(0, at).lastIndexOf('\n') + 1)
  const doc = analyze(text)
  const res = fn(doc, line, col)
  if (!res) return null
  const lines = [...doc.lines]
  for (const e of res.edits) lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to)
  const out = lines.join('\n').split('\n')
  if (res.cursor) out[res.cursor.line] = out[res.cursor.line].slice(0, res.cursor.col) + '|' + out[res.cursor.line].slice(res.cursor.col)
  return out.join('\n')
}

describe('enter', () => {
  test('end of item adds a sibling', () => {
    expect(run(enter, '- a|\n- b')).toBe('- a\n- |\n- b')
  })
  test('nested sibling keeps indent', () => {
    expect(run(enter, '- a\n\t- b|')).toBe('- a\n\t- b\n\t- |')
  })
  test('mid-line splits', () => {
    expect(run(enter, '- ab|cd')).toBe('- ab\n- |cd')
  })
  test('task gets an empty checkbox', () => {
    expect(run(enter, '- [x] a|')).toBe('- [x] a\n- [ ] |')
  })
  test('ordered list increments', () => {
    expect(run(enter, '1. a|')).toBe('1. a\n2. |')
  })
  test('end of item with children: new first child', () => {
    expect(run(enter, '- a|\n\t- b')).toBe('- a\n\t- |\n\t- b')
  })
  test('with notes and children the child goes after the notes', () => {
    expect(run(enter, '- a|\n  note\n  - b')).toBe('- a\n  note\n  - |\n  - b')
  })
  test('with notes, no children: sibling goes after the notes', () => {
    expect(run(enter, '- a|\n  note')).toBe('- a\n  note\n- |')
  })
  test('empty nested item outdents', () => {
    expect(run(enter, '- a\n\t- |')).toBe('- a\n- ')
  })
  test('empty root item loses its marker', () => {
    expect(run(enter, '- a\n- |')).toBe('- a\n')
  })
  test('list heading: new item is a plain item', () => {
    expect(run(enter, '- ## T|')).toBe('- ## T\n- |')
  })
  test('cursor inside the marker, note lines, non-lists and zones fall through', () => {
    expect(run(enter, '-| a')).toBeNull()
    expect(run(enter, '- a\n  no|te')).toBeNull()
    expect(run(enter, 'plain|')).toBeNull()
    expect(run(enter, '```\n- a|\n```')).toBeNull()
  })
})

describe('shift+enter', () => {
  test('adds an aligned note line', () => {
    expect(run(shiftEnter, '- a|')).toBe('- a\n  |')
  })
  test('ordered marker width', () => {
    expect(run(shiftEnter, '10. a|')).toBe('10. a\n    |')
  })
  test('nested item', () => {
    expect(run(shiftEnter, '- a\n\t- b|')).toBe('- a\n\t- b\n\t  |')
  })
  test('note line keeps its indent', () => {
    expect(run(shiftEnter, '- a\n  no|te')).toBe('- a\n  no\n  |te')
  })
  test('outside lists falls through', () => {
    expect(run(shiftEnter, 'plain|')).toBeNull()
  })
})

describe('select all', () => {
  const sel = (text: string, from: [number, number], to = from) => {
    const r = selectAll(analyze(text), { line: from[0], col: from[1] }, { line: to[0], col: to[1] })
    return r && [r[0].line, r[0].col, r[1].line, r[1].col]
  }
  const t = '- a\n  - b\n  - c\n- d\n\n- e'
  test('first press selects the item with its children', () => {
    expect(sel(t, [0, 3])).toEqual([0, 2, 2, 5])
  })
  test('second press selects the contiguous list', () => {
    expect(sel(t, [0, 2], [2, 5])).toEqual([0, 2, 3, 3])
  })
  test('third press falls through', () => {
    expect(sel(t, [0, 2], [3, 3])).toBeNull()
  })
  test('outside a list falls through', () => {
    expect(sel('text\n- a', [0, 1])).toBeNull()
  })
})

describe('pullUpItem', () => {
  const at = (t: string, line: number) => pullUpItem(analyze(t), line)
  test('blank line above a bullet: content column of the bullet', () => {
    expect(at('\n- b', 0)).toBe(2)
    expect(at('text\n\n  - b', 1)).toBe(4)
    expect(at('x\n\n3. b', 1)).toBe(3)
  })
  test('does not apply to text above, a bullet above, or a non-list below', () => {
    expect(at('a\n- b', 0)).toBeNull()
    expect(at('- a\n- b', 0)).toBeNull()
    expect(at('\nb', 0)).toBeNull()
    expect(at('\n', 0)).toBeNull()
  })
})
