import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
}

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PATCH = handler
export const OPTIONS = handler
