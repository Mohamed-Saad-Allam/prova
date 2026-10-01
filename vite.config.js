import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { synthesizeSpeech } from './api/text-to-speech.js'

function ttsDevServerPlugin() {
  return {
    name: 'tts-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api/text-to-speech' || req.url.startsWith('/api/text-to-speech?'))) {
          // CORS
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end()
            return
          }

          try {
            let bodyData = ''
            if (req.method === 'POST') {
              for await (const chunk of req) {
                bodyData += chunk
              }
            }

            let parsed = {}
            if (bodyData) {
              try {
                parsed = JSON.parse(bodyData)
              } catch (_e) {}
            }

            const urlObj = new URL(req.url, 'http://localhost:5173')
            const text = parsed.text || urlObj.searchParams.get('text')
            const lang = parsed.lang || urlObj.searchParams.get('lang') || 'ar-EG'
            const voice = parsed.voice || urlObj.searchParams.get('voice')
            const engine = parsed.engine || urlObj.searchParams.get('engine')
            const cartesiaApiKey = parsed.cartesiaApiKey || req.headers?.['x-cartesia-key'] || urlObj.searchParams.get('cartesiaApiKey')

            if (!text || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Text is required' }))
              return
            }

            const audioBuffer = await synthesizeSpeech({ text, lang, voice, engine, cartesiaApiKey })
            const isWav = Buffer.isBuffer(audioBuffer) && audioBuffer.slice(0, 4).toString('ascii') === 'RIFF'
            res.statusCode = 200
            res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg')
            res.setHeader('Content-Length', audioBuffer.length)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(audioBuffer)
          } catch (err) {
            console.error('Vite TTS dev middleware error:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to synthesize speech', details: err.message }))
          }
          return
        }

        if (req.url && req.url.startsWith('/api/format-cv-step')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end()
            return
          }

          try {
            let bodyData = ''
            for await (const chunk of req) {
              bodyData += chunk
            }
            const { prompt } = JSON.parse(bodyData || '{}')
            const { formatCvStepWithGemini } = await import('./api/format-cv-step.js')
            const rawText = await formatCvStepWithGemini(prompt)
            let parsed = null
            const match = rawText.match(/\{[\s\S]*\}/)
            if (match) {
              try { parsed = JSON.parse(match[0]) } catch (_e) {}
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ parsed, rawText }))
          } catch (err) {
            console.error('Vite format-cv-step error:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        if (req.url && req.url.startsWith('/api/ats-score')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key')

          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end()
            return
          }

          try {
            let bodyData = ''
            for await (const chunk of req) {
              bodyData += chunk
            }
            const body = JSON.parse(bodyData || '{}')
            const customApiKey = req.headers?.['x-gemini-key'] || body.customApiKey
            const { calculateAtsScore } = await import('./api/ats-score.js')
            const result = await calculateAtsScore({
              cv_text: body.cv_text,
              job_description: body.job_description,
              cv_id: body.cv_id,
              lang: body.lang || 'ar',
              customApiKey,
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (err) {
            console.error('Vite ats-score error:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      tailwindcss(),
      ttsDevServerPlugin(),
    ],
  server: {
    watch: {
      ignored: ['**/*.mp4', '**/*.mkv', '**/*.mov', '**/*.webm', '**/*.glb', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.pdf'],
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/@fortawesome')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  };
});

