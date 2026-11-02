function getOrCreateMockCustomerId() {
  let customerId = wx.getStorageSync('coffee-customer-id')
  if (!customerId) {
    customerId = `mock-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    wx.setStorageSync('coffee-customer-id', customerId)
  }

  return customerId
}

module.exports = { getOrCreateMockCustomerId }
