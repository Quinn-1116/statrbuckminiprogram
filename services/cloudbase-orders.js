let client
let loginPromise
let callOverride

function getClient() {
  if (client) return client
  const cloudbase = require('@cloudbase/js-sdk')
  const adapter = require('@cloudbase/adapter-wx_mp').default
  cloudbase.useAdapters(adapter)
  const app = cloudbase.init({ env: 'colourful-wallaby-d3d2urb83c3777' })
  client = { app, auth: app.auth({ persistence: 'local' }) }
  return client
}

function requestLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code)
        else reject(new Error('微信登录失败，请重试'))
      },
      fail: reject
    })
  })
}

async function requestCustomTicket(app, code) {
  const response = await app.callFunction({ name: 'get-login-ticket', data: { code } })
  if (!response.result || !response.result.ticket) throw new Error('CloudBase 身份验证失败，请检查认证配置')
  return response.result.ticket
}

async function ensureLogin() {
  const { app, auth } = getClient()
  if (auth.hasLoginState()) return auth.currentUser
  if (!loginPromise) {
    loginPromise = (async () => {
      const code = await requestLoginCode()
      const ticket = await requestCustomTicket(app, code)
      return auth.signInWithCustomTicket(() => Promise.resolve(ticket))
    })().finally(() => { loginPromise = null })
  }
  return loginPromise
}

async function callOrderApi(event) {
  if (callOverride) return callOverride(event)
  const { app } = getClient()
  await ensureLogin()
  const result = await app.callFunction({ name: 'order-api', data: event })
  return result.result
}

function configureCallOverride(override) {
  callOverride = override
}

module.exports = { callOrderApi, configureCallOverride, ensureLogin }
