import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'slsu-lost-and-found-'))
process.env.DB_PATH = join(temporaryDirectory, 'test.sqlite')
process.env.ADMIN_USERNAME = 'test-admin'
process.env.ADMIN_PASSWORD = 'test-admin-password-12345'
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = ''
process.env.SMTP_FROM = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = ''

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

function addTestStudent(id, studentId, name, email, campus) {
  db.prepare(`
    INSERT INTO users (id, full_name, login, student_id, email, campus, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'user', 'test-hash', ?)
  `).run(id, name, email, studentId, email, campus, new Date().toISOString())
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), id, Date.now() + 60 * 60 * 1000)
  return `slsu_session=${token}`
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
    body: { emailOrStudentId: 'slsu-2026-00123', password: 'student-password-123', accountType: 'student' },
  })
  assert.equal(studentIdLogin.response.status, 200)

  const emailLogin = await request('/api/auth/login', {
    method: 'POST',
    body: {
      emailOrStudentId: 'SAMPLE.STUDENT@example.com',
      password: 'student-password-123',
      accountType: 'student',
      rememberMe: true,
    },
  })
  assert.equal(emailLogin.response.status, 200)
  assert.match(emailLogin.response.headers.getSetCookie()[0], /Expires=/i)

  const studentUsingStaffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: {
      emailOrStudentId: 'slsu-2026-00123',
      password: 'student-password-123',
      accountType: 'staff',
    },
  })
  assert.equal(studentUsingStaffLogin.response.status, 401)

  const sameCampusStudentCookie = addTestStudent(
    'test-same-campus-student',
    'SLSU-2026-00124',
    'Same Campus Student',
    'same-campus@example.com',
    'Sogod',
  )
  const differentCampusStudentCookie = addTestStudent(
    'test-different-campus-student',
    'SLSU-2026-00125',
    'Different Campus Student',
    'different-campus@example.com',
    'Maasin',
  )

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
  const deniedStudentNotifications = await request('/api/notifications')
  assert.equal(deniedStudentNotifications.response.status, 401)

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
  assert.equal(report.payload.campus, 'Sogod')
  assert.equal(report.payload.status, 'open')

  const listedItems = await request('/api/items', { cookie: signup.cookie })
  const listedReport = listedItems.payload.find((item) => item.id === report.payload.id)
  assert.equal(listedReport.campus, 'Sogod')
  assert.equal(listedReport.status, 'open')

  const sameCampusNotifications = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(sameCampusNotifications.response.status, 200)
  assert.equal(sameCampusNotifications.payload.unreadCount, 1)
  assert.equal(sameCampusNotifications.payload.notifications[0].eventType, 'new_report')
  assert.match(sameCampusNotifications.payload.notifications[0].message, /Water bottle/)

  const differentCampusNotifications = await request('/api/notifications', { cookie: differentCampusStudentCookie })
  assert.equal(differentCampusNotifications.response.status, 200)
  assert.equal(differentCampusNotifications.payload.unreadCount, 0)

  const deniedCrossCampusRead = await request(
    `/api/notifications/${encodeURIComponent(sameCampusNotifications.payload.notifications[0].id)}/read`,
    { method: 'PATCH', cookie: differentCampusStudentCookie },
  )
  assert.equal(deniedCrossCampusRead.response.status, 404)

  const reporterNotifications = await request('/api/notifications', { cookie: signup.cookie })
  assert.equal(reporterNotifications.payload.unreadCount, 0)

  const markedNotification = await request(
    `/api/notifications/${encodeURIComponent(sameCampusNotifications.payload.notifications[0].id)}/read`,
    { method: 'PATCH', cookie: sameCampusStudentCookie },
  )
  assert.equal(markedNotification.response.status, 200)
  const readNotifications = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(readNotifications.payload.unreadCount, 0)

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
    body: { emailOrStudentId: 'test-admin', password: 'test-admin-password-12345', accountType: 'staff' },
  })
  assert.equal(adminLogin.response.status, 200)
  assert.doesNotMatch(adminLogin.response.headers.getSetCookie()[0], /Expires=/i)

  const deniedAdminNotifications = await request('/api/notifications', { cookie: adminLogin.cookie })
  assert.equal(deniedAdminNotifications.response.status, 403)

  const notificationSettings = await request('/api/admin/notification-settings', { cookie: adminLogin.cookie })
  assert.equal(notificationSettings.response.status, 200)
  assert.equal(notificationSettings.payload.emailNotificationsEnabled, false)

  const staffUsingStudentLogin = await request('/api/auth/login', {
    method: 'POST',
    body: {
      emailOrStudentId: 'test-admin',
      password: 'test-admin-password-12345',
      accountType: 'student',
    },
  })
  assert.equal(staffUsingStudentLogin.response.status, 401)

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
    body: {
      emailOrStudentId: 'SLSU-2026-00222',
      password: 'temporary-password-123',
      accountType: 'student',
    },
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
  assert.equal(adminReport.payload.status, 'open')

  const deniedStudentClaim = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: sameCampusStudentCookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
      status: 'claimed',
    },
  })
  assert.equal(deniedStudentClaim.response.status, 403)

  const claimedReport = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
      status: 'claimed',
    },
  })
  assert.equal(claimedReport.response.status, 200)
  assert.equal(claimedReport.payload.status, 'claimed')
  assert.equal(claimedReport.payload.campus, 'Sogod')

  const claimNotifications = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(claimNotifications.payload.unreadCount, 1)
  assert.equal(claimNotifications.payload.notifications[0].eventType, 'claimed')
  assert.equal(claimNotifications.payload.notifications[0].itemType, 'found')

  const markAllRead = await request('/api/notifications/read-all', {
    method: 'PATCH',
    cookie: sameCampusStudentCookie,
  })
  assert.equal(markAllRead.response.status, 200)
  const allReadNotifications = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(allReadNotifications.payload.unreadCount, 0)

  const repeatedClaim = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
      status: 'claimed',
    },
  })
  assert.equal(repeatedClaim.response.status, 200)
  const noDuplicateClaimNotification = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(noDuplicateClaimNotification.payload.notifications.length, 2)

  const reopenedReport = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
      status: 'open',
    },
  })
  assert.equal(reopenedReport.response.status, 200)
  const noReopenNotification = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(noReopenNotification.payload.notifications.length, 2)

  const reclaimedReport = await request(`/api/admin/items/${encodeURIComponent(report.payload.id)}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: {
      title: 'Updated water bottle',
      description: 'Updated description',
      location: 'Main Library',
      type: 'found',
      reporter: 'Administrator',
      date: report.payload.date,
      status: 'claimed',
    },
  })
  assert.equal(reclaimedReport.response.status, 200)
  const reclaimNotification = await request('/api/notifications', { cookie: sameCampusStudentCookie })
  assert.equal(reclaimNotification.payload.notifications.length, 3)
  assert.equal(reclaimNotification.payload.unreadCount, 1)

  const logout = await request('/api/auth/logout', { method: 'POST', cookie: signup.cookie })
  assert.equal(logout.response.status, 204)
  const expiredAccess = await request('/api/items', { cookie: signup.cookie })
  assert.equal(expiredAccess.response.status, 401)
})
