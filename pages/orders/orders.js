const { getOrderStatusLabel } = require('../../domain/order-status')
const { formatPrice } = require('../../domain/menu')
const { callOrderApi } = require('../../services/cloudbase-orders')

function makeOrderView(order) {
  const items = order.items.map((item) => ({
    ...item,
    lineTotalLabel: formatPrice(item.priceFen * item.quantity)
  }))

  return {
    ...order,
    items,
    statusLabel: getOrderStatusLabel(order.status),
    totalLabel: formatPrice(order.totalFen),
    itemsSummary: items.map((item) => `${item.menuItemName} ${item.cupSizeName} ×${item.quantity}`).join('、')
  }
}

Page({
  data: {},

  onLoad(options = {}) {
    this.orderId = options.orderId || ''
    this.refreshOrders()
  },

  onShow() {
    if (this.hasLoaded) this.refreshOrders()
  },

  onPullDownRefresh() {
    this.refreshOrders()
    wx.stopPullDownRefresh()
  },

  async refreshOrders() {
    if (this.loadingOrders) return
    this.loadingOrders = true
    try {
      const page = await callOrderApi({ action: 'listMine' })
      this.setData({
        orders: page.orders.map(makeOrderView),
        nextOffset: page.nextOffset,
        hasMore: page.nextOffset !== null,
        isEmpty: page.orders.length === 0
      })
      if (this.orderId) await this.openOrder({ currentTarget: { dataset: { id: this.orderId } } })
    } catch (error) {
      this.setData({ orders: [], isEmpty: true })
      wx.showToast({ title: error.message || '订单加载失败', icon: 'none' })
    } finally {
      this.loadingOrders = false
      this.hasLoaded = true
    }
  },

  async loadMoreOrders() {
    if (this.loadingOrders || this.data.nextOffset === null || this.data.nextOffset === undefined) return
    this.loadingOrders = true
    this.setData({ isLoadingMore: true })
    try {
      const page = await callOrderApi({ action: 'listMine', offset: this.data.nextOffset })
      const orders = [...this.data.orders, ...page.orders.map(makeOrderView)]
      this.setData({ orders, nextOffset: page.nextOffset, hasMore: page.nextOffset !== null })
    } catch (error) {
      wx.showToast({ title: error.message || '订单加载失败', icon: 'none' })
    } finally {
      this.loadingOrders = false
      this.setData({ isLoadingMore: false })
    }
  },

  async openOrder(event) {
    try {
      const order = await callOrderApi({ action: 'getMine', orderId: event.currentTarget.dataset.id })
      this.setData({ selectedOrder: makeOrderView(order) })
    } catch (error) {
      this.setData({ selectedOrder: null })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  closeOrder() {
    this.setData({ selectedOrder: null })
  }
})
