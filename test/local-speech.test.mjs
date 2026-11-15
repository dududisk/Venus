// Venus's local speech wiring: /stt goes to the local transcriber, /health
// reports it, and the pt-BR wake word and word lists behave.
//
// A fake transcriber stands in for whisper-server, so this needs no model, GPU
// or network. Nothing here opens an agent session.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { WAKE, afterWake, OVERRIDE, CONTINUES, norm } from '../src/lib/ptbr.ts'

const SERVER = fileURLToPath(new URL('../bridge/server.mjs', import.meta.url))

function startBridge(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, JARVIS_BRIDGE_PORT: '0', ELEVENLABS_API_KEY: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (child.kill(), reject(new Error(`bridge did not start: ${log}`))), 15_000)
    child.stdout.on('data', (d) => {
      log += d
      const m = /bridge listening on ws:\/\/\S+:(\d+)/.exec(log)
      if (!m) return
      clearTimeout(timer)
      resolve({ child, port: Number(m[1]) })
    })
    child.stderr.on('data', (d) => (log += d))
    child.on('exit', (code) => (clearTimeout(timer), reject(new Error(`bridge exited ${code}: ${log}`))))
  })
}

test('/stt forwards the audio to the local transcriber and /health says so', async () => {
  let received = null
  const fake = createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      received = { type: req.headers['content-type'], body: Buffer.concat(chunks) }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ text: ' Vênus, que horas são?\n' }))
    })
  })
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  const sttUrl = `http://127.0.0.1:${fake.address().port}/inference`

  const { child, port } = await startBridge({ JARVIS_STT_URL: sttUrl, JARVIS_EDGE_TTS_PYTHON: '' })
  try {
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
    assert.equal(health.stt, true)
    assert.equal(health.tts, false)
    assert.equal(health.label, 'Whisper local')

    const wav = Buffer.alloc(4000, 1) // over the 1200-byte "silence" floor
    const res = await fetch(`http://127.0.0.1:${port}/stt`, {
      method: 'POST',
      headers: { 'content-type': 'audio/wav' },
      body: wav,
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { text: 'Vênus, que horas são?' })
    assert.match(received.type, /^multipart\/form-data/)
    assert.ok(received.body.includes(wav), 'the audio reached the transcriber unchanged')
    assert.ok(received.body.includes('speech.wav'))
  } finally {
    child.kill()
    fake.close()
  }
})

test('without any speech engine, /stt and /tts refuse instead of calling out', async () => {
  const { child, port } = await startBridge({ JARVIS_STT_URL: '', JARVIS_EDGE_TTS_PYTHON: '' })
  try {
    const stt = await fetch(`http://127.0.0.1:${port}/stt`, { method: 'POST', body: Buffer.alloc(4000) })
    assert.equal(stt.status, 503)
    const tts = await fetch(`http://127.0.0.1:${port}/tts`, { method: 'POST', body: '{"text":"oi"}' })
    assert.equal(tts.status, 503)
  } finally {
    child.kill()
  }
})

test('an ElevenLabs key alone never sends the microphone to the cloud', async () => {
  // The key is fake and the request must be refused before any call goes out.
  const { child, port } = await startBridge({ ELEVENLABS_API_KEY: 'fake', JARVIS_STT_URL: '', JARVIS_ALLOW_CLOUD_STT: '' })
  try {
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
    assert.equal(health.stt, false)
    const stt = await fetch(`http://127.0.0.1:${port}/stt`, { method: 'POST', body: Buffer.alloc(4000) })
    assert.equal(stt.status, 503)
  } finally {
    child.kill()
  }
})

test('wake word: Venus and its near misses, with or without accent', () => {
  for (const s of ['Vênus', 'venus', 'Oi, Vênus, que horas são?', 'ei venos', 'Olá Vinus', 'bênus abre a pasta']) {
    assert.ok(WAKE.test(s), s)
  }
  for (const s of ['vem nos ajudar', 'Venusiano', 'a avenida', 'nada a ver']) {
    assert.ok(!WAKE.test(s), s)
  }
  assert.equal(afterWake('Oi, Vênus, abra a pasta de projetos.'), 'abra a pasta de projetos.')
})

test('override words cut through; bare "para" does not', () => {
  for (const s of ['pare', 'não', 'Silêncio!', 'cancela isso', 'espera aí', 'Vênus']) {
    assert.ok(OVERRIDE.test(s), s)
  }
  assert.ok(!OVERRIDE.test('marque para amanhã'))
  assert.ok(!OVERRIDE.test('nãofoi'))
})

test('unfinished sentences and accent-free comparison', () => {
  assert.ok(CONTINUES.test('e'))
  assert.ok(CONTINUES.test('até'))
  assert.ok(!CONTINUES.test('amanhã'))
  assert.equal(norm('Não, Vênus! Está ótimo.'), 'nao venus esta otimo')
})
