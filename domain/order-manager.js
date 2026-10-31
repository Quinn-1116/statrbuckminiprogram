const { transitionOrderStatus } = require('./order-status')

function filterAndSortOrders(orders, filters = {}) {
  return orders
    .filter((order) => !filters.shopId || order.shopId === filters.shopId)
    .filter((order) => !filters.status || order.status === filters.status)
    .map((order) => ({ ...order }))
    .sort((left, right) => left.pickupTime.localeCompare(right.pickupTime))
}

function updateOrderStatus(orders, orderId, nextStatus) {
  const index = orders.findIndex((order) => order.id === orderId)
  if (index === -1) {
    throw new Error('未找到订单')
  }

  const updatedOrders = orders.map((order) => ({ ...order }))
  updatedOrders[index] = transitionOrderStatus(updatedOrders[index], nextStatus)
  return updatedOrders
}

module.exports = {
  filterAndSortOrders,
  updateOrderStatus
}
