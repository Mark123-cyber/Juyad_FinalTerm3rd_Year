import { spawn, spawnSync } from 'node:child_process'

const setup = spawnSync(process.execPath, ['scripts/ensure-env.js'], { stdio: 'inherit' })
if (setup.error) {
  console.error('Could not prepare the Lost and Found environment:', setup.error)
  process.exit(1)
}
if (setup.status !== 0) process.exit(setup.status ?? 1)

async function isExistingLostAndFoundApi() {
  try {
    const response = await fetch('http://127.0.0.1:3001/api/health', {
      signal: AbortSignal.timeout(1000),
    })
    if (!response.ok) return false
    const health = await response.json()
    return health.application === 'slsu-lost-and-found'
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.cause?.code === 'ECONNREFUSED') {
      return false
    }
    throw error
  }
}

if (await isExistingLostAndFoundApi()) {
  console.log('Lost and Found API is already running on port 3001; reusing it.')
  process.exit(0)
}

const api = spawn(process.execPath, ['--env-file=.env', 'server/index.js'], { stdio: 'inherit' })
let stopping = false

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true
    if (!api.killed) api.kill('SIGTERM')
  })
}

api.on('error', (error) => {
  console.error('Could not start the Lost and Found API:', error)
  process.exitCode = 1
})

api.on('exit', (code) => {
  process.exitCode = code ?? (stopping ? 0 : 1)
})
