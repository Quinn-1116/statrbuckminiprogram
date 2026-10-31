const { getCartTotalFen } = require('./cart')
const { ORDER_STATUSES } = require('./order-status')

const shops = [
  { id: 'yunshan', name: '云山店', openingHours: '09:00–21:00' },
  { id: 'hupan', name: '湖畔店', openingHours: '09:00–21:00' }
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getShops() {
  return shops.map((shop) => ({ ...shop }))
}

function getAvailablePickupSlots(now = new Date()) {
  const slots = []
  const date = formatDate(now)

  for (let hour = 10; hour <= 21; hour += 1) {
    const pickupDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
    if (pickupDate > now) {
      slots.push({
        value: `${date} ${pad(hour)}:00`,
        label: `${pad(hour)}:00`
      })
    }
  }

  return slots
}

function formatPickupTime(value) {
  const [date, time] = value.split(' ')
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日 ${time}`
}

function createSimulatedOrder({
  cart,
  shopId,
  pickupTime,
  pickupName = '微信好友',
  customerId,
  now = new Date(),
  orderId
}) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('购物车还是空的，请先添加饮品')
  }

  const shop = shops.find((candidate) => candidate.id === shopId)
  if (!shop) {
    throw new Error('请选择有效的门店')
  }

  const availableSlot = getAvailablePickupSlots(now).find((slot) => slot.value === pickupTime)
  if (!availableSlot) {
    throw new Error('请选择今天可预约的取餐时间')
  }

  const orderLines = cart.map((line) => ({ ...line }))
  return {
    id: orderId || `mock-${Date.now()}`,
    status: ORDER_STATUSES[0],
    createdAt: now.toISOString(),
    customerId,
    items: orderLines,
    totalFen: getCartTotalFen(orderLines),
    shopId: shop.id,
    shopName: shop.name,
    shopHours: shop.openingHours,
    pickupName,
    pickupTime,
    pickupTimeLabel: formatPickupTime(pickupTime)
  }
}

module.exports = {
  createSimulatedOrder,
  getAvailablePickupSlots,
  getShops
}
