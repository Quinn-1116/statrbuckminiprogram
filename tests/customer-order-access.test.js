const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getCustomerOrderById,
  getCustomerOrderHistory
} = require('../domain/customer-orders')
const { getOrderStatusLabel } = require('../domain/order-status')

const orders = [
  { id: 'mine', customerId: 'customer-a', status: 'Pending', items: [{ quantity: 2 }] },
  { id: 'theirs', customerId: 'customer-b', status: 'Preparing', items: [{ quantity: 1 }] }
]

test('customer order history only returns orders owned by that customer', () => {
  const history = getCustomerOrderHistory(orders, 'customer-a')

  assert.deepEqual(history.map(({ id }) => id), ['mine'])
  assert.notEqual(history[0].items, orders[0].items)
  assert.throws(() => getCustomerOrderHistory(orders, ''), /需要有效的顾客身份/)
})

test('customer cannot read another customer order through the order access boundary', () => {
  assert.equal(getCustomerOrderById(orders, 'mine', 'customer-a').id, 'mine')
  assert.throws(
    () => getCustomerOrderById(orders, 'theirs', 'customer-a'),
    /未找到订单或无权查看/
  )
})

test('customer sees manager status changes using localized labels', () => {
  assert.equal(getOrderStatusLabel('Pending'), '待制作')
  assert.equal(getOrderStatusLabel('Ready for Pickup'), '可取餐')
})
