const test = require('node:test')
const assert = require('node:assert/strict')

const { createHandler } = require('../cloudfunctions/get-login-ticket/index')

test('ticket is issued only for an OpenID verified from a one-time WeChat code', async () => {
  const issuedFor = []
  const handler = createHandler({
    exchangeCode: async (code) => ({ openid: code === 'valid-code-123' ? 'verified-openid' : '' }),
    createTicket: async (uid) => {
      issuedFor.push(uid)
      return 'signed-ticket'
    }
  })

  assert.deepEqual(await handler({ code: 'valid-code-123' }), { ticket: 'signed-ticket' })
  assert.deepEqual(issuedFor, ['verified-openid'])
})

test('invalid login codes and unverifiable identities do not issue tickets', async () => {
  const handler = createHandler({
    exchangeCode: async () => ({ errcode: 40029 }),
    createTicket: async () => assert.fail('must not issue a ticket')
  })

  await assert.rejects(handler({ code: 'short' }), /微信登录凭证无效/)
  await assert.rejects(handler({ code: 'valid-code-123' }), /无法验证微信身份/)
})
