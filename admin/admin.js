const orderStatuses = ['Pending', 'Preparing', 'Ready for Pickup', 'Picked Up']
const statusLabels = {
  Pending: '待制作',
  Preparing: '制作中',
  'Ready for Pickup': '可取餐',
  'Picked Up': '已取走'
}

const loginView = document.querySelector('#login-view')
const adminView = document.querySelector('#admin-view')
const loginForm = document.querySelector('#login-form')
const loginError = document.querySelector('#login-error')
const pageError = document.querySelector('#page-error')
const orderList = document.querySelector('#order-list')
const shopFilter = document.querySelector('#shop-filter')
const statusFilter = document.querySelector('#status-filter')

function formatPrice(priceFen) {
  const amount = priceFen / 100
  return `¥${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

async function request(path, options = {}) {
  if (path === '/api/session') {
    if (!window.shikeCloudBase.hasLoginState()) throw new Error('请先登录管理员账号')
    return { authenticated: true }
  }
  if (path === '/api/orders' || path.startsWith('/api/orders?')) {
    const url = new URL(path, window.location.origin)
    return window.shikeCloudBase.callOrderApi({
      action: 'listAll',
      filters: {
        shopId: url.searchParams.get('shopId') || '',
        status: url.searchParams.get('status') || ''
      },
      offset: Number(url.searchParams.get('offset') || 0)
    })
  }
  const statusRoute = path.match(/^\/api\/orders\/([^/]+)\/status$/)
  if (statusRoute && options.method === 'POST') {
    const { nextStatus } = JSON.parse(options.body || '{}')
    return window.shikeCloudBase.callOrderApi({
      action: 'updateStatus',
      orderId: decodeURIComponent(statusRoute[1]),
      nextStatus
    })
  }
  throw new Error('不支持的操作')
}

function showLogin(message = '') {
  loginView.hidden = false
  adminView.hidden = true
  loginError.textContent = message
}

function showAdmin() {
  loginView.hidden = true
  adminView.hidden = false
  loadOrders()
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function nextStatus(status) {
  const index = orderStatuses.indexOf(status)
  return orderStatuses[index + 1] || ''
}

function renderOrders(orders, append = false) {
  if (!append) orderList.replaceChildren()
  if (orders.length === 0 && !append) {
    orderList.append(makeElement('p', 'empty-state', '没有符合条件的订单'))
    return
  }

  for (const order of orders) {
    const row = makeElement('article', 'order-row')
    const primary = makeElement('div', 'order-primary')
    const top = makeElement('div', 'order-topline')
    top.append(
      makeElement('h2', 'pickup-name', order.pickupName),
      makeElement('span', 'status-label', statusLabels[order.status] || order.status)
    )
    primary.append(top, makeElement('p', 'order-time', `${order.shopName} · ${order.pickupTimeLabel}`))

    const itemList = makeElement('ul', 'item-list')
    for (const item of order.items) {
      itemList.append(makeElement('li', '', `${item.menuItemName} ${item.cupSizeName} ×${item.quantity}`))
    }
    primary.append(itemList)

    const action = makeElement('div', 'order-action')
    action.append(makeElement('strong', 'order-total', formatPrice(order.totalFen)))
    const following = nextStatus(order.status)
    if (following) {
      const button = makeElement('button', 'advance-button', `推进至${statusLabels[following]}`)
      button.type = 'button'
      button.addEventListener('click', () => advanceOrder(order.id, following))
      action.append(button)
    }
    row.append(primary, action)
    orderList.append(row)
  }
}

async function loadOrders({ append = false } = {}) {
  pageError.textContent = ''
  const query = new URLSearchParams()
  if (shopFilter.value) query.set('shopId', shopFilter.value)
  if (statusFilter.value) query.set('status', statusFilter.value)
  const offset = append ? (Number(orderList.dataset.nextOffset) || 0) : 0
  if (offset) query.set('offset', String(offset))

  try {
    const page = await request(`/api/orders?${query}`)
    renderOrders(page.orders, append)
    orderList.dataset.nextOffset = page.nextOffset === null ? '' : String(page.nextOffset)
    loadMoreButton.hidden = page.nextOffset === null
  } catch (error) {
    if (error.status === 401) showLogin('登录状态已失效，请重新登录')
    else pageError.textContent = error.message
  }
}

const loadMoreButton = document.querySelector('#load-more-orders')
loadMoreButton.addEventListener('click', () => loadOrders({ append: true }))

async function advanceOrder(orderId, next) {
  pageError.textContent = ''
  try {
    await request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ nextStatus: next })
    })
    await loadOrders()
  } catch (error) {
    if (error.status === 401) showLogin('登录状态已失效，请重新登录')
    else pageError.textContent = error.message
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  loginError.textContent = ''
  const form = new FormData(loginForm)
  try {
    await window.shikeCloudBase.login(form.get('username'), form.get('password'))
    loginForm.reset()
    showAdmin()
  } catch (error) {
    loginError.textContent = error.message
  }
})

document.querySelector('#logout-button').addEventListener('click', async () => {
  await window.shikeCloudBase.logout()
  showLogin()
})
shopFilter.addEventListener('change', loadOrders)
statusFilter.addEventListener('change', loadOrders)

request('/api/session')
  .then(showAdmin)
  .catch(() => showLogin())
