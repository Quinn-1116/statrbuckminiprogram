function formatDate(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function createMockOrders(now = new Date()) {
  const date = formatDate(now)
  return [
    {
      id: 'demo-order-001',
      customerId: 'demo-customer-001',
      pickupName: '林同学',
      shopId: 'yunshan',
      shopName: '云山店',
      pickupTime: `${date} 12:00`,
      pickupTimeLabel: `${Number(now.getMonth() + 1)}月${Number(now.getDate())}日 12:00`,
      status: 'Pending',
      totalFen: 2200,
      items: [{ menuItemName: '拿铁咖啡', cupSizeName: '中杯', sweetnessName: '半糖', temperatureName: '热', milkName: '默认牛奶', priceFen: 2200, quantity: 1 }]
    },
    {
      id: 'demo-order-002',
      customerId: 'demo-customer-002',
      pickupName: '陈同学',
      shopId: 'hupan',
      shopName: '湖畔店',
      pickupTime: `${date} 15:00`,
      pickupTimeLabel: `${Number(now.getMonth() + 1)}月${Number(now.getDate())}日 15:00`,
      status: 'Preparing',
      totalFen: 4800,
      items: [{ menuItemName: '摩卡咖啡', cupSizeName: '大杯', sweetnessName: '半糖', temperatureName: '冰', milkName: '燕麦奶', priceFen: 2800, quantity: 1 }, { menuItemName: '美式咖啡', cupSizeName: '大杯', sweetnessName: '无糖', temperatureName: '热', milkName: '默认牛奶', priceFen: 2200, quantity: 1 }]
    }
  ]
}

module.exports = { createMockOrders }
