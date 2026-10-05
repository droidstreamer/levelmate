import { expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'
import { itemAt } from '../../src/core/listTree'

const shape = (t: string) => analyze(t).lists.all.map((i) => [i.line, i.end, i.parent?.line ?? -1])

test('nesting by indent', () => {
  expect(shape('- a\n  - b\n    - c\n  - d\n- e')).toEqual([[0, 3, -1], [1, 2, 0], [2, 2, 1], [3, 3, 0], [4, 4, -1]])
})

test('tab and space indentation are equivalent', () => {
  expect(shape('- a\n\t- b\n- c')).toEqual(shape('- a\n    - b\n- c'))
})

test('ordered and task items mix', () => {
  expect(shape('1. a\n   - [ ] b\n2. c')).toEqual([[0, 1, -1], [1, 1, 0], [2, 2, -1]])
})

test('note lines belong to their item', () => {
  const { lists } = analyze('- a\n  note\n  - b\n- c')
  expect(lists.all.map((i) => [i.line, i.end])).toEqual([[0, 2], [2, 2], [3, 3]])
  expect(itemAt(lists.all, 1)?.line).toBe(0)
})

test('dedented note still belongs to outer item', () => {
  const { lists } = analyze('- a\n    - b\n  note')
  expect(lists.all.map((i) => [i.line, i.end])).toEqual([[0, 2], [1, 1]])
})

test('blank line ends the block', () => {
  expect(shape('- a\n\n- b')).toEqual([[0, 0, -1], [2, 2, -1]])
  expect(shape('- a\n\n  - b')[1]).toEqual([2, 2, -1])
})

test('plain paragraph ends the block', () => {
  expect(shape('- a\ntext\n  - b')).toEqual([[0, 0, -1], [2, 2, -1]])
})

test('indented code fence inside an item is part of it', () => {
  const { lists } = analyze('- a\n  ```\n  # x\n  ```\n- b')
  expect(lists.all.map((i) => [i.line, i.end])).toEqual([[0, 3], [4, 4]])
})

test('LIST_HEADING is an item', () => {
  expect(shape('- ## T\n  - x')).toEqual([[0, 1, -1], [1, 1, 0]])
})

test('itemAt returns the deepest item', () => {
  const { lists } = analyze('- a\n  - b\n    note')
  expect(itemAt(lists.all, 2)?.line).toBe(1)
  expect(itemAt(lists.all, 5)).toBeUndefined()
})

test('list inside frontmatter or code is ignored', () => {
  expect(shape('---\n- a\n---\n```\n- b\n```')).toEqual([])
})
