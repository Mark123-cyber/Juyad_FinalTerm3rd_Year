import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'slsu-lost-and-found-'))
process.env.DB_PATH = join(temporaryDirectory, 'test.sqlite')
process.env.ADMIN_USERNAME = 'test-admin'
process.env.ADMIN_PASSWORD = 'test-admin-password-12345'
process.env.NODE_ENV = 'test'

const { default: app, db } = await import('./index.js')
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return {
    response,
    payload: response.status === 204 ? null : await response.json(),
    cookie: response.headers.getSetCookie()?.[0]?.split(';')[0],
  }
}

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('accounts, roles, reports, and campus choices are persisted and protected', async () => {
  const campuses = await request('/api/campuses')
  assert.deepEqual(campuses.payload, ['San Juan', 'Hinunangan', 'Sogod', 'Bontoc', 'Maasin'])

  const blockedItems = await request('/api/items')
  assert.equal(blockedItems.response.status, 401)

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Sample Student',
      studentId: 'SLSU-2026-00123',
      email: 'sample.student@example.com',
      campus: 'Sogod',
      password: 'student-password-123',
    },
  })
  assert.equal(signup.response.status, 201)
  assert.equal(signup.payload.user.role, 'user')
  assert.equal(signup.payload.user.studentId, 'SLSU-2026-00123')
  assert.equal(signup.payload.user.email, 'sample.student@example.com')
  assert.equal('password' in signup.payload.user, false)

  const studentIdLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { emailOrStudentId: 'slsu-2026-00123', password: 'student-password-123' },
  })
  assert.equal(studentIdLogin.response.status, 200)

  const emailLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { emailOrStudentId: 'SAMPLE.STUDENT@example.com', password: 'student-password-123' },
  })
  assert.equal(emailLogin.response.status, 200)

  const duplicateStudentId = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Duplicate Student',
      studentId: 'slsu-2026-00123',
      campus: 'Sogod',
      password: 'another-password',
    },
  })
  assert.equal(duplicateStudentId.response.status, 409)

  const invalidStudentId = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Invalid Student ID',
      studentId: 'ID WITH SPACES',
      campus: 'Sogod',
      password: 'another-password',
    },
  })
  assert.equal(invalidStudentId.response.status, 400)

  const deniedAdminPage = await request('/api/admin/users', { cookie: signup.cookie })
  assert.equal(deniedAdminPage.response.status, 403)

  const report = await request('/api/items', {
    method: 'POST',
    cookie: signup.cookie,
    body: {
      title: 'Water bottle',
      description: 'Blue metal bottle',
      location: 'Library',
      type: 'lost',
    },
  })
  assert.equal(report.response.status, 201)
  assert.equal(report.payload.reporter, 'Sample Student')

  const invalidCampus = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Invalid Campus',
      studentId: 'other-123',
      campus: 'Not a campus',
      password: 'another-password',
    },
  })
  assert.equal(invalidCampus.response.status, 400)

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { emailOrStudentId: 'test-admin', password: 'test-admin-password-12345' },
  })
  assert.equal(adminLogin.response.status, 200)
  const adminUsers = await request('/api/admin/users', { cookie: adminLogin.cookie })
  assert.equal(adminUsers.response.status, 200)
  assert.equal(adminUsers.payload.find((user) => user.login === 'test-admin').isFixedAdmin, true)

  const adminCreatedUser = await request('/api/admin/users', {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: {
      fullName: 'Admin Created Student',
      studentId: 'SLSU-2026-00222',
      email: 'created.student@example.com',
      campus: 'Sogod',
      role: 'user',
      password: 'temporary-password-123',
    },
  })
  assert.equal(adminCreatedUser.response.status, 201)
  assert.equal(adminCreatedUser.payload.studentId, 'SLSU-2026-00222')

  const adminCreatedStudentLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { emailOrStudentId: 'SLSU-2026-00222', password: 'temporary-password-123' },
  })
  assert.equal(adminCreatedStudentLogin.response.status, 200)

  const newCampus = await request('/api/admin/campuses', {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { name: 'Liloan' },
  })
  assert.equal(newCampus.response.status, 201)

  const usedCampusDelete = await request('/api/admin/campuses/Sogod', {
    method: 'DELETE',
    cookie: adminLogin.cookie,
  })
  assert.equal(usedCampusDelete.response.status, 409)

  const adminReport = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
    },
  })
  assert.equal(adminReport.response.status, 200)
  assert.equal(adminReport.payload.title, 'Updated water bottle')

  const logout = await request('/api/auth/logout', { method: 'POST', cookie: signup.cookie })
  assert.equal(logout.response.status, 204)
  const expiredAccess = await request('/api/items', { cookie: signup.cookie })
  assert.equal(expiredAccess.response.status, 401)
})
