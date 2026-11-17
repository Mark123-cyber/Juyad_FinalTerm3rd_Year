import cookieParser from 'cookie-parser'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import nodemailer from 'nodemailer'
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
const smtpHost = String(process.env.SMTP_HOST || '').trim()
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpUser = String(process.env.SMTP_USER || '').trim()
const smtpPassword = String(process.env.SMTP_PASSWORD || '')
const smtpFrom = String(process.env.SMTP_FROM || '').trim()
const smtpSecureSetting = String(process.env.SMTP_SECURE || '').trim().toLowerCase()
const smtpSecure = smtpSecureSetting ? smtpSecureSetting === 'true' : smtpPort === 465

if (!adminLogin || adminLogin.length > 120 || adminPassword.length < 12 || adminPassword.length > 128) {
  throw new Error('Configure an ADMIN_USERNAME of at most 120 characters and an ADMIN_PASSWORD of 12 to 128 characters in .env.')
}
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error('SMTP_PORT must be a valid port number from 1 to 65535.')
}
if (smtpSecureSetting && smtpSecureSetting !== 'true' && smtpSecureSetting !== 'false') {
  throw new Error('SMTP_SECURE must be either true or false.')
}
if (smtpHost && !smtpFrom || !smtpHost && (smtpFrom || smtpUser || smtpPassword)) {
  throw new Error('Configure SMTP_HOST and SMTP_FROM together to enable email notifications.')
}
if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
  throw new Error('Configure both SMTP_USER and SMTP_PASSWORD, or leave both blank for an unauthenticated relay.')
}

const emailTransport = smtpHost
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
  })
  : null

if (!emailTransport) {
  console.warn('Email notifications are disabled. Configure SMTP_HOST and SMTP_FROM in .env to enable them.')
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
    created_by TEXT,
    campus TEXT NOT NULL DEFAULT 'Maasin',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed')),
    review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    claimed_at TEXT,
    claimed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('new_report', 'claimed')),
    item_type TEXT NOT NULL CHECK (item_type IN ('lost', 'found')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proof TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS claims_item_status_created
    ON claims (item_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS claims_requester_created
    ON claims (requester_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS claims_one_pending_per_requester
    ON claims (item_id, requester_id)
    WHERE status = 'pending';
`)

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(({ name }) => name))
if (!userColumns.has('student_id')) db.exec('ALTER TABLE users ADD COLUMN student_id TEXT')
if (!userColumns.has('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT')
const itemColumns = new Set(db.prepare('PRAGMA table_info(items)').all().map(({ name }) => name))
if (!itemColumns.has('campus')) db.exec("ALTER TABLE items ADD COLUMN campus TEXT NOT NULL DEFAULT 'Maasin'")
if (!itemColumns.has('status')) db.exec("ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed'))")
if (!itemColumns.has('review_status')) {
  db.exec("ALTER TABLE items ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected'))")
}
if (!itemColumns.has('claimed_at')) db.exec('ALTER TABLE items ADD COLUMN claimed_at TEXT')
if (!itemColumns.has('claimed_by')) db.exec('ALTER TABLE items ADD COLUMN claimed_by TEXT')
db.exec(`
  UPDATE items
  SET campus = COALESCE((SELECT campus FROM users WHERE users.id = items.created_by), campus)
  WHERE created_by IS NOT NULL;
`)
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
const listItems = ({ includeUnreviewed = false, reporterId = null } = {}) => db.prepare(`
  SELECT id, title, description, location, type, reporter, date, campus, status,
    review_status AS reviewStatus, claimed_at AS claimedAt,
    CASE
      WHEN ? IS NOT NULL AND type = 'found' AND status = 'open'
        AND review_status = 'approved' AND (created_by IS NULL OR created_by != ?)
      THEN 1 ELSE 0
    END AS canClaim
  FROM items
  WHERE (? = 1 OR review_status = 'approved' OR created_by = ?)
  ORDER BY date DESC, rowid DESC
`).all(reporterId, reporterId, includeUnreviewed ? 1 : 0, reporterId)
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

function requireStudent(request, response, next) {
  if (request.user?.role !== 'user') return next(new HttpError(403, 'Student account access is required.'))
  return next()
}

function withTransaction(callback) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = callback()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function createCampusNotifications(item, eventType, excludedUserId = null) {
  const recipients = db.prepare(`
    SELECT id, email FROM users
    WHERE campus = ? COLLATE NOCASE
      AND role = 'user'
      AND (? IS NULL OR id != ?)
  `).all(item.campus, excludedUserId, excludedUserId)
  const createdAt = new Date().toISOString()
  const message = eventType === 'new_report'
    ? `New ${item.type} item reported: ${item.title}`
    : `${item.type === 'lost' ? 'Lost item resolved' : 'Found item claimed'}: ${item.title}`
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, recipient_id, item_id, event_type, item_type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const recipient of recipients) {
    insertNotification.run(
      `notification-${randomUUID()}`,
      recipient.id,
      item.id,
      eventType,
      item.type,
      message,
      createdAt,
    )
  }

  return recipients.filter(({ email }) => Boolean(email))
}

async function sendEmailNotifications(recipients, item, eventType) {
  if (!emailTransport || recipients.length === 0) return
  const subject = eventType === 'new_report'
    ? `New ${item.type} item reported at ${item.campus}`
    : `${item.type === 'lost' ? 'Lost item resolved' : 'Found item claimed'} at ${item.campus}`
  const text = eventType === 'new_report'
    ? `A new ${item.type} item report has been posted at the ${item.campus} campus.\n\nItem: ${item.title}\nLocation: ${item.location}\n\nSign in to the SLSU Lost and Found portal to view the report.`
    : `Campus staff marked this ${item.type} item as claimed/resolved at the ${item.campus} campus.\n\nItem: ${item.title}\nLocation: ${item.location}\n\nSign in to the SLSU Lost and Found portal to view the report.`
  const results = await Promise.allSettled(recipients.map(({ email }) => emailTransport.sendMail({
    from: smtpFrom,
    to: email,
    subject,
    text,
  })))
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Could not deliver a lost-and-found email notification.', result.reason)
    }
  }
}

function createSession(user, response, rememberMe = false) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + sessionLifetime
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), user.id, expiresAt)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
  if (rememberMe) cookieOptions.expires = new Date(expiresAt)
  response.cookie(cookieName, token, cookieOptions)
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

app.post('/api/auth/signup', () => {
  throw new HttpError(403, 'Student accounts must be created by campus staff.')
})

app.post('/api/auth/login', loginLimiter, (request, response) => {
  const login = cleanText(request.body.emailOrStudentId)
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  const accountType = cleanText(request.body.accountType)
  const rememberMe = request.body.rememberMe === true
  if (accountType !== 'student' && accountType !== 'staff') {
    throw new HttpError(400, 'Choose Student or SSC / Admin / Registrar to sign in.')
  }
  if (login.length > 120 || password.length > 128) throw new HttpError(400, 'Email/student ID or password is too long.')
  const user = findUserByIdentifier(login)
  const validPassword = verifyPassword(password, user?.password_hash || dummyPasswordHash)
  const expectedRole = accountType === 'staff' ? 'admin' : 'user'
  if (!user || !validPassword || user.role !== expectedRole) {
    throw new HttpError(401, 'Email/student ID or password is incorrect.')
  }
  createSession(user, response, rememberMe)
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

app.get('/api/notifications', requireUser, requireStudent, (request, response) => {
  const notifications = db.prepare(`
    SELECT id, item_id AS itemId, event_type AS eventType, item_type AS itemType,
      message, created_at AS createdAt, read_at AS readAt
    FROM notifications
    WHERE recipient_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(request.user.id)
  const unreadCount = db.prepare(`
    SELECT COUNT(*) AS count FROM notifications
    WHERE recipient_id = ? AND read_at IS NULL
  `).get(request.user.id).count
  response.json({ notifications, unreadCount })
})

app.patch('/api/notifications/read-all', requireUser, requireStudent, (request, response) => {
  const readAt = new Date().toISOString()
  const result = db.prepare(`
    UPDATE notifications SET read_at = ?
    WHERE recipient_id = ? AND read_at IS NULL
  `).run(readAt, request.user.id)
  response.json({ updated: result.changes, readAt })
})

app.patch('/api/notifications/:id/read', requireUser, requireStudent, (request, response) => {
  const readAt = new Date().toISOString()
  const result = db.prepare(`
    UPDATE notifications SET read_at = COALESCE(read_at, ?)
    WHERE id = ? AND recipient_id = ?
  `).run(readAt, request.params.id, request.user.id)
  if (result.changes === 0) throw new HttpError(404, 'Notification not found.')
  const notification = db.prepare('SELECT read_at AS readAt FROM notifications WHERE id = ?').get(request.params.id)
  response.json(notification)
})

app.get('/api/items', requireUser, (request, response) => {
  response.json(listItems({
    includeUnreviewed: request.user.role === 'admin',
    reporterId: request.user.role === 'user' ? request.user.id : null,
  }))
})

app.post('/api/items', requireUser, (request, response) => {
  const submittedReporter = request.user.role === 'admin' ? cleanText(request.body.reporter) : ''
  const reporter = request.user.role === 'admin'
    ? submittedReporter || 'Anonymous (reported to staff)'
    : request.user.full_name
  const type = cleanText(request.body.type)
  const item = {
    id: `item-${randomUUID()}`,
    title: cleanText(request.body.title),
    description: cleanText(request.body.description),
    location: cleanText(request.body.location),
    type,
    reporter,
    date: new Date().toISOString().slice(0, 10),
    campus: request.user.campus,
    status: 'open',
    reviewStatus: request.user.role === 'user' && type === 'found' ? 'pending' : 'approved',
  }
  requireFields(item, ['title', 'description', 'location', 'type'])
  if (item.type !== 'lost' && item.type !== 'found') throw new HttpError(400, 'Report type must be lost or found.')
  if ([item.title, item.description, item.location].some((value) => value.length > 2000)) {
    throw new HttpError(400, 'Report fields must be 2,000 characters or fewer.')
  }
  if (submittedReporter.length > 120) throw new HttpError(400, 'Reporter name must be 120 characters or fewer.')
  let emailRecipients = []
  withTransaction(() => {
    db.prepare(`
      INSERT INTO items (id, title, description, location, type, reporter, date, created_by, campus, status, review_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.title,
      item.description,
      item.location,
      item.type,
      item.reporter,
      item.date,
      request.user.id,
      item.campus,
      item.status,
      item.reviewStatus,
    )
    if (item.reviewStatus === 'approved') {
      emailRecipients = createCampusNotifications(item, 'new_report', request.user.id)
    }
  })
  void sendEmailNotifications(emailRecipients, item, 'new_report')
    .catch((error) => console.error('Could not send new-report email notifications.', error))
  response.status(201).json(item)
})

app.get('/api/claims', requireUser, requireStudent, (request, response) => {
  const claims = db.prepare(`
    SELECT claims.id, claims.item_id AS itemId, claims.proof, claims.status,
      claims.created_at AS createdAt, claims.reviewed_at AS reviewedAt,
      items.title, items.campus
    FROM claims
    JOIN items ON items.id = claims.item_id
    WHERE claims.requester_id = ?
    ORDER BY claims.created_at DESC
    LIMIT 100
  `).all(request.user.id)
  response.json(claims)
})

app.post('/api/items/:id/claims', requireUser, requireStudent, (request, response) => {
  const proof = cleanText(request.body.proof)
  requireFields({ proof }, ['proof'])
  if (proof.length > 2000) throw new HttpError(400, 'Claim details must be 2,000 characters or fewer.')

  let claim
  withTransaction(() => {
    const item = db.prepare(`
      SELECT id, title, type, status, campus,
        review_status AS reviewStatus, created_by AS createdBy
      FROM items WHERE id = ?
    `).get(request.params.id)
    if (!item) throw new HttpError(404, 'Found-item report not found.')
    if (item.type !== 'found') throw new HttpError(400, 'Only found items can be claimed.')
    if (item.reviewStatus !== 'approved' || item.status !== 'open') {
      throw new HttpError(409, 'This found item is not currently available for claim requests.')
    }
    if (item.createdBy === request.user.id) {
      throw new HttpError(400, 'You cannot submit a claim request for your own report.')
    }

    const existingClaim = db.prepare(`
      SELECT id FROM claims WHERE item_id = ? AND requester_id = ? AND status = 'pending'
    `).get(item.id, request.user.id)
    if (existingClaim) throw new HttpError(409, 'You already have a pending request for this item.')

    claim = {
      id: `claim-${randomUUID()}`,
      itemId: item.id,
      proof,
      status: 'pending',
      createdAt: new Date().toISOString(),
      title: item.title,
      campus: item.campus,
    }
    db.prepare(`
      INSERT INTO claims (id, item_id, requester_id, proof, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(claim.id, claim.itemId, request.user.id, claim.proof, claim.status, claim.createdAt)
  })
  response.status(201).json(claim)
})

app.get('/api/admin/users', requireUser, requireAdmin, (request, response) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
  response.json(users.map((user) => ({ ...publicUser(user), isFixedAdmin: isPrimaryAdmin(user) })))
})

app.get('/api/admin/notification-settings', requireUser, requireAdmin, (request, response) => {
  response.json({ emailNotificationsEnabled: Boolean(emailTransport) })
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
  response.json(listItems({ includeUnreviewed: true }))
})

app.patch('/api/admin/items/:id/review', requireUser, requireAdmin, (request, response) => {
  const reviewStatus = cleanText(request.body.reviewStatus)
  if (reviewStatus !== 'approved' && reviewStatus !== 'rejected') {
    throw new HttpError(400, 'Choose Approve or Reject for this report.')
  }

  let item
  let emailRecipients = []
  withTransaction(() => {
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(request.params.id)
    if (!existing) throw new HttpError(404, 'Report not found.')
    if (existing.type !== 'found' || existing.review_status !== 'pending') {
      throw new HttpError(409, 'This report is not waiting for review.')
    }

    db.prepare('UPDATE items SET review_status = ? WHERE id = ?').run(reviewStatus, existing.id)
    item = {
      id: existing.id,
      title: existing.title,
      description: existing.description,
      location: existing.location,
      type: existing.type,
      reporter: existing.reporter,
      date: existing.date,
      campus: existing.campus,
      status: existing.status,
      reviewStatus,
      claimedAt: existing.claimed_at,
    }
    if (reviewStatus === 'approved') {
      emailRecipients = createCampusNotifications(item, 'new_report', existing.created_by)
    }
  })

  if (reviewStatus === 'approved') {
    void sendEmailNotifications(emailRecipients, item, 'new_report')
      .catch((error) => console.error('Could not send approved-report email notifications.', error))
  }
  response.json(item)
})

app.get('/api/admin/claims', requireUser, requireAdmin, (request, response) => {
  const claims = db.prepare(`
    SELECT claims.id, claims.item_id AS itemId, claims.proof, claims.status,
      claims.created_at AS createdAt, claims.reviewed_at AS reviewedAt,
      items.title, items.campus, users.full_name AS requesterName,
      users.student_id AS requesterStudentId, users.email AS requesterEmail
    FROM claims
    JOIN items ON items.id = claims.item_id
    JOIN users ON users.id = claims.requester_id
    ORDER BY CASE claims.status WHEN 'pending' THEN 0 ELSE 1 END, claims.created_at DESC
    LIMIT 200
  `).all()
  response.json(claims)
})

app.patch('/api/admin/claims/:id', requireUser, requireAdmin, (request, response) => {
  const status = cleanText(request.body.status)
  if (status !== 'approved' && status !== 'rejected') {
    throw new HttpError(400, 'Choose Approve or Reject for this claim.')
  }

  const reviewedAt = new Date().toISOString()
  let item
  let emailRecipients = []
  withTransaction(() => {
    const claim = db.prepare(`
      SELECT claims.id, claims.item_id AS itemId, claims.status AS claimStatus,
        items.title, items.description, items.location, items.type, items.reporter,
        items.date, items.campus, items.status AS itemStatus,
        items.review_status AS reviewStatus
      FROM claims
      JOIN items ON items.id = claims.item_id
      WHERE claims.id = ?
    `).get(request.params.id)
    if (!claim) throw new HttpError(404, 'Claim request not found.')
    if (claim.claimStatus !== 'pending') throw new HttpError(409, 'This claim request has already been reviewed.')

    if (status === 'approved' && (
      claim.type !== 'found' || claim.itemStatus !== 'open' || claim.reviewStatus !== 'approved'
    )) {
      throw new HttpError(409, 'This found item is no longer available to claim.')
    }

    db.prepare(`
      UPDATE claims SET status = ?, reviewed_at = ?, reviewed_by = ?
      WHERE id = ? AND status = 'pending'
    `).run(status, reviewedAt, request.user.id, claim.id)

    if (status === 'approved') {
      db.prepare(`
        UPDATE items SET status = 'claimed', claimed_at = ?, claimed_by = ?
        WHERE id = ? AND status = 'open'
      `).run(reviewedAt, request.user.id, claim.itemId)
      db.prepare(`
        UPDATE claims SET status = 'rejected', reviewed_at = ?, reviewed_by = ?
        WHERE item_id = ? AND id != ? AND status = 'pending'
      `).run(reviewedAt, request.user.id, claim.itemId, claim.id)

      item = {
        id: claim.itemId,
        title: claim.title,
        description: claim.description,
        location: claim.location,
        type: claim.type,
        reporter: claim.reporter,
        date: claim.date,
        campus: claim.campus,
        status: 'claimed',
        reviewStatus: claim.reviewStatus,
        claimedAt: reviewedAt,
      }
      emailRecipients = createCampusNotifications(item, 'claimed')
    }
  })

  if (status === 'approved') {
    void sendEmailNotifications(emailRecipients, item, 'claimed')
      .catch((error) => console.error('Could not send claim-approval email notifications.', error))
  }
  response.json({ id: request.params.id, status, reviewedAt })
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
  const status = request.body.status === undefined ? existing.status : cleanText(request.body.status)
  if (status !== 'open' && status !== 'claimed') throw new HttpError(400, 'Choose Open or Claimed / resolved.')
  if (status === 'claimed' && existing.review_status !== 'approved') {
    throw new HttpError(409, 'Approve the report before marking it claimed or resolved.')
  }
  const claimedAt = status === 'claimed'
    ? existing.status === 'claimed' ? existing.claimed_at : new Date().toISOString()
    : null
  const claimedBy = status === 'claimed'
    ? existing.status === 'claimed' ? existing.claimed_by : request.user.id
    : null
  const updatedItem = {
    id: existing.id,
    ...item,
    campus: existing.campus,
    status,
    reviewStatus: existing.review_status,
    claimedAt,
  }
  let emailRecipients = []
  withTransaction(() => {
    db.prepare(`
      UPDATE items SET title = ?, description = ?, location = ?, type = ?, reporter = ?, date = ?,
        status = ?, claimed_at = ?, claimed_by = ?
      WHERE id = ?
    `).run(
      item.title,
      item.description,
      item.location,
      item.type,
      item.reporter,
      item.date,
      status,
      claimedAt,
      claimedBy,
      existing.id,
    )
    if (status === 'claimed' && existing.status !== 'claimed') {
      db.prepare(`
        UPDATE claims SET status = 'rejected', reviewed_at = ?, reviewed_by = ?
        WHERE item_id = ? AND status = 'pending'
      `).run(new Date().toISOString(), request.user.id, existing.id)
      emailRecipients = createCampusNotifications(updatedItem, 'claimed')
    }
  })
  void sendEmailNotifications(emailRecipients, updatedItem, 'claimed')
    .catch((error) => console.error('Could not send claim email notifications.', error))
  response.json(updatedItem)
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
