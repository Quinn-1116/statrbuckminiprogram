const test = require('node:test')
const assert = require('node:assert/strict')

const registeredPages = []
global.Page = (definition) => registeredPages.push(definition)

require('../pages/menu/menu')
require('../pages/cart/cart')
require('../pages/orders/orders')

const [menuPage, cartPage, ordersPage] = registeredPages
const { configureCallOverride } = require('../services/cloudbase-orders')

function makePageContext(definition) {
  return {
    ...definition,
    data: {},
    setData(nextData) {
      this.data = { ...this.data, ...nextData }
    }
  }
}

test('customer can submit an order through the CloudBase order boundary', async () => {
  const storage = {}
  const toasts = []
  const calls = []
  const mockOrder = {
    id: 'shared-order',
    customerId: 'stable-customer-uid',
    pickupName: '林',
    status: 'Pending',
    shopName: '云山店',
    shopHours: '09:00–21:00',
    pickupTimeLabel: '10月31日 21:00',
    totalFen: 1800,
    items: [{
      menuItemId: 'americano', menuItemName: '美式咖啡', cupSizeName: '中杯',
      sweetnessName: '半糖', temperatureName: '冰', milkName: '默认牛奶', priceFen: 1800, quantity: 1
    }]
  }
  configureCallOverride(async (event) => {
    calls.push(event)
    if (event.action === 'getProfile') return { pickupName: '林' }
    if (event.action === 'createOrder') return mockOrder
    throw new Error(`unexpected action ${event.action}`)
  })
  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    showToast(options) {
      toasts.push(options)
    }
  }

  const menu = makePageContext(menuPage)
  menu.onLoad()
  menu.addToCart()

  assert.equal(menu.data.cartCount, 1)
  assert.equal(toasts[0].title, '已加入购物车')

  const cart = makePageContext(cartPage)
  cart.onLoad()
  await cart.submitOrder()

  assert.equal(cart.data.order.shopName, '云山店')
  assert.equal(cart.data.order.totalFen, 1800)
  assert.match(cart.data.order.pickupTimeLabel, /\d+月\d+日 \d{2}:00/)
  assert.equal(cart.data.order.pickupName, '林')
  assert.equal(cart.data.order.customerId, 'stable-customer-uid')
  assert.deepEqual(storage['coffee-cart'], [])
  assert.equal(storage['coffee-orders'], undefined)
  assert.deepEqual(calls.map(({ action }) => action), ['getProfile', 'createOrder'])
  assert.equal(cart.data.order.status, 'Pending')
  assert.equal(cart.data.order.statusLabel, '待制作')
})

test('customer order page reads shared history and rejects another customer order', async () => {
  const storage = {
    'coffee-customer-id': 'customer-a',
    'coffee-orders': [
      {
        id: 'own-order',
        customerId: 'customer-a',
        status: 'Ready for Pickup',
        shopName: '云山店',
        pickupName: '小林',
        pickupTimeLabel: '10月31日 14:00',
        pickupTime: '2026-10-31 14:00',
        totalFen: 1800,
        items: [{ menuItemName: '美式咖啡', cupSizeName: '中杯', priceFen: 1800, quantity: 1 }]
      },
      { id: 'other-order', customerId: 'customer-b', status: 'Pending', totalFen: 2200, items: [] }
    ]
  }
  const toasts = []
  configureCallOverride(async (event) => {
    if (event.action === 'listMine') return { orders: [storage['coffee-orders'][0]], nextOffset: null }
    if (event.action === 'getMine' && event.orderId === 'own-order') return storage['coffee-orders'][0]
    throw new Error('未找到订单或无权查看')
  })
  global.wx = {
    getStorageSync(key) { return storage[key] },
    setStorageSync(key, value) { storage[key] = value },
    showToast(options) { toasts.push(options) }
  }

  const page = makePageContext(ordersPage)
  await page.onLoad()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(page.data.orders.map(({ id }) => id), ['own-order'])
  assert.equal(page.data.orders[0].statusLabel, '可取餐')
  await page.openOrder({ currentTarget: { dataset: { id: 'other-order' } } })
  assert.equal(page.data.selectedOrder, null)
  assert.equal(toasts[0].title, '未找到订单或无权查看')
})

test('customer order page loads the next bounded page and appends it', async () => {
  const calls = []
  const makeOrder = (id) => ({
    id,
    customerId: 'customer-a',
    status: 'Pending',
    shopName: '云山店',
    pickupTimeLabel: '10月31日 14:00',
    totalFen: 1800,
    items: []
  })
  configureCallOverride(async (event) => {
    calls.push(event)
    if (event.action === 'listMine' && event.offset === undefined) {
      return { orders: [makeOrder('first-order')], nextOffset: 50 }
    }
    if (event.action === 'listMine' && event.offset === 50) {
      return { orders: [makeOrder('next-order')], nextOffset: null }
    }
    throw new Error(`unexpected action ${event.action}`)
  })
  global.wx = { showToast() {} }

  const page = makePageContext(ordersPage)
  await page.onLoad()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(page.data.orders.map(({ id }) => id), ['first-order'])
  assert.equal(page.data.hasMore, true)

  await page.loadMoreOrders()
  assert.deepEqual(page.data.orders.map(({ id }) => id), ['first-order', 'next-order'])
  assert.equal(page.data.hasMore, false)
  assert.deepEqual(calls.map(({ offset }) => offset), [undefined, 50])
})

test('cart combines duplicate stored configurations and falls back to menu without page history', () => {
  const drink = require('../domain/menu').createConfiguredDrink({
    menuItemId: 'americano',
    cupSize: 'medium',
    sweetness: 'half',
    temperature: 'iced',
    milk: 'regular'
  })
  const storage = { 'coffee-cart': [{ ...drink, quantity: 1 }, { ...drink, quantity: 2 }] }
  const navigation = []
  global.wx = {
    getStorageSync(key) { return storage[key] },
    setStorageSync(key, value) { storage[key] = value },
    redirectTo(options) { navigation.push(['redirectTo', options.url]) },
    navigateBack(options) { navigation.push(['navigateBack', options.delta]) }
  }
  global.getCurrentPages = () => []

  const cart = makePageContext(cartPage)
  cart.onLoad()
  assert.equal(cart.data.cart.length, 1)
  assert.equal(cart.data.cart[0].quantity, 3)
  cart.backToMenu()
  assert.deepEqual(navigation, [['redirectTo', '/pages/menu/menu']])
})

test('submit handler refuses checkout when no pickup slots remain', () => {
  const drink = require('../domain/menu').createConfiguredDrink({
    menuItemId: 'americano',
    cupSize: 'medium',
    sweetness: 'half',
    temperature: 'iced',
    milk: 'regular'
  })
  const storage = { 'coffee-cart': [{ ...drink, quantity: 1 }] }
  const toasts = []
  global.wx = {
    getStorageSync(key) { return storage[key] },
    setStorageSync(key, value) { storage[key] = value },
    showToast(options) { toasts.push(options) }
  }
  const cart = makePageContext(cartPage)
  cart.data = {
    hasPickupSlots: false,
    selectedShopId: 'yunshan',
    selectedPickupTime: ''
  }
  const NativeDate = global.Date
  global.Date = class extends NativeDate {
    constructor(...args) {
      if (args.length === 0) {
        super(2026, 9, 31, 21, 1)
      } else {
        super(...args)
      }
    }
  }

  try {
    cart.submitOrder()
  } finally {
    global.Date = NativeDate
  }

  assert.equal(cart.data.order, undefined)
  assert.equal(storage['coffee-orders'], undefined)
  assert.equal(cart.data.hasPickupSlots, false)
  assert.equal(toasts[0].title, '今天已没有可预约时间')
})
