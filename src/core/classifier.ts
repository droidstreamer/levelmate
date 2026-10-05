import { scanZones } from './zones'

export type LineClass = 'LIST' | 'LIST_HEADING' | 'HEADING' | 'PLAIN' | 'PROTECTED'

const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/
const LIST = /^[ \t]*(?:[-*+]|\d+[.)])(?:[ \t]|$)/
const LIST_HEADING = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[.\][ \t]+)?#{1,6}(?:[ \t]|$)/

/** Classifies a line ignoring zones. Blank lines are PLAIN. */
export function classifyLine(text: string): Exclude<LineClass, 'PROTECTED'> {
  if (HEADING.test(text)) return 'HEADING'
  if (LIST_HEADING.test(text)) return 'LIST_HEADING'
  if (LIST.test(text)) return 'LIST'
  return 'PLAIN'
}

export function classifyLines(lines: string[], tabSize = 4): LineClass[] {
  const prot = scanZones(lines, tabSize)
  return lines.map((l, i) => (prot[i] ? 'PROTECTED' : classifyLine(l)))
}

/** Heading level (1-6) of a HEADING or LIST_HEADING line. */
export function headingLevel(text: string): number {
  return /#{1,6}/.exec(text)![0].length
}
