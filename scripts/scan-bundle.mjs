// Fails the build if the bundle can reach the network or run dynamic code (PRD section 8).
import { readFileSync } from 'node:fs'

// The one allowed URL is the coffee link in Preferences: a link the user clicks, never requested by the plugin.
const code = readFileSync('dist/main.js', 'utf8').replaceAll('https://buymeacoffee.com', '')
const banned = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'sendBeacon'],
  [/\brequestUrl\b/, 'Obsidian requestUrl'],
  [/(?<![.\w])eval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/\bimportScripts\b/, 'importScripts'],
  [/https?:\/\//, 'URL'],
]
const problems = banned.filter(([re]) => re.test(code)).map(([, name]) => `uses ${name}`)
const kb = (code.length / 1024).toFixed(1)
if (problems.length) {
  console.error(`scan-bundle: FAILED (${kb} KB)\n  ` + problems.join('\n  '))
  process.exit(1)
}
console.log(`scan-bundle: clean, no network or dynamic-code calls (${kb} KB)`)
