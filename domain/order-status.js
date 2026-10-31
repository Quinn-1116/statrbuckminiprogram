const ORDER_STATUSES = ['Pending', 'Preparing', 'Ready for Pickup', 'Picked Up']

const statusLabels = {
  Pending: '待制作',
  Preparing: '制作中',
  'Ready for Pickup': '可取餐',
  'Picked Up': '已取走'
}

function getOrderStatusLabel(status) {
  return statusLabels[status] || status
}

function transitionOrderStatus(order, nextStatus) {
  const currentIndex = ORDER_STATUSES.indexOf(order.status)
  if (currentIndex === -1) {
    throw new Error('订单状态无效')
  }
  if (currentIndex === ORDER_STATUSES.length - 1) {
    throw new Error('订单已完成，不能继续推进')
  }
  if (nextStatus !== ORDER_STATUSES[currentIndex + 1]) {
    throw new Error('只能按顺序推进一个状态')
  }

  return { ...order, status: nextStatus }
}

module.exports = {
  ORDER_STATUSES,
  getOrderStatusLabel,
  transitionOrderStatus
}
