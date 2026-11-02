const test = require('node:test')
const assert = require('node:assert/strict')

const { createOrderApi } = require('../cloudfunctions/order-api/index.js')

function makeDatabase() {
  const records = new Map()
  function makeQuery(query = {}) {
    const orders = []
    let offset = 0
    let limit = Infinity
    return {
      orderBy(field, direction) {
        orders.push([field, direction])
        return this
      },
      skip(value) {
        offset = value
        return this
      },
      limit(value) {
        limit = value
        return this
      },
      async get() {
        let result = [...records.values()].filter((record) => Object.entries(query).every(([key, value]) => record[key] === value))
        result.sort((left, right) => {
          for (const [field, direction] of orders) {
            const compared = String(left[field] || '').localeCompare(String(right[field] || ''))
            if (compared) return direction === 'desc' ? -compared : compared
          }
          return 0
        })
        return { data: result.slice(offset, offset + limit) }
      }
    }
  }
  const collection = {
    doc(id) {
      return {
        async get() {
          if (!records.has(id)) throw new Error('document not found')
          return { data: records.get(id) }
        },
        async set(data) { records.set(id, { ...data, _id: id }) },
        async update(data) {
          records.set(id, { ...records.get(id), ...data })
        }
      }
    },
    where(query) {
      return makeQuery(query)
    },
    async add(data) {
      const id = data.id
      records.set(id, { ...data, _id: id })
      return { id }
    },
    async create(data) {
      const id = data.customerId
      records.set(id, { ...data, _id: id })
      return { id }
    },
    ...makeQuery()
  }
  return {
    collection: () => collection,
    records,
    runTransaction(callback) {
      return callback({ collection: () => collection })
    }
  }
}

const payload = {
  action: 'createOrder',
  customerId: 'attacker-selected-id',
  pickupName: '林',
  shopId: 'yunshan',
  pickupTime: '2026-10-31 21:00',
  cart: [{ menuItemId: 'americano', cupSize: 'medium', sweetness: 'half', temperature: 'iced', milk: 'regular', quantity: 1 }]
}

test('customer pickup name is persisted under the trusted customer identity', async () => {
  const db = makeDatabase()
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })

  assert.deepEqual(await api({ action: 'saveProfile', pickupName: ' 林 ' }), {
    customerId: 'verified-openid',
    pickupName: '林'
  })
  assert.equal((await api({ action: 'getProfile' })).pickupName, '林')
})

test('customer order identity comes from trusted WeChat context, not request data', async () => {
  const db = makeDatabase()
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }), now: () => new Date('2026-10-31T00:00:00.000Z') })
  await api({ action: 'saveProfile', pickupName: '林' })
  const result = await api(payload)

  assert.equal(result.customerId, 'verified-openid')
  assert.equal(result.totalFen, 1800)
  assert.equal(db.records.get(result.id).customerId, 'verified-openid')
  assert.equal(db.records.get(result.id).id, result.id)
})

test('order creation writes the document using the business order identifier', async () => {
  const db = makeDatabase()
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: 'verified-openid' }),
    now: () => new Date('2026-10-31T00:00:00.000Z')
  })
  await api({ action: 'saveProfile', pickupName: '林' })

  const order = await api(payload)
  assert.deepEqual((await db.collection('orders').doc(order.id).get()).data, db.records.get(order.id))
  const adminApi = createOrderApi({
    db,
    getContext: () => ({ uid: 'admin' }),
    adminUid: 'admin'
  })
  await adminApi({ action: 'updateStatus', orderId: order.id, nextStatus: 'Preparing' })
  assert.equal(db.records.get(order.id).status, 'Preparing')
})

test('database writes use the CloudBase SDK data shape rather than a data wrapper', async () => {
  const db = makeDatabase()
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })

  await api({ action: 'saveProfile', pickupName: '林' })
  const profile = db.records.get('verified-openid')
  assert.equal(profile.pickupName, '林')
  assert.equal(profile.data, undefined)
})

test('order creation rejects excessive cart quantity before writing', async () => {
  const db = makeDatabase()
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: 'verified-openid' }),
    now: () => new Date('2026-10-31T00:00:00.000Z')
  })
  await api({ action: 'saveProfile', pickupName: '林' })

  await assert.rejects(
    api({ ...payload, cart: [{ ...payload.cart[0], quantity: 20 }, { ...payload.cart[0], menuItemId: 'latte', quantity: 20 }, { ...payload.cart[0], menuItemId: 'mocha', quantity: 20 }, { ...payload.cart[0], menuItemId: 'cold-brew', quantity: 20 }, { ...payload.cart[0], menuItemId: 'tea', quantity: 20 }, { ...payload.cart[0], menuItemId: 'espresso', quantity: 20 }] }),
    /订单数量过多/
  )
})

test('customer history is scoped to trusted identity', async () => {
  const db = makeDatabase()
  db.records.set('mine', { id: 'mine', customerId: 'verified-openid', items: [] })
  db.records.set('other', { id: 'other', customerId: 'another-openid', items: [] })
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })

  assert.deepEqual((await api({ action: 'listMine' })).orders.map(({ id }) => id), ['mine'])
})

test('customer history queries the shared collection by trusted customer UID', async () => {
  const db = makeDatabase()
  const queried = []
  const original = db.collection
  db.collection = (name) => {
    const result = original(name)
    const where = result.where
    result.where = (query) => {
      queried.push(query)
      return where(query)
    }
    return result
  }
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })

  await api({ action: 'listMine' })
  assert.deepEqual(queried, [{ customerId: 'verified-openid' }])
})

test('customer cannot fetch another customer order by identifier', async () => {
  const db = makeDatabase()
  db.records.set('other', { id: 'other', customerId: 'another-openid', items: [] })
  const api = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })

  await assert.rejects(api({ action: 'getMine', orderId: 'other' }), /未找到订单或无权查看/)
})

test('pickup slots are validated in China Standard Time, independent of function host timezone', async () => {
  const db = makeDatabase()
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: 'verified-openid' }),
    now: () => new Date('2026-10-30T16:00:00.000Z')
  })
  await api({ action: 'saveProfile', pickupName: '林' })
  const order = await api({ ...payload, pickupTime: '2026-10-31 10:00' })
  assert.equal(order.pickupTimeLabel, '10月31日 10:00')
})

test('admin actions require the configured CloudBase user UID', async () => {
  const db = makeDatabase()
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: 'not-admin' }),
    adminUid: '2116328262249512960'
  })

  await assert.rejects(api({ action: 'listAll' }), /无权访问管理员功能/)
})

test('admin can list all orders and advance status in sequence', async () => {
  const db = makeDatabase()
  db.records.set('one', { id: 'one', customerId: 'customer', status: 'Pending', pickupTime: '2026-10-31 10:00', items: [] })
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: '2116328262249512960' }),
    adminUid: '2116328262249512960',
  })

  assert.equal((await api({ action: 'listAll' })).orders.length, 1)
  assert.equal((await api({ action: 'updateStatus', orderId: 'one', nextStatus: 'Preparing' })).status, 'Preparing')
  await assert.rejects(api({ action: 'updateStatus', orderId: 'one', nextStatus: 'Picked Up' }), /只能按顺序推进一个状态/)
})

test('customer and admin order lists use stable bounded pages', async () => {
  const db = makeDatabase()
  for (let index = 0; index < 51; index += 1) {
    const id = `order-${String(index).padStart(2, '0')}`
    db.records.set(id, {
      _id: id,
      id,
      customerId: 'verified-openid',
      status: 'Pending',
      shopId: 'yunshan',
      pickupTime: `2026-10-31 ${String(10 + Math.floor(index / 60)).padStart(2, '0')}:00`,
      createdAt: new Date(Date.UTC(2026, 9, 31, 0, index)).toISOString(),
      items: []
    })
  }
  const customerApi = createOrderApi({ db, getContext: () => ({ uid: 'verified-openid' }) })
  const firstCustomerPage = await customerApi({ action: 'listMine' })
  const secondCustomerPage = await customerApi({ action: 'listMine', offset: firstCustomerPage.nextOffset })

  assert.equal(firstCustomerPage.orders.length, 50)
  assert.equal(firstCustomerPage.nextOffset, 50)
  assert.equal(secondCustomerPage.orders.length, 1)
  assert.equal(secondCustomerPage.nextOffset, null)
  assert.notEqual(firstCustomerPage.orders[0].id, secondCustomerPage.orders[0].id)

  const adminApi = createOrderApi({ db, getContext: () => ({ uid: 'admin' }), adminUid: 'admin' })
  const firstAdminPage = await adminApi({ action: 'listAll', filters: { shopId: 'yunshan' } })
  const secondAdminPage = await adminApi({ action: 'listAll', filters: { shopId: 'yunshan' }, offset: firstAdminPage.nextOffset })
  assert.equal(firstAdminPage.orders.length, 50)
  assert.equal(secondAdminPage.orders.length, 1)
})

test('order-list pagination rejects invalid or excessive offsets', async () => {
  const api = createOrderApi({ db: makeDatabase(), getContext: () => ({ uid: 'customer' }) })
  await assert.rejects(api({ action: 'listMine', offset: -1 }), /订单分页参数无效/)
  await assert.rejects(api({ action: 'listMine', offset: 1.5 }), /订单分页参数无效/)
  await assert.rejects(api({ action: 'listMine', offset: 100001 }), /订单分页参数无效/)
})

test('status updates use a conditional write to reject stale concurrent transitions', async () => {
  const db = makeDatabase()
  db.records.set('one', { id: 'one', customerId: 'customer', status: 'Pending', pickupTime: '2026-10-31 10:00', items: [] })
  const api = createOrderApi({
    db,
    getContext: () => ({ uid: 'admin' }),
    adminUid: 'admin',
  })

  await api({ action: 'updateStatus', orderId: 'one', nextStatus: 'Preparing' })
  await assert.rejects(api({ action: 'updateStatus', orderId: 'one', nextStatus: 'Preparing' }), /只能按顺序推进一个状态/)
})
