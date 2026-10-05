import { expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'

test('PRD 5.2 example', () => {
  const { sections } = analyze('## Setup\ntext\n### Install\nmore\n### Config\n## Usage')
  const [setup, usage] = sections.roots
  expect([setup.line, setup.end]).toEqual([0, 4])
  expect(setup.children.map((c) => [c.line, c.end])).toEqual([[2, 3], [4, 4]])
  expect([usage.line, usage.end]).toEqual([5, 5])
})

test('higher level heading closes deeper ones; parent is nearest shallower', () => {
  const { sections } = analyze('# A\n### B\n## C\n# D')
  const [a, d] = sections.roots
  expect(a.children.map((s) => s.line)).toEqual([1, 2])
  expect(a.end).toBe(2)
  expect(d.line).toBe(3)
  expect(sections.all[1].parent).toBe(a)
})

test('headings in protected zones and lists are not sections', () => {
  const { sections } = analyze('# A\n```\n# no\n```\n- ## no\n#tag\n## B')
  expect(sections.all.map((s) => s.line)).toEqual([0, 6])
})

test('body before the first heading belongs to no section', () => {
  const { sections } = analyze('intro\n# A\nx')
  expect(sections.roots).toHaveLength(1)
  expect(sections.roots[0].end).toBe(2)
})

test('CRLF', () => {
  expect(analyze('# A\r\nx\r\n## B\r\n').sections.all).toHaveLength(2)
})

test('no headings', () => {
  expect(analyze('').sections.all).toEqual([])
})
