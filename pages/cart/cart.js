const {
  getCartTotalFen,
  getConfiguredDrinkKey,
  normalizeCart,
  setCartDrinkQuantity
} = require('../../domain/cart')
const { formatPrice } = require('../../domain/menu')
const { getOrderStatusLabel } = require('../../domain/order-status')
const {
  getAvailablePickupSlots,
  getShops
} = require('../../domain/order')
const { callOrderApi } = require('../../services/cloudbase-orders')

function makeCartView(cart) {
  return cart.map((line) => ({
    ...line,
    configurationKey: getConfiguredDrinkKey(line),
    priceLabel: formatPrice(line.priceFen),
    lineTotalLabel: formatPrice(line.priceFen * line.quantity)
  }))
}

Page({
  data: {},

  onLoad() {
    const shops = getShops()
    this.setData({
      shops,
      selectedShopId: shops[0].id,
      selectedPickupTime: '',
      order: null
    })
    this.refreshCart()
    this.refreshPickupSlots()
  },

  onShow() {
    if (!this.data.order) {
      this.refreshCart()
      this.refreshPickupSlots()
    }
  },

  refreshCart() {
    const cart = normalizeCart(wx.getStorageSync('coffee-cart') || [])
    wx.setStorageSync('coffee-cart', cart)
    this.setData({
      cart: makeCartView(cart),
      cartTotal: formatPrice(getCartTotalFen(cart)),
      isCartEmpty: cart.length === 0
    })
  },

  refreshPickupSlots() {
    const pickupSlots = getAvailablePickupSlots()
    const stillAvailable = pickupSlots.some((slot) => slot.value === this.data.selectedPickupTime)
    this.setData({
      pickupSlots,
      hasPickupSlots: pickupSlots.length > 0,
      selectedPickupTime: stillAvailable ? this.data.selectedPickupTime : (pickupSlots[0] ? pickupSlots[0].value : '')
    })
  },

  changeQuantity(event) {
    const { key, delta } = event.currentTarget.dataset
    const cart = normalizeCart(wx.getStorageSync('coffee-cart') || [])
    const line = cart.find((item) => getConfiguredDrinkKey(item) === key)

    if (!line) return

    wx.setStorageSync('coffee-cart', setCartDrinkQuantity(cart, line, line.quantity + Number(delta)))
    this.refreshCart()
  },

  chooseShop(event) {
    this.setData({ selectedShopId: event.currentTarget.dataset.id })
  },

  choosePickupTime(event) {
    this.setData({ selectedPickupTime: event.currentTarget.dataset.value })
  },

  async submitOrder() {
    const cart = wx.getStorageSync('coffee-cart') || []
    if (!cart.length) {
      wx.showToast({ title: '购物车还是空的', icon: 'none' })
      return
    }
    const currentSlots = getAvailablePickupSlots()
    if (currentSlots.length === 0) {
      this.setData({ pickupSlots: [], hasPickupSlots: false, selectedPickupTime: '' })
      wx.showToast({ title: '今天已没有可预约时间', icon: 'none' })
      return
    }
    if (!currentSlots.some((slot) => slot.value === this.data.selectedPickupTime)) {
      this.setData({
        pickupSlots: currentSlots,
        hasPickupSlots: true,
        selectedPickupTime: currentSlots[0].value
      })
      wx.showToast({ title: '取餐时间已更新，请重新确认', icon: 'none' })
      return
    }

    try {
      let profile = await callOrderApi({ action: 'getProfile' })
      if (!profile.pickupName) {
        const input = await new Promise((resolve) => {
          wx.showModal({
            title: '设置取餐姓名',
            editable: true,
            placeholderText: '请输入取餐时使用的姓名',
            success: (result) => resolve(result.confirm ? result.content : '')
          })
        })
        if (!input || !input.trim()) {
          wx.showToast({ title: '请填写取餐姓名', icon: 'none' })
          return
        }
        profile = await callOrderApi({ action: 'saveProfile', pickupName: input.trim() })
      }
      const order = await callOrderApi({
        action: 'createOrder',
        cart: cart.map(({ menuItemId, cupSize, sweetness, temperature, milk, quantity }) => ({
          menuItemId, cupSize, sweetness, temperature, milk, quantity
        })),
        shopId: this.data.selectedShopId,
        pickupTime: this.data.selectedPickupTime
      })
      wx.setStorageSync('coffee-cart', [])
      this.setData({
        order: {
          ...order,
          statusLabel: getOrderStatusLabel(order.status),
          totalLabel: formatPrice(order.totalFen),
          displayItems: makeCartView(order.items)
        }
      })
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败，请稍后重试', icon: 'none' })
      this.refreshPickupSlots()
    }
  },

  backToMenu() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }

    wx.redirectTo({ url: '/pages/menu/menu' })
  },

  viewOrderHistory() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  }
})
