const cloudbase = require('@cloudbase/js-sdk')

const app = cloudbase.init({ env: 'colourful-wallaby-d3d2urb83c3777' })
const auth = app.auth({ persistence: 'local' })

window.shikeCloudBase = {
  async login(username, password) {
    const result = await auth.signInWithPassword({ username, password })
    if (result.error) throw new Error(result.error.message || '账号或密码不正确')
    return result.data
  },
  async logout() {
    await auth.signOut()
  },
  hasLoginState() {
    return Boolean(auth.hasLoginState())
  },
  async callOrderApi(data) {
    const response = await app.callFunction({ name: 'order-api', data })
    return response.result
  }
}
