import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function honoDevPlugin(): Plugin {
  return {
    name: 'hono-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        try {
          const mod = await server.ssrLoadModule('/src/server/index.ts')
          const app = mod.default

          const protocol = req.headers['x-forwarded-proto'] || 'http'
          const host = req.headers.host || 'localhost:3001'
          const fullUrl = new URL(req.url, `${protocol}://${host}`)

          let body: Buffer | undefined
          if (!['GET', 'HEAD'].includes(req.method?.toUpperCase() || 'GET')) {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }
            if (chunks.length > 0) {
              body = Buffer.concat(chunks)
            }
          }

          const headers = new Headers()
          for (const [key, val] of Object.entries(req.headers)) {
            if (val !== undefined) {
              if (Array.isArray(val)) {
                val.forEach((v) => headers.append(key, v))
              } else {
                headers.set(key, val)
              }
            }
          }

          const webRequest = new Request(fullUrl.toString(), {
            method: req.method || 'GET',
            headers,
            body: body ? (new Uint8Array(body) as unknown as BodyInit) : undefined,
            // @ts-ignore
            duplex: 'half',
          })

          const env = {
            ENVIRONMENT: 'development',
            HUB_NAME: 'Chatze Hub Gateway (Nepal)',
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
            JWT_SECRET: process.env.JWT_SECRET || 'chatze-hub-dev-jwt-secret-local',
          }

          const webResponse = await app.fetch(webRequest, env)

          res.statusCode = webResponse.status
          webResponse.headers.forEach((val: string, key: string) => {
            res.setHeader(key, val)
          })

          const arrayBuffer = await webResponse.arrayBuffer()
          res.end(Buffer.from(arrayBuffer))
        } catch (err: any) {
          console.error('[Hono Dev Middleware Error]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Internal dev server error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    honoDevPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname || process.cwd(), './src'),
    },
  },
  build: {
    cssMinify: 'esbuild',
  },
  server: {
    port: 3001,
  },
})
