import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cleanupStalePages } from './db.js'
import { app } from './app.js'

const PORT = Number(process.env.PORT) || 3001
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

function runCleanup(label: string) {
  const result = cleanupStalePages()
  const total = result.unfunded + result.expired + result.empty + result.claimed
  if (total > 0) {
    console.log(`[cleanup] ${label}: removed ${total} page(s)`, result)
  }
}

setInterval(() => runCleanup('scheduled'), CLEANUP_INTERVAL_MS)

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`)
})
