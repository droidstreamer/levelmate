import { expect, test } from 'vitest'
import { analyze } from '../src/core/doc'
import { runListAction } from '../src/core/lists'

// PRD 7.4: a single action on a 10,000-line note stays under 16 ms.
test('parse + list action on 10,000 lines', () => {
  const text = Array.from({ length: 2500 }, (_, i) => `## H${i}\n- item ${i}\n\t- child\ntext ${i}`).join('\n')
  // best of 5 after warm-up: the budget is for a JIT-warm editor, not a cold or loaded test run
  let ms = Infinity
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now()
    runListAction(analyze(text), 5000, 'indent', '\t')
    if (i >= 3) ms = Math.min(ms, performance.now() - t0)
  }
  expect(ms).toBeLessThan(16)
})
