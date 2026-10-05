import tseslint from 'typescript-eslint'

const nodeBuiltins = { group: ['node:*', 'fs', 'path', 'os', 'child_process', 'crypto', 'http', 'https', 'net', 'electron'], message: 'No Node.js or Electron APIs in src.' }

export default tseslint.config(
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [nodeBuiltins] }] } },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [nodeBuiltins, { group: ['obsidian', '@codemirror/*', '../editor/*', '../../editor/*', '../settings*'], message: 'src/core is pure TypeScript: no Obsidian or CodeMirror imports.' }] }],
    },
  },
  { rules: { 'no-restricted-syntax': ['error', { selector: "MemberExpression[property.name='innerHTML']", message: 'No innerHTML: render text with createEl.' }] } },
)
