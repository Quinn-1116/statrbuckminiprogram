const {
  createConfiguredDrink,
  formatPrice,
  getCustomizationOptions,
  getMenuItems
} = require('../../domain/menu')
const { addConfiguredDrink } = require('../../domain/cart')

const optionGroups = [
  { key: 'cupSize', title: '杯型', optionsKey: 'cupSizes' },
  { key: 'sweetness', title: '糖度', optionsKey: 'sweetness' },
  { key: 'temperature', title: '温度', optionsKey: 'temperature' },
  { key: 'milk', title: '奶类', optionsKey: 'milk' }
]

function makeSelection(menuItemId) {
  return {
    menuItemId,
    cupSize: 'medium',
    sweetness: 'half',
    temperature: 'iced',
    milk: 'regular'
  }
}

function makeMenuView(items, selection) {
  return items.map((item) => ({
    ...item,
    selected: item.id === selection.menuItemId,
    priceLabel: formatPrice(item.mediumPriceFen)
  }))
}

function makeOptionGroups(options, selection) {
  return optionGroups.map((group) => ({
    key: group.key,
    title: group.title,
    options: options[group.optionsKey].map((option) => ({
      ...option,
      selected: selection[group.key] === option.id,
      priceLabel: option.extraPriceFen ? `+${formatPrice(option.extraPriceFen)}` : ''
    }))
  }))
}

Page({
  data: {},

  onLoad() {
    const items = getMenuItems()
    const selection = makeSelection(items[0].id)
    this.items = items
    this.refreshCartCount()
    this.setData({
      menuItems: makeMenuView(items, selection),
      selectedMenuName: items[0].name,
      selectionSummary: '中杯 · 半糖 · 冰 · 默认牛奶',
      selection,
      optionGroups: makeOptionGroups(getCustomizationOptions(), selection),
      configuredPrice: formatPrice(createConfiguredDrink(selection).priceFen)
    })
  },

  onShow() {
    this.refreshCartCount()
  },

  chooseMenuItem(event) {
    const selection = {
      ...this.data.selection,
      menuItemId: event.currentTarget.dataset.id
    }
    this.updateSelection(selection)
  },

  chooseOption(event) {
    const { group, value } = event.currentTarget.dataset
    const selection = {
      ...this.data.selection,
      [group]: value
    }
    this.updateSelection(selection)
  },

  updateSelection(selection) {
    const configuredDrink = createConfiguredDrink(selection)
    this.setData({
      selection,
      menuItems: makeMenuView(this.items, selection),
      selectedMenuName: this.items.find((item) => item.id === selection.menuItemId).name,
      selectionSummary: [
        configuredDrink.cupSizeName,
        configuredDrink.sweetnessName,
        configuredDrink.temperatureName,
        configuredDrink.milkName
      ].join(' · '),
      optionGroups: makeOptionGroups(getCustomizationOptions(), selection),
      configuredPrice: formatPrice(configuredDrink.priceFen)
    })
  },

  addToCart() {
    const cart = wx.getStorageSync('coffee-cart') || []
    const updatedCart = addConfiguredDrink(cart, createConfiguredDrink(this.data.selection))
    wx.setStorageSync('coffee-cart', updatedCart)
    this.setData({ cartCount: updatedCart.reduce((count, line) => count + line.quantity, 0) })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  refreshCartCount() {
    const cart = wx.getStorageSync('coffee-cart') || []
    this.setData({ cartCount: cart.reduce((count, line) => count + line.quantity, 0) })
  },

  openCart() {
    wx.navigateTo({ url: '/pages/cart/cart' })
  },

  openOrderHistory() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  }
})
