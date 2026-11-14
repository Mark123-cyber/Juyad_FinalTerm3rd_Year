import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
const envExists = existsSync(envPath)
let contents = envExists ? await (await import('node:fs/promises')).readFile(envPath, 'utf8') : ''

function readValue(name) {
  const match = contents.match(new RegExp(`^${name}\\s*=\\s*(.*)$`, 'm'))
  if (!match) return ''
  return match[1].trim().replace(/^(["'])(.*)\1$/, '$2')
}

function writeValue(name, value) {
  const pattern = new RegExp(`^${name}\\s*=.*$`, 'm')
  if (pattern.test(contents)) {
    contents = contents.replace(pattern, `${name}=${value}`)
  } else {
    contents = `${contents.trimEnd()}${contents.trim() ? '\n' : ''}${name}=${value}\n`
  }
}

let createdPassword = false
if (!readValue('ADMIN_USERNAME')) writeValue('ADMIN_USERNAME', 'admin')

let password = readValue('ADMIN_PASSWORD')
if (!password) {
  password = randomBytes(24).toString('base64url')
  writeValue('ADMIN_PASSWORD', password)
  createdPassword = true
}

if (password.length < 12 || password.length > 128) {
  throw new Error('ADMIN_PASSWORD in .env must contain between 12 and 128 characters.')
}

if (readValue('ADMIN_USERNAME').length > 120) {
  throw new Error('ADMIN_USERNAME in .env must be at most 120 characters.')
}

if (!envExists) {
  writeFileSync(envPath, contents, { flag: 'wx', mode: 0o600 })
} else if (createdPassword || !contents.endsWith('\n')) {
  writeFileSync(envPath, contents.endsWith('\n') ? contents : `${contents}\n`)
}

if (createdPassword) {
  console.log('Created .env with a private administrator password. Open .env to view or change the credentials.')
}
