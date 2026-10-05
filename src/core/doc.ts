import { classifyLines } from './classifier'
import { buildLists } from './listTree'
import { buildSections } from './sectionTree'

/** Parses note text once into lines, classes, list items and heading sections. */
export function analyze(text: string, tabSize = 4) {
  const lines = text.split(/\r?\n/)
  const kinds = classifyLines(lines, tabSize)
  return { lines, kinds, lists: buildLists(lines, kinds, tabSize), sections: buildSections(lines, kinds) }
}
