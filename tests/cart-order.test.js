const test = require('node:test')
const assert = require('node:assert/strict')

const {
  addConfiguredDrink,
  getCartTotalFen,
  normalizeCart,
  setCartDrinkQuantity
} = require('../domain/cart')
const {
  createSimulatedOrder,
  getAvailablePickupSlots,
  getShops
} = require('../domain/order')
const { createConfiguredDrink } = require('../domain/menu')

function configuredDrink(overrides = {}) {
  return createConfiguredDrink({
    menuItemId: 'latte',
    cupSize: 'medium',
    sweetness: 'half',
    temperature: 'iced',
    milk: 'regular',
    ...overrides
  })
}

test('adding identical configured drinks merges them into an adjustable quantity', () => {
  const first = addConfiguredDrink([], configuredDrink())
  const second = addConfiguredDrink(first, configuredDrink())

  assert.equal(second.length, 1)
  assert.equal(second[0].quantity, 2)
  assert.equal(second[0].lineTotalFen, 4400)
})

test('cart keeps different configurations separate and totals every quantity', () => {
  const cart = addConfiguredDrink(
    addConfiguredDrink([], configuredDrink()),
    configuredDrink({ cupSize: 'large', milk: 'oat' })
  )

  assert.equal(cart.length, 2)
  assert.equal(getCartTotalFen(cart), 4800)
})

test('cart quantity can be set, and zero removes the configured drink', () => {
  const drink = configuredDrink()
  const cart = addConfiguredDrink([], drink)
  const quantityThree = setCartDrinkQuantity(cart, drink, 3)

  assert.equal(quantityThree[0].quantity, 3)
  assert.equal(quantityThree[0].lineTotalFen, 6600)
  assert.deepEqual(setCartDrinkQuantity(quantityThree, drink, 0), [])
  assert.throws(() => setCartDrinkQuantity(cart, drink, 1.5), /大于或等于零的整数/)
})

test('duplicate stored configurations normalize into one adjustable line', () => {
  const drink = configuredDrink()
  const duplicateLines = [
    { ...drink, quantity: 1 },
    { ...drink, quantity: 2 }
  ]

  const normalized = normalizeCart(duplicateLines)
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].quantity, 3)
  assert.equal(normalized[0].lineTotalFen, 6600)
  assert.equal(setCartDrinkQuantity(duplicateLines, drink, 4)[0].quantity, 4)
})

test('pickup slots are future whole hours from 10:00 through 21:00', () => {
  const afterOpeningSlot = new Date(2026, 9, 31, 10, 30)
  const slots = getAvailablePickupSlots(afterOpeningSlot)

  assert.deepEqual(slots.map(({ label }) => label), [
    '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
    '17:00', '18:00', '19:00', '20:00', '21:00'
  ])
  assert.equal(getAvailablePickupSlots(new Date(2026, 9, 31, 9, 0))[0].label, '10:00')
  assert.equal(getAvailablePickupSlots(new Date(2026, 9, 31, 20, 59)).at(-1).label, '21:00')
  assert.deepEqual(getAvailablePickupSlots(new Date(2026, 9, 31, 21, 0)), [])
  assert.deepEqual(getShops().map(({ openingHours }) => openingHours), ['09:00–21:00', '09:00–21:00'])
})

test('simulated order requires a non-empty cart, valid shop, and available pickup time', () => {
  const now = new Date(2026, 9, 31, 9, 15)
  const cart = addConfiguredDrink([], configuredDrink())
  const pickupTime = getAvailablePickupSlots(now)[0].value

  const order = createSimulatedOrder({
    cart,
    shopId: 'yunshan',
    pickupTime,
    pickupName: '小林',
    now,
    orderId: 'order-test-1'
  })

  assert.deepEqual(
    [order.id, order.status, order.totalFen, order.shopName, order.pickupTimeLabel, order.pickupName],
    ['order-test-1', 'Pending', 2200, '云山店', '10月31日 10:00', '小林']
  )
  assert.throws(
    () => createSimulatedOrder({ cart: [], shopId: 'yunshan', pickupTime, now }),
    /购物车还是空的/
  )
  assert.throws(
    () => createSimulatedOrder({ cart, shopId: 'unknown', pickupTime, now }),
    /请选择有效的门店/
  )
  assert.throws(
    () => createSimulatedOrder({ cart, shopId: 'yunshan', pickupTime: '2026-10-31 09:00', now }),
    /请选择今天可预约的取餐时间/
  )
})
