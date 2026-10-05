import { describe, expect, test } from 'vitest'
import { classifyLines } from '../../src/core/classifier'

const cls = (s: string) => classifyLines(s.split('\n'))

describe('line classes', () => {
  test.each([
    ['- item', 'LIST'],
    ['* item', 'LIST'],
    ['+ item', 'LIST'],
    ['1. item', 'LIST'],
    ['2) item', 'LIST'],
    ['- [ ] task', 'LIST'],
    ['  - nested', 'LIST'],
    ['-', 'LIST'],
    ['- ## Title', 'LIST_HEADING'],
    ['1. ### Title', 'LIST_HEADING'],
    ['- [x] ## Done', 'LIST_HEADING'],
    ['## Title', 'HEADING'],
    ['###### Six', 'HEADING'],
    ['   # three spaces', 'HEADING'],
    ['##', 'HEADING'],
    ['#tag', 'PLAIN'],
    ['####### seven', 'PLAIN'],
    ['plain text', 'PLAIN'],
    ['', 'PLAIN'],
    ['---', 'PLAIN'],
    ['**bold**', 'PLAIN'],
    ['*emph*', 'PLAIN'],
    ['-no space', 'PLAIN'],
  ])('%j -> %s', (text, want) => expect(cls(text)[0]).toBe(want))
})

describe('protected zones', () => {
  test('frontmatter', () => {
    expect(cls('---\ntitle: x\n# not heading\n- a\n---\n# Real')).toEqual([
      'PROTECTED', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'HEADING',
    ])
  })
  test('unclosed frontmatter is not a zone', () => {
    expect(cls('---\n# H')[1]).toBe('HEADING')
  })
  test('--- later in the file is not frontmatter', () => {
    expect(cls('# H\n---\n# H2')).toEqual(['HEADING', 'PLAIN', 'HEADING'])
  })
  test('fenced code (backticks and tildes)', () => {
    expect(cls('```js\n# c\n- x\n```\n# H')).toEqual(['PROTECTED', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'HEADING'])
    expect(cls('~~~\n# c\n~~~\n- a')).toEqual(['PROTECTED', 'PROTECTED', 'PROTECTED', 'LIST'])
  })
  test('longer fence is not closed by a shorter one', () => {
    expect(cls('````\n```\n# c\n````\n# H')).toEqual(['PROTECTED', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'HEADING'])
  })
  test('unclosed fence protects to the end', () => {
    expect(cls('```\n# c\n- a')).toEqual(['PROTECTED', 'PROTECTED', 'PROTECTED'])
  })
  test('indented fence inside a list item', () => {
    expect(cls('- a\n  ```\n  # c\n  ```\n- b')).toEqual(['LIST', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'LIST'])
  })
  test('math block', () => {
    expect(cls('$$\n# x\n- y\n$$\n# H')).toEqual(['PROTECTED', 'PROTECTED', 'PROTECTED', 'PROTECTED', 'HEADING'])
  })
  test('single-line math does not open a block', () => {
    expect(cls('$$x$$\n# H')).toEqual(['PROTECTED', 'HEADING'])
  })
  test('table', () => {
    expect(cls('| a | b |\n|---|---|\n| # x | - y |\n\n# H')).toEqual([
      'PROTECTED', 'PROTECTED', 'PROTECTED', 'PLAIN', 'HEADING',
    ])
  })
  test('table without outer pipes', () => {
    expect(cls('a | b\n--|--\n1 | 2\n- x')[3]).toBe('LIST')
    expect(cls('a | b\n--|--\n1 | 2')[2]).toBe('PROTECTED')
  })
  test('a line with a pipe but no delimiter row is not a table', () => {
    expect(cls('# a | b\n- c')).toEqual(['HEADING', 'LIST'])
  })
  test('tab-nested item and indented text after a paragraph are not code', () => {
    expect(cls('- a\n\t- b')[1]).toBe('LIST')
    expect(cls('text\n    # four spaces')[1]).toBe('PLAIN')
  })
  test('indented code block after a blank line', () => {
    expect(cls('text\n\n    # code\n    - code\n\n# H')).toEqual([
      'PLAIN', 'PLAIN', 'PROTECTED', 'PROTECTED', 'PLAIN', 'HEADING',
    ])
  })
  test('tab-indented code block', () => {
    expect(cls('text\n\n\t- code')[2]).toBe('PROTECTED')
  })
  test('deep indent inside a list is a list item, not code', () => {
    expect(cls('- a\n\n        - deep')[2]).toBe('LIST')
  })
  test('list resumes after indented code when a paragraph ends the list', () => {
    expect(cls('para\n\n- a\n\npara2\n\n    code')[6]).toBe('PROTECTED')
  })
  test('CRLF text is split by analyze, not by classifier', () => {
    expect(classifyLines('# H\r\n- a'.split(/\r?\n/))).toEqual(['HEADING', 'LIST'])
  })
})
