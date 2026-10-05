import { describe, expect, test } from 'vitest'
import { analyze } from '../../src/core/doc'
import { HeadingAction, runHeadingAction } from '../../src/core/headings'

/** Applies the result like the editor would and returns the new text. */
function run(text: string, line: number, action: HeadingAction, to = line) {
  const doc = analyze(text)
  const res = runHeadingAction(doc, line, to, action)
  if (!res) return null
  const lines = [...doc.lines]
  for (const e of [...res.edits].reverse()) {
    lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to)
  }
  return { text: lines.join('\n'), notice: res.notice }
}
const tab = (children: boolean): HeadingAction => ({ kind: 'shift', dir: 1, children })
const stab = (children: boolean): HeadingAction => ({ kind: 'shift', dir: -1, children })

describe('heading only (default)', () => {
  test('Tab demotes just the line', () => {
    expect(run('## A\n### B', 0, tab(false))!.text).toBe('### A\n### B')
  })
  test('Shift+Tab promotes just the line', () => {
    expect(run('### A\n#### B', 0, stab(false))!.text).toBe('## A\n#### B')
  })
  test('D4: H6 Tab does nothing and shows a notice', () => {
    expect(run('###### A', 0, tab(false))).toEqual({ text: '###### A', notice: 'Heading is already H6.' })
  })
  test('D5: H1 Shift+Tab stays, no notice', () => {
    expect(run('# A', 0, stab(false))).toEqual({ text: '# A', notice: undefined })
  })
  test('trailing text and cursor-independent', () => {
    expect(run('## A *b* #c', 0, tab(false))!.text).toBe('### A *b* #c')
  })
})

describe('heading + children', () => {
  test('Tab moves whole section tree, body untouched', () => {
    expect(run('## A\ntext\n### B\n# Z', 0, tab(true))!.text).toBe('### A\ntext\n#### B\n# Z')
  })
  test('siblings after the section are untouched', () => {
    expect(run('## A\n### B\n## C\n### D', 0, stab(true))!.text).toBe('# A\n## B\n## C\n### D')
  })
  test('D6 example: Shift+Tab on H1', () => {
    expect(run('# Guide\n## Setup\n### Install\n## Usage', 0, stab(true))!.text).toBe(
      '# Guide\n# Setup\n## Install\n# Usage',
    )
  })
  test('D3 example: clamp with notice', () => {
    expect(run('#### Topic\n##### Detail\n###### Note', 0, tab(true))).toEqual({
      text: '##### Topic\n###### Detail\n###### Note',
      notice: '1 heading was already H6 and stayed at H6.',
    })
  })
  test('plural notice', () => {
    expect(run('##### A\n###### B\n###### C', 0, tab(true))!.notice).toBe('2 headings were already H6 and stayed at H6.')
  })
  test('H6 target with children: nothing changes', () => {
    expect(run('###### A', 0, tab(true))).toEqual({ text: '###### A', notice: 'Heading is already H6.' })
  })
  test('headings in code blocks and list items are not children', () => {
    expect(run('## A\n```\n### x\n```\n- ### y\n### B', 0, tab(true))!.text).toBe(
      '### A\n```\n### x\n```\n- ### y\n#### B',
    )
  })
})

describe('applicability', () => {
  test.each([['plain'], ['- item'], ['```\n# x\n```'], ['#tag']])('%j falls through', (t) => {
    expect(run(t, 0, tab(false))).toBeNull()
  })
  test('list-item heading is not shifted by heading Tab (D7)', () => {
    expect(run('- ## T', 0, tab(false))).toBeNull()
  })
  test('multi-line selection shifts every heading (M5)', () => {
    expect(run('## A\n## B', 0, tab(true), 1)!.text).toBe('### A\n### B')
  })
})

describe('list-item heading commands (D8)', () => {
  const up: HeadingAction = { kind: 'shiftListHeading', dir: -1 }
  const down: HeadingAction = { kind: 'shiftListHeading', dir: 1 }
  test('demote', () => expect(run('- ## T', 0, down)!.text).toBe('- ### T'))
  test('promote keeps list position and checkbox', () => {
    expect(run('  - [ ] ### T', 0, up)!.text).toBe('  - [ ] ## T')
  })
  test('floor H1', () => expect(run('- # T', 0, up)!.text).toBe('- # T'))
  test('ceiling H6 notice', () => expect(run('1. ###### T', 0, down)!.notice).toBe('Heading is already H6.'))
  test('not applicable on a real heading', () => expect(run('## T', 0, down)).toBeNull())
})

describe('remove heading (D10)', () => {
  const rm: HeadingAction = { kind: 'remove' }
  test('single line', () => expect(run('### Title\n#### Kid', 0, rm)!.text).toBe('Title\n#### Kid'))
  test('selection strips every heading line, leaves other lines', () => {
    expect(run('## A\nbody\n### B\n- ## C', 0, rm, 3)!.text).toBe('A\nbody\nB\n- C')
  })
  test('empty heading', () => expect(run('##', 0, rm)!.text).toBe(''))
  test('no heading in range', () => expect(run('text', 0, rm)).toBeNull())
})

test('CRLF document', () => {
  const doc = analyze('## A\r\n### B\r\n')
  const res = runHeadingAction(doc, 0, 0, tab(true))!
  expect(res.edits).toEqual([
    { line: 0, from: 2, to: 2, insert: '#' },
    { line: 1, from: 3, to: 3, insert: '#' },
  ])
})
