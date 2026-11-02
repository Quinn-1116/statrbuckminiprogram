const test = require('node:test')
const assert = require('node:assert/strict')

const { createAdminServer } = require('../admin/server')

test('administrator authentication protects order reads and status changes', async () => {
  const server = createAdminServer({
    username: 'manager-test',
    password: 'test-only-password',
    orders: [{ id: 'order-1', pickupTime: '2026-10-31 10:00', status: 'Pending', shopId: 'yunshan' }]
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    const denied = await fetch(`${baseUrl}/api/orders`)
    assert.equal(denied.status, 401)

    const deniedUpdate = await fetch(`${baseUrl}/api/orders/order-1/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nextStatus: 'Preparing' })
    })
    assert.equal(deniedUpdate.status, 401)

    const badLogin = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'manager-test', password: 'wrong' })
    })
    assert.equal(badLogin.status, 401)

    const login = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'manager-test', password: 'test-only-password' })
    })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie').split(';')[0]

    const crossOriginUpdate = await fetch(`${baseUrl}/api/orders/order-1/status`, {
      method: 'POST',
      headers: { cookie, origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ nextStatus: 'Preparing' })
    })
    assert.equal(crossOriginUpdate.status, 403)

    const authorized = await fetch(`${baseUrl}/api/orders`, { headers: { cookie } })
    assert.equal(authorized.status, 200)
    assert.equal((await authorized.json())[0].id, 'order-1')

    const update = await fetch(`${baseUrl}/api/orders/order-1/status`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ nextStatus: 'Preparing' })
    })
    assert.equal(update.status, 200)
    assert.equal((await update.json()).status, 'Preparing')

    const invalidFilter = await fetch(`${baseUrl}/api/orders?status=unknown`, { headers: { cookie } })
    assert.equal(invalidFilter.status, 200)
    assert.deepEqual(await invalidFilter.json(), [])

    const skipped = await fetch(`${baseUrl}/api/orders/order-1/status`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ nextStatus: 'Picked Up' })
    })
    assert.equal(skipped.status, 400)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
