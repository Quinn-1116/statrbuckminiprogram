function requireCustomerId(customerId) {
  if (!customerId || typeof customerId !== 'string') {
    throw new Error('需要有效的顾客身份')
  }
}

function copyOrder(order) {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items.map((item) => ({ ...item })) : []
  }
}

function getCustomerOrderHistory(orders, customerId) {
  requireCustomerId(customerId)
  return orders.filter((order) => order.customerId === customerId).map(copyOrder)
}

function getCustomerOrderById(orders, orderId, customerId) {
  requireCustomerId(customerId)
  const order = orders.find((candidate) => candidate.id === orderId && candidate.customerId === customerId)
  if (!order) {
    throw new Error('未找到订单或无权查看')
  }

  return copyOrder(order)
}

module.exports = {
  getCustomerOrderById,
  getCustomerOrderHistory
}
