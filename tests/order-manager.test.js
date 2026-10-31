const test = require('node:test')
const assert = require('node:assert/strict')

const {
  filterAndSortOrders,
  updateOrderStatus
} = require('../domain/order-manager')

const orders = [
  { id: 'late', shopId: 'yunshan', pickupTime: '2026-10-31 18:00', status: 'Pending' },
  { id: 'early', shopId: 'hupan', pickupTime: '2026-10-31 10:00', status: 'Preparing' },
  { id: 'middle', shopId: 'yunshan', pickupTime: '2026-10-31 14:00', status: 'Ready for Pickup' }
]

test('manager order list filters by shop/status and sorts by pickup time', () => {
  assert.deepEqual(filterAndSortOrders(orders, {}).map(({ id }) => id), ['early', 'middle', 'late'])
  assert.deepEqual(
    filterAndSortOrders(orders, { shopId: 'yunshan', status: 'Pending' }).map(({ id }) => id),
    ['late']
  )
})

test('manager can advance exactly one allowed order status at a time', () => {
  assert.equal(updateOrderStatus(orders, 'late', 'Preparing')[0].status, 'Preparing')
  assert.throws(() => updateOrderStatus(orders, 'late', 'Ready for Pickup'), /只能按顺序推进一个状态/)
  assert.throws(() => updateOrderStatus(orders, 'late', 'Pending'), /只能按顺序推进一个状态/)
  assert.throws(
    () => updateOrderStatus([{ ...orders[0], status: 'Picked Up' }], 'late', 'Pending'),
    /订单已完成，不能继续推进/
  )
})
