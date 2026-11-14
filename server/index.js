import cookieParser from 'cookie-parser'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(serverDirectory, '..')
const databasePath = resolve(projectDirectory, process.env.DB_PATH || 'server/data/lost-and-found.sqlite')
const adminLogin = String(process.env.ADMIN_USERNAME || '').trim()
const adminPassword = String(process.env.ADMIN_PASSWORD || '')
const sessionLifetime = 7 * 24 * 60 * 60 * 1000
const cookieName = 'slsu_session'

if (!adminLogin || adminLogin.length > 120 || adminPassword.length < 12 || adminPassword.length > 128) {
  throw new Error('Configure an ADMIN_USERNAME of at most 120 characters and an ADMIN_PASSWORD of 12 to 128 characters in .env.')
}

mkdirSync(dirname(databasePath), { recursive: true })
export const db = new DatabaseSync(databasePath)
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS campuses (
    name TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    login TEXT NOT NULL COLLATE NOCASE UNIQUE,
    student_id TEXT,
    email TEXT,
    campus TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
    reporter TEXT NOT NULL,
    date TEXT NOT NULL,
    created_by TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`)

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(({ name }) => name))
if (!userColumns.has('student_id')) db.exec('ALTER TABLE users ADD COLUMN student_id TEXT')
if (!userColumns.has('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT')
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_unique
  ON users (student_id COLLATE NOCASE)
  WHERE student_id IS NOT NULL AND student_id <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (email COLLATE NOCASE)
  WHERE email IS NOT NULL AND email <> '';
`)

const defaultCampuses = ['San Juan', 'Hinunangan', 'Sogod', 'Bontoc', 'Maasin']
const insertCampus = db.prepare('INSERT OR IGNORE INTO campuses (name) VALUES (?)')
for (const campus of defaultCampuses) insertCampus.run(campus)

const hashPassword = (password) => {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'))

const verifyPassword = (password, storedHash) => {
  const [saltHex, hashHex] = storedHash.split(':')
  if (!saltHex || !hashHex) return false
  const expectedHash = Buffer.from(hashHex, 'hex')
  const actualHash = scryptSync(password, Buffer.from(saltHex, 'hex'), expectedHash.length)
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
}

const primaryAdmin = db.prepare('SELECT id FROM users WHERE login = ? COLLATE NOCASE').get(adminLogin)
if (primaryAdmin) {
  db.prepare(`
    UPDATE users SET role = 'admin', password_hash = ?, full_name = 'System Administrator'
    WHERE id = ?
  `).run(hashPassword(adminPassword), primaryAdmin.id)
} else {
  db.prepare(`
    INSERT INTO users (id, full_name, login, campus, role, password_hash, created_at)
    VALUES (?, 'System Administrator', ?, 'Maasin', 'admin', ?, ?)
  `).run(`user-${randomUUID()}`, adminLogin, hashPassword(adminPassword), new Date().toISOString())
}

if (db.prepare('SELECT COUNT(*) AS count FROM items').get().count === 0) {
  const insertItem = db.prepare(`
    INSERT INTO items (id, title, description, location, type, reporter, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insertItem.run('seed-1', 'Black Samsung Galaxy S21', 'Left in the CCW Building lobby after a lab session. Dark case, small crack on screen.', 'CCW Building, 2nd Floor Lobby', 'lost', 'Juan Dela Cruz', '2026-11-10')
  insertItem.run('seed-2', 'Set of USB-C Cables', 'Two braided USB-C charging cables found near the library entrance.', 'SLSU Library, Main Entrance', 'found', 'Maria Santos', '2026-11-11')
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 'loopback')
app.use('/api', (request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.use((request, response, next) => {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  next()
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const publicUser = (user) => ({
  id: user.id,
  fullName: user.full_name,
  login: user.login,
  studentId: user.student_id || '',
  email: user.email || '',
  campus: user.campus,
  role: user.role,
  createdAt: user.created_at,
})

const findUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id)
const findUserByIdentifier = (identifier) => db.prepare(`
  SELECT * FROM users
  WHERE login = ? COLLATE NOCASE
    OR student_id = ? COLLATE NOCASE
    OR email = ? COLLATE NOCASE
  LIMIT 1
`).get(identifier, identifier, identifier)
const findIdentityConflict = (login, studentId, email, excludedId = null) => db.prepare(`
  SELECT id FROM users
  WHERE (login = ? COLLATE NOCASE OR student_id = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)
    AND (? IS NULL OR id != ?)
  LIMIT 1
`).get(login, studentId, email, excludedId, excludedId)
const listItems = () => db.prepare('SELECT id, title, description, location, type, reporter, date FROM items ORDER BY date DESC, rowid DESC').all()
const cleanText = (value) => typeof value === 'string' ? value.trim() : ''
const studentIdPattern = /^[A-Z0-9][A-Z0-9-]{2,31}$/

function parseStudentId(value) {
  const studentId = cleanText(value).toUpperCase()
  if (!studentIdPattern.test(studentId)) {
    throw new HttpError(400, 'Student ID must be 3 to 32 characters and contain only letters, numbers, or hyphens.')
  }
  return studentId
}

function parseEmail(value) {
  const email = cleanText(value).toLowerCase()
  if (!email) return null
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address of 120 characters or fewer.')
  }
  return email
}

function requireUser(request, response, next) {
  const token = request.cookies[cookieName]
  if (!token) return next(new HttpError(401, 'Please sign in to continue.'))

  const session = db.prepare(`
    SELECT users.* FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(createHash('sha256').update(token).digest('hex'), Date.now())

  if (!session) return next(new HttpError(401, 'Your session has expired. Please sign in again.'))
  request.user = session
  return next()
}

function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') return next(new HttpError(403, 'Administrator access is required.'))
  return next()
}

function createSession(user, response) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + sessionLifetime
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), user.id, expiresAt)
  response.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  })
}

function requireFields(values, fields) {
  if (fields.some((field) => !values[field])) {
    throw new HttpError(400, 'Please complete all required fields.')
  }
}

const campusExists = (campus) => Boolean(db.prepare('SELECT 1 FROM campuses WHERE name = ?').get(campus))
const isPrimaryAdmin = (user) => user.login.toLowerCase() === adminLogin.toLowerCase()

app.get('/api/health', (request, response) => {
  response.json({ application: 'slsu-lost-and-found', status: 'ok' })
})

app.get('/api/campuses', (request, response) => {
  response.json(db.prepare('SELECT name FROM campuses ORDER BY rowid').all().map(({ name }) => name))
})

app.post('/api/auth/signup', loginLimiter, (request, response) => {
  const fullName = cleanText(request.body.fullName)
  const studentId = parseStudentId(request.body.studentId)
  const email = parseEmail(request.body.email)
  const login = email || studentId
  const campus = cleanText(request.body.campus)
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  requireFields({ fullName, login, campus, password }, ['fullName', 'login', 'campus', 'password'])
  if (fullName.length > 120) throw new HttpError(400, 'Name must be 120 characters or fewer.')
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'Password must be between 8 and 128 characters.')
  if (!campusExists(campus)) throw new HttpError(400, 'Choose one of the available campuses.')
  if (findIdentityConflict(login, studentId, email)) throw new HttpError(409, 'An account with that Student ID or email already exists.')

  const user = {
    id: `user-${randomUUID()}`,
    full_name: fullName,
    login,
    student_id: studentId,
    email,
    campus,
    role: 'user',
    created_at: new Date().toISOString(),
  }
  db.prepare(`
    INSERT INTO users (id, full_name, login, student_id, email, campus, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?)
  `).run(user.id, user.full_name, user.login, user.student_id, user.email, user.campus, hashPassword(password), user.created_at)
  createSession(user, response)
  response.status(201).json({ user: publicUser(user) })
})

app.post('/api/auth/login', loginLimiter, (request, response) => {
  const login = cleanText(request.body.emailOrStudentId)
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  if (login.length > 120 || password.length > 128) throw new HttpError(400, 'Email/student ID or password is too long.')
  const user = findUserByIdentifier(login)
  const validPassword = verifyPassword(password, user?.password_hash || dummyPasswordHash)
  if (!user || !validPassword) {
    throw new HttpError(401, 'Email/student ID or password is incorrect.')
  }
  createSession(user, response)
  response.json({ user: publicUser(user) })
})

app.get('/api/auth/me', (request, response, next) => {
  requireUser(request, response, (error) => {
    if (error?.status === 401) return response.json({ user: null })
    if (error) return next(error)
    return response.json({ user: publicUser(request.user) })
  })
})

app.post('/api/auth/logout', (request, response) => {
  const token = request.cookies[cookieName]
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .run(createHash('sha256').update(token).digest('hex'))
  }
  response.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  response.status(204).end()
})

app.get('/api/items', requireUser, (request, response) => {
  response.json(listItems())
})

app.post('/api/items', requireUser, (request, response) => {
  const item = {
    id: `item-${randomUUID()}`,
    title: cleanText(request.body.title),
    description: cleanText(request.body.description),
    location: cleanText(request.body.location),
    type: cleanText(request.body.type),
    reporter: request.user.full_name,
    date: new Date().toISOString().slice(0, 10),
  }
  requireFields(item, ['title', 'description', 'location', 'type'])
  if (item.type !== 'lost' && item.type !== 'found') throw new HttpError(400, 'Report type must be lost or found.')
  if ([item.title, item.description, item.location].some((value) => value.length > 2000)) {
    throw new HttpError(400, 'Report fields must be 2,000 characters or fewer.')
  }
  db.prepare(`
    INSERT INTO items (id, title, description, location, type, reporter, date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.title, item.description, item.location, item.type, item.reporter, item.date, request.user.id)
  response.status(201).json(item)
})

app.get('/api/admin/users', requireUser, requireAdmin, (request, response) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
  response.json(users.map((user) => ({ ...publicUser(user), isFixedAdmin: isPrimaryAdmin(user) })))
})

app.post('/api/admin/users', requireUser, requireAdmin, (request, response) => {
  const fullName = cleanText(request.body.fullName)
  const studentId = parseStudentId(request.body.studentId)
  const email = parseEmail(request.body.email)
  const login = email || studentId
  const campus = cleanText(request.body.campus)
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  const role = cleanText(request.body.role)
  requireFields({ fullName, login, campus, password }, ['fullName', 'login', 'campus', 'password'])
  if (fullName.length > 120) throw new HttpError(400, 'Name must be 120 characters or fewer.')
  if (role !== 'admin' && role !== 'user') throw new HttpError(400, 'Choose a valid user role.')
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'Password must be between 8 and 128 characters.')
  if (!campusExists(campus)) throw new HttpError(400, 'Choose one of the available campuses.')
  if (findIdentityConflict(login, studentId, email)) throw new HttpError(409, 'An account with that Student ID or email already exists.')
  const user = {
    id: `user-${randomUUID()}`,
    full_name: fullName,
    login,
    student_id: studentId,
    email,
    campus,
    role,
    created_at: new Date().toISOString(),
  }
  db.prepare(`
    INSERT INTO users (id, full_name, login, student_id, email, campus, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.full_name, user.login, user.student_id, user.email, user.campus, user.role, hashPassword(password), user.created_at)
  response.status(201).json(publicUser(user))
})

app.patch('/api/admin/users/:id', requireUser, requireAdmin, (request, response) => {
  const target = findUser(request.params.id)
  if (!target) throw new HttpError(404, 'User account not found.')
  const fixedAdmin = isPrimaryAdmin(target)
  const fullName = cleanText(request.body.fullName)
  const studentId = fixedAdmin ? target.student_id : parseStudentId(request.body.studentId)
  const email = fixedAdmin ? target.email : parseEmail(request.body.email)
  const login = fixedAdmin ? target.login : email || studentId
  const campus = cleanText(request.body.campus)
  const role = cleanText(request.body.role)
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  requireFields({ fullName, login, campus }, ['fullName', 'login', 'campus'])
  if (fullName.length > 120) throw new HttpError(400, 'Name must be 120 characters or fewer.')
  if (role !== 'admin' && role !== 'user') throw new HttpError(400, 'Choose a valid user role.')
  if (!campusExists(campus)) throw new HttpError(400, 'Choose one of the available campuses.')
  if (password && (password.length < 8 || password.length > 128)) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters.')
  }
  if (fixedAdmin && (role !== 'admin' || password)) {
    throw new HttpError(400, 'The fixed administrator login, role, and password are controlled by the local .env file.')
  }
  if (findIdentityConflict(login, studentId, email, target.id)) {
    throw new HttpError(409, 'An account with that Student ID or email already exists.')
  }
  const passwordHash = password ? hashPassword(password) : target.password_hash
  db.prepare(`
    UPDATE users SET full_name = ?, login = ?, student_id = ?, email = ?, campus = ?, role = ?, password_hash = ?
    WHERE id = ?
  `).run(fullName, login, studentId, email, campus, role, passwordHash, target.id)
  if (password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id)
  response.json(publicUser(findUser(target.id)))
})

app.delete('/api/admin/users/:id', requireUser, requireAdmin, (request, response) => {
  const target = findUser(request.params.id)
  if (!target) throw new HttpError(404, 'User account not found.')
  if (target.id === request.user.id) throw new HttpError(400, 'You cannot remove your own account while signed in.')
  if (isPrimaryAdmin(target)) throw new HttpError(400, 'The fixed administrator account cannot be removed.')
  if (target.role === 'admin' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count <= 1) {
    throw new HttpError(400, 'At least one administrator account must remain.')
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  response.status(204).end()
})

app.get('/api/admin/items', requireUser, requireAdmin, (request, response) => {
  response.json(listItems())
})

app.patch('/api/admin/items/:id', requireUser, requireAdmin, (request, response) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(request.params.id)
  if (!existing) throw new HttpError(404, 'Report not found.')
  const item = {
    title: cleanText(request.body.title),
    description: cleanText(request.body.description),
    location: cleanText(request.body.location),
    type: cleanText(request.body.type),
    reporter: cleanText(request.body.reporter),
    date: cleanText(request.body.date),
  }
  requireFields(item, ['title', 'description', 'location', 'type', 'reporter', 'date'])
  if (item.type !== 'lost' && item.type !== 'found') throw new HttpError(400, 'Report type must be lost or found.')
  db.prepare(`
    UPDATE items SET title = ?, description = ?, location = ?, type = ?, reporter = ?, date = ?
    WHERE id = ?
  `).run(item.title, item.description, item.location, item.type, item.reporter, item.date, existing.id)
  response.json({ id: existing.id, ...item })
})

app.delete('/api/admin/items/:id', requireUser, requireAdmin, (request, response) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(request.params.id)
  if (result.changes === 0) throw new HttpError(404, 'Report not found.')
  response.status(204).end()
})

app.post('/api/admin/campuses', requireUser, requireAdmin, (request, response) => {
  const name = cleanText(request.body.name)
  requireFields({ name }, ['name'])
  if (name.length > 100) throw new HttpError(400, 'Campus name must be 100 characters or fewer.')
  if (db.prepare('SELECT 1 FROM campuses WHERE name = ? COLLATE NOCASE').get(name)) {
    throw new HttpError(409, 'That campus already exists.')
  }
  db.prepare('INSERT INTO campuses (name) VALUES (?)').run(name)
  response.status(201).json({ name })
})

app.delete('/api/admin/campuses/:name', requireUser, requireAdmin, (request, response) => {
  const name = request.params.name
  if (!db.prepare('SELECT 1 FROM campuses WHERE name = ?').get(name)) throw new HttpError(404, 'Campus not found.')
  if (db.prepare('SELECT 1 FROM users WHERE campus = ? LIMIT 1').get(name)) {
    throw new HttpError(409, 'This campus is assigned to one or more users. Update their campus before removing it.')
  }
  db.prepare('DELETE FROM campuses WHERE name = ?').run(name)
  response.status(204).end()
})

app.use('/api', (request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(projectDirectory, 'dist')))
  app.get('*path', (request, response) => response.sendFile(resolve(projectDirectory, 'dist/index.html')))
}

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  const status = Number.isInteger(error.status) ? error.status : 500
  if (status >= 500) console.error(error)
  response.status(status).json({ error: status >= 500 ? 'A server error occurred. Please try again.' : error.message })
})

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001)
  app.listen(port, '0.0.0.0', () => {
    console.log(`Lost and Found API listening on http://0.0.0.0:${port}`)
    console.log(`SQLite database: ${databasePath}`)
  })
}

export default app
