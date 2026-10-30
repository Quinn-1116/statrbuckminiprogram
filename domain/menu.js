const menuItems = [
  { id: 'americano', name: '美式咖啡', description: '醇香清爽，感受咖啡本味', mediumPriceFen: 1800 },
  { id: 'latte', name: '拿铁咖啡', description: '浓缩咖啡与柔滑牛奶相遇', mediumPriceFen: 2200 },
  { id: 'mocha', name: '摩卡咖啡', description: '可可香气交织浓郁咖啡', mediumPriceFen: 2400 }
]

const cupSizes = [
  { id: 'medium', name: '中杯', extraPriceFen: 0 },
  { id: 'large', name: '大杯', extraPriceFen: 400 }
]

const customizationOptions = {
  sweetness: [
    { id: 'none', name: '无糖' },
    { id: 'half', name: '半糖' },
    { id: 'full', name: '全糖' }
  ],
  temperature: [
    { id: 'iced', name: '冰' },
    { id: 'hot', name: '热' }
  ],
  milk: [
    { id: 'regular', name: '默认牛奶' },
    { id: 'oat', name: '燕麦奶' }
  ]
}

function getMenuItems() {
  return menuItems.map((item) => ({ ...item }))
}

function getCustomizationOptions() {
  return {
    cupSizes: cupSizes.map((option) => ({ ...option })),
    sweetness: customizationOptions.sweetness.map((option) => ({ ...option })),
    temperature: customizationOptions.temperature.map((option) => ({ ...option })),
    milk: customizationOptions.milk.map((option) => ({ ...option }))
  }
}

function getConfiguredPriceFen(selection) {
  const item = menuItems.find((menuItem) => menuItem.id === selection.menuItemId)
  const size = cupSizes.find((cupSize) => cupSize.id === selection.cupSize)

  if (!item || !size) {
    throw new Error('请选择有效的饮品和杯型')
  }

  return item.mediumPriceFen + size.extraPriceFen
}

function createConfiguredDrink(selection) {
  const options = getCustomizationOptions()
  const item = menuItems.find((menuItem) => menuItem.id === selection.menuItemId)
  const size = cupSizes.find((cupSize) => cupSize.id === selection.cupSize)
  const isValid = (group, value) => options[group].some((option) => option.id === value)

  if (!item || !size) {
    throw new Error('请选择有效的饮品和杯型')
  }

  if (!isValid('sweetness', selection.sweetness)
    || !isValid('temperature', selection.temperature)
    || !isValid('milk', selection.milk)) {
    throw new Error('请选择有效的饮品定制项')
  }

  return {
    ...selection,
    menuItemName: item.name,
    cupSizeName: size.name,
    sweetnessName: options.sweetness.find((option) => option.id === selection.sweetness).name,
    temperatureName: options.temperature.find((option) => option.id === selection.temperature).name,
    milkName: options.milk.find((option) => option.id === selection.milk).name,
    priceFen: item.mediumPriceFen + size.extraPriceFen
  }
}

function formatPrice(priceFen) {
  const yuan = priceFen / 100
  return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`
}

module.exports = {
  createConfiguredDrink,
  formatPrice,
  getConfiguredPriceFen,
  getCustomizationOptions,
  getMenuItems
}
