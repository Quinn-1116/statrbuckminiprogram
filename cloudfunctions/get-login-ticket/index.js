const tcb = require('@cloudbase/node-sdk')
const https = require('node:https')

const wechatRequestTimeoutMs = 5000
const maxWechatResponseBytes = 8 * 1024

function createHandler({ exchangeCode, createTicket }) {
  return async function handle(event = {}) {
    if (typeof event.code !== 'string' || event.code.length < 8 || event.code.length > 256) {
      throw new Error('微信登录凭证无效')
    }
    const identity = await exchangeCode(event.code)
    if (!identity || !identity.openid) throw new Error('无法验证微信身份')
    const ticket = await createTicket(identity.openid)
    return { ticket }
  }
}

let handler
exports.main = async (event) => {
  if (!handler) {
    const credentials = {
      private_key_id: process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID,
      private_key: process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY,
      env_id: process.env.TCB_ENV
    }
    if (!credentials.private_key_id || !credentials.private_key || !credentials.env_id) {
      throw new Error('CloudBase 自定义登录凭证尚未配置')
    }
    const app = tcb.init({ env: process.env.TCB_ENV, credentials })
    handler = createHandler({
      exchangeCode: (code) => exchangeWechatCode(code),
      createTicket: (openId) => app.auth().createTicket(openId, { refresh: 3600000 })
    })
  }
  return handler(event)
}

exports.createHandler = createHandler

function exchangeWechatCode(code) {
  if (!process.env.WX_APPID || !process.env.WX_SECRET) {
    throw new Error('微信小程序身份验证配置尚未完成')
  }
  const query = new URLSearchParams({
    appid: process.env.WX_APPID,
    secret: process.env.WX_SECRET,
    js_code: code,
    grant_type: 'authorization_code'
  })
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const request = https.get(`https://api.weixin.qq.com/sns/jscode2session?${query}`, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        fail(new Error(`微信身份校验失败 (http-${response.statusCode || 'unknown'})`))
        return
      }
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
        if (Buffer.byteLength(raw, 'utf8') > maxWechatResponseBytes) {
          response.destroy()
          fail(new Error('微信身份校验响应过大'))
        }
      })
      response.on('end', () => {
        if (settled) return
        try {
          const result = JSON.parse(raw)
          if (result.errcode || !result.openid) fail(new Error(`微信身份校验失败 (${result.errcode || 'invalid response'})`))
          else {
            settled = true
            resolve(result)
          }
        } catch (error) {
          fail(error)
        }
      })
    })
    request.setTimeout(wechatRequestTimeoutMs, () => {
      request.destroy(new Error('微信身份校验请求超时'))
    })
    request.on('error', fail)
  })
}
