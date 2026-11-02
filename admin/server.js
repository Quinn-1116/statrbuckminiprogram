const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { filterAndSortOrders, updateOrderStatus } = require('../domain/order-manager')
const { createMockOrders } = require('./mock-orders')

const sessionLifetimeMs = 8 * 60 * 60 * 1000
const maxRequestBytes = 64 * 1024

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (Buffer.byteLength(body) > maxRequestBytes) {
        reject(Object.assign(new Error('请求内容过大'), { statusCode: 413 }))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(Object.assign(new Error('请求格式无效'), { statusCode: 400 }))
      }
    })
    request.on('error', reject)
  })
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  })
  response.end(JSON.stringify(payload))
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || ''
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : ''
}

function isSameOriginRequest(request) {
  const origin = request.headers.origin
  if (!origin) return true

  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function createAdminServer({ username, password, orders = createMockOrders(), cloudBaseOnly = false }) {
  if (!cloudBaseOnly && (!username || !password || password.length < 12)) {
    throw new Error('管理员账号需通过环境变量配置，密码至少 12 个字符')
  }

  let storedOrders = orders.map((order) => ({
    ...order,
    items: Array.isArray(order.items) ? order.items.map((item) => ({ ...item })) : []
  }))
  const sessions = new Map()

  function authorized(request) {
    const token = getCookie(request, 'shike_admin_session')
    const expiresAt = sessions.get(token)
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token)
      return false
    }
    return true
  }

  function requireAuthorization(request, response) {
    if (authorized(request)) return true
    sendJson(response, 401, { error: '请先登录管理员账号' })
    return false
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')

    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')) {
        const html = fs.readFileSync(path.join(__dirname, 'index.html'))
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'self'; connect-src 'self' https://*.tcb-api.tencentcloudapi.com wss://tcb-ws.tencentcloudapi.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        })
        response.end(html)
        return
      }

      if (request.method === 'GET' && ['/admin.js', '/admin.css', '/cloudbase.bundle.js'].includes(url.pathname)) {
        const extension = path.extname(url.pathname)
        const contentType = extension === '.js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8'
        const asset = fs.readFileSync(path.join(__dirname, path.basename(url.pathname)))
        response.writeHead(200, { 'content-type': contentType, 'x-content-type-options': 'nosniff' })
        response.end(asset)
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const credentials = await readJson(request)
        if (!safeEqual(credentials.username || '', username) || !safeEqual(credentials.password || '', password)) {
          sendJson(response, 401, { error: '账号或密码不正确' })
          return
        }

        const token = crypto.randomBytes(32).toString('base64url')
        sessions.set(token, Date.now() + sessionLifetimeMs)
        sendJson(response, 200, { authenticated: true }, {
          'set-cookie': `shike_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeMs / 1000}`
        })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        const token = getCookie(request, 'shike_admin_session')
        sessions.delete(token)
        sendJson(response, 200, { authenticated: false }, {
          'set-cookie': 'shike_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
        })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/session') {
        sendJson(response, authorized(request) ? 200 : 401, { authenticated: authorized(request) })
        return
      }

      if (url.pathname.startsWith('/api/')) {
        if (!requireAuthorization(request, response)) return

        if (request.method !== 'GET' && !isSameOriginRequest(request)) {
          sendJson(response, 403, { error: '请求来源无效' })
          return
        }

        if (request.method === 'GET' && url.pathname === '/api/orders') {
          const filteredOrders = filterAndSortOrders(storedOrders, {
            shopId: url.searchParams.get('shopId') || '',
            status: url.searchParams.get('status') || ''
          })
          sendJson(response, 200, filteredOrders)
          return
        }

        const statusRoute = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/)
        if (request.method === 'POST' && statusRoute) {
          const { nextStatus } = await readJson(request)
          storedOrders = updateOrderStatus(storedOrders, decodeURIComponent(statusRoute[1]), nextStatus)
          sendJson(response, 200, storedOrders.find((order) => order.id === decodeURIComponent(statusRoute[1])))
          return
        }
      }

      sendJson(response, 404, { error: '未找到请求的页面' })
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || '请求失败' })
    }
  })
}

if (require.main === module) {
  const server = createAdminServer({
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    cloudBaseOnly: true
  })
  const port = Number(process.env.PORT || 4177)
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Order manager available at http://127.0.0.1:${port}\n`)
  })
}

module.exports = { createAdminServer }
