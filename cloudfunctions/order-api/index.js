const crypto = require('node:crypto')
const { createConfiguredDrink } = require('../../domain/menu')
const { getShops } = require('../../domain/order')
const { filterAndSortOrders, updateOrderStatus } = require('../../domain/order-manager')
const { getCustomerOrderById, getCustomerOrderHistory } = require('../../domain/customer-orders')

const collectionName = 'orders'
const maxCartLines = 50
const maxTotalQuantity = 100
const orderPageSize = 50
const maxOrderOffset = 100000

function getDocumentData(result) {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data[0] || null
  return result.data || null
}

function getAvailableShanghaiPickupSlots(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
  const slots = []
  for (let hour = 10; hour <= 21; hour += 1) {
    const label = `${String(hour).padStart(2, '0')}:00`
    const instant = Date.parse(`${date}T${label}:00+08:00`)
    if (instant > now.getTime()) slots.push({ value: `${date} ${label}`, label })
  }
  return slots
}

function createOrderApi({ db, getContext, adminUid = '', now = () => new Date() }) {
  function parseOffset(value) {
    if (value === undefined) return 0
    if (!Number.isInteger(value) || value < 0 || value > maxOrderOffset) {
      throw new Error('订单分页参数无效')
    }
    return value
  }

  async function readOrderPage(query, offset, sortField, direction) {
    const result = await query
      .orderBy(sortField, direction)
      .orderBy('_id', direction)
      .skip(offset)
      .limit(orderPageSize + 1)
      .get()
    const orders = result.data || []
    const hasMore = orders.length > orderPageSize
    return {
      orders: hasMore ? orders.slice(0, orderPageSize) : orders,
      nextOffset: hasMore ? offset + orderPageSize : null
    }
  }

  async function writeStatus(orderId, nextStatus) {
    return db.runTransaction(async (transaction) => {
      const ref = transaction.collection(collectionName).doc(orderId)
      const current = getDocumentData(await ref.get())
      const updated = updateOrderStatus([current], orderId, nextStatus)[0]
      const updatedAt = now().toISOString()
      await ref.update({ status: updated.status, updatedAt })
      return { ...current, ...updated, updatedAt }
    })
  }

  return async function handle(event = {}) {
    const context = await getContext() || {}
    if (event.action === 'listAll' || event.action === 'updateStatus') {
      if (!adminUid || context.uid !== adminUid) throw new Error('无权访问管理员功能')
      if (event.action === 'listAll') {
        const offset = parseOffset(event.offset)
        const filters = event.filters && typeof event.filters === 'object' ? event.filters : {}
        const where = {}
        if (typeof filters.shopId === 'string' && filters.shopId) where.shopId = filters.shopId
        if (typeof filters.status === 'string' && filters.status) where.status = filters.status
        const collection = db.collection(collectionName)
        const query = Object.keys(where).length ? collection.where(where) : collection
        const page = await readOrderPage(query, offset, 'pickupTime', 'asc')
        return { ...page, orders: filterAndSortOrders(page.orders, filters) }
      }
      if (!event.orderId || typeof event.orderId !== 'string') throw new Error('订单编号无效')
      return writeStatus(event.orderId, event.nextStatus)
    }

    const customerId = context.uid
    if (!customerId || typeof customerId !== 'string') throw new Error('需要有效的微信顾客身份')

    if (event.action === 'saveProfile') {
      const pickupName = typeof event.pickupName === 'string' ? event.pickupName.trim() : ''
      if (!pickupName || pickupName.length > 30) throw new Error('取餐姓名需为 1 至 30 个字符')
      const ref = db.collection('customers').doc(customerId)
      await ref.set({ customerId, pickupName, updatedAt: now().toISOString() })
      return { customerId, pickupName }
    }

    if (event.action === 'getProfile') {
      try {
        const profile = getDocumentData(await db.collection('customers').doc(customerId).get())
        return { pickupName: profile ? profile.pickupName : '' }
      } catch {
        return { pickupName: '' }
      }
    }

    if (event.action === 'listMine') {
      const offset = parseOffset(event.offset)
      const page = await readOrderPage(
        db.collection(collectionName).where({ customerId }),
        offset,
        'createdAt',
        'desc'
      )
      return { ...page, orders: getCustomerOrderHistory(page.orders, customerId) }
    }

    if (event.action === 'getMine') {
      const result = await db.collection(collectionName).where({ customerId, id: event.orderId }).get()
      return getCustomerOrderById(result.data || [], event.orderId, customerId)
    }

    if (event.action === 'createOrder') {
      let profile
      try {
        profile = getDocumentData(await db.collection('customers').doc(customerId).get())
      } catch {
        profile = null
      }
      if (!profile || !profile.pickupName) throw new Error('请先设置取餐姓名')
      if (!Array.isArray(event.cart) || event.cart.length === 0) throw new Error('购物车还是空的，请先添加饮品')
      if (event.cart.length > maxCartLines) throw new Error('订单饮品种类过多')

      const totalQuantity = event.cart.reduce((sum, line) => {
        return sum + (Number.isInteger(line && line.quantity) ? line.quantity : 0)
      }, 0)
      if (totalQuantity > maxTotalQuantity) throw new Error('订单数量过多')

      const items = event.cart.map((line) => {
        if (!line || typeof line !== 'object' || Array.isArray(line)) {
          throw new Error('订单饮品信息无效')
        }
        if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
          throw new Error('每种饮品数量需为 1 至 20 杯')
        }
        const selection = {
          menuItemId: line.menuItemId,
          cupSize: line.cupSize,
          sweetness: line.sweetness,
          temperature: line.temperature,
          milk: line.milk
        }
        return { ...createConfiguredDrink(selection), quantity: line.quantity }
      })
      const shop = getShops().find((candidate) => candidate.id === event.shopId)
      if (!shop) throw new Error('请选择有效的门店')
      const pickedSlot = getAvailableShanghaiPickupSlots(now()).find((slot) => slot.value === event.pickupTime)
      if (!pickedSlot) throw new Error('请选择今天可预约的取餐时间')

      const [, month, day] = event.pickupTime.split(' ')[0].split('-')

      const createdAt = now().toISOString()
      const id = `order-${crypto.randomUUID()}`
      const order = {
        id,
        customerId,
        status: 'Pending',
        createdAt,
        items,
        totalFen: items.reduce((sum, item) => sum + item.priceFen * item.quantity, 0),
        shopId: shop.id,
        shopName: shop.name,
        shopHours: shop.openingHours,
        pickupName: profile.pickupName,
        pickupTime: event.pickupTime,
        pickupTimeLabel: `${Number(month)}月${Number(day)}日 ${pickedSlot.label}`
      }
      await db.collection(collectionName).doc(id).set(order)
      return order
    }

    throw new Error('不支持的订单操作')
  }
}

exports.main = async (event, context) => {
  const cloudbase = require('@cloudbase/node-sdk')
  const app = cloudbase.init({ env: process.env.TCB_ENV })
  const api = createOrderApi({
    db: app.database(),
    getContext: () => app.auth().getAuthContext(context),
    adminUid: process.env.ADMIN_UID
  })
  return api(event)
}

exports.createOrderApi = createOrderApi
