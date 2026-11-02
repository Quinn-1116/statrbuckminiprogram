const { ensureLogin } = require('./services/cloudbase-orders')

App({
  onLaunch() {
    try {
      ensureLogin().catch((error) => console.error('CloudBase 登录失败', error.message))
    } catch (error) {
      console.error('CloudBase 初始化失败', error.message)
    }
  }
})
