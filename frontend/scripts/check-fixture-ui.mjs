// Exercise the actual React tree, including its fixture label, without a browser.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const html = renderToStaticMarkup(React.createElement(App))
  assert.match(html, /class="fixture-banner" role="status">FIXTURE/)
  assert.match(html, /Not a 505 forecast/)
  assert.match(html, /505 · Broadview to Jarvis/)
  assert.match(html, /westbound/)
  assert.match(html, /id="replay-time"/)
  assert.match(html, /Assumptions behind the fixture/)
  console.log('Fixture UI renders with its warning banner, replay control and assumption metadata.')
} finally {
  await server.close()
}
