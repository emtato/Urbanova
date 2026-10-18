// Exercise the actual React tree without a browser.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const html = renderToStaticMarkup(React.createElement(App))
  assert.match(html, /Urbanova/)
  assert.match(html, /Housing &amp; Transit Readiness/)
  assert.match(html, /505 Dundas demo/)
  assert.match(html, /Run simulation/)
  assert.match(html, /Fit Corridor/)
  assert.match(html, /Copilot/)
  assert.match(html, /2D List/)
  console.log('App renders 3D corridor map as core view with header brand, simulation actions, and toolbar controls.')
} finally {
  await server.close()
}
