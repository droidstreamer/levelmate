import type { LineClass } from './classifier'
import { headingLevel } from './classifier'

export interface Section {
  line: number
  level: number
  /** Last line of the section, inclusive (PRD 5.2). */
  end: number
  parent: Section | null
  children: Section[]
}

/** Builds heading sections. Returns the top-level sections; `all` lists every section in document order. */
export function buildSections(lines: string[], kinds: LineClass[]): { roots: Section[]; all: Section[] } {
  const roots: Section[] = []
  const all: Section[] = []
  const stack: Section[] = []
  kinds.forEach((k, line) => {
    if (k !== 'HEADING') return
    const level = headingLevel(lines[line])
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()!.end = line - 1
    const parent = stack[stack.length - 1] ?? null
    const s: Section = { line, level, end: lines.length - 1, parent, children: [] }
    ;(parent ? parent.children : roots).push(s)
    all.push(s)
    stack.push(s)
  })
  return { roots, all }
}

export function sectionAt(all: Section[], line: number): Section | undefined {
  return all.find((s) => s.line === line)
}
