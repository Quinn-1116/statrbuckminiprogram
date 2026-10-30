const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createConfiguredDrink,
  formatPrice,
  getConfiguredPriceFen,
  getCustomizationOptions,
  getMenuItems
} = require('../domain/menu')

test('menu offers the three agreed drinks with their Medium prices', () => {
  assert.deepEqual(
    getMenuItems().map(({ id, name, mediumPriceFen }) => ({ id, name, mediumPriceFen })),
    [
      { id: 'americano', name: '美式咖啡', mediumPriceFen: 1800 },
      { id: 'latte', name: '拿铁咖啡', mediumPriceFen: 2200 },
      { id: 'mocha', name: '摩卡咖啡', mediumPriceFen: 2400 }
    ]
  )
})

test('each drink offers the agreed cup sizes and customization choices', () => {
  const options = getCustomizationOptions()

  assert.deepEqual(options.cupSizes.map(({ id, name, extraPriceFen }) => ({ id, name, extraPriceFen })), [
    { id: 'medium', name: '中杯', extraPriceFen: 0 },
    { id: 'large', name: '大杯', extraPriceFen: 400 }
  ])
  assert.deepEqual(options.sweetness.map(({ name }) => name), ['无糖', '半糖', '全糖'])
  assert.deepEqual(options.temperature.map(({ name }) => name), ['冰', '热'])
  assert.deepEqual(options.milk.map(({ name }) => name), ['默认牛奶', '燕麦奶'])
})

test('configured price uses the selected drink and cup size only', () => {
  const cases = [
    { menuItemId: 'americano', medium: 1800, large: 2200 },
    { menuItemId: 'latte', medium: 2200, large: 2600 },
    { menuItemId: 'mocha', medium: 2400, large: 2800 }
  ]

  for (const item of cases) {
    const base = {
      menuItemId: item.menuItemId,
      sweetness: 'none',
      temperature: 'hot',
      milk: 'oat'
    }

    assert.equal(getConfiguredPriceFen({ ...base, cupSize: 'medium' }), item.medium)
    assert.equal(createConfiguredDrink({ ...base, cupSize: 'large' }).priceFen, item.large)
    assert.equal(
      getConfiguredPriceFen({ ...base, cupSize: 'large', sweetness: 'full', temperature: 'iced', milk: 'regular' }),
      item.large
    )
  }

  assert.equal(formatPrice(2800), '¥28')
})

test('configured price rejects unknown menu items and cup sizes', () => {
  assert.throws(
    () => getConfiguredPriceFen({ menuItemId: 'tea', cupSize: 'medium' }),
    /请选择有效的饮品和杯型/
  )
  assert.throws(
    () => getConfiguredPriceFen({ menuItemId: 'americano', cupSize: 'extra-large' }),
    /请选择有效的饮品和杯型/
  )
  assert.throws(
    () => createConfiguredDrink({
      menuItemId: 'americano',
      cupSize: 'medium',
      sweetness: 'syrup',
      temperature: 'hot',
      milk: 'regular'
    }),
    /请选择有效的饮品定制项/
  )
})

test('configured drink summary contains the selected drink and every customization', () => {
  const configuredDrink = createConfiguredDrink({
    menuItemId: 'latte',
    cupSize: 'large',
    sweetness: 'half',
    temperature: 'iced',
    milk: 'oat'
  })

  assert.deepEqual(
    [
      configuredDrink.menuItemName,
      configuredDrink.cupSizeName,
      configuredDrink.sweetnessName,
      configuredDrink.temperatureName,
      configuredDrink.milkName,
      formatPrice(configuredDrink.priceFen)
    ],
    ['拿铁咖啡', '大杯', '半糖', '冰', '燕麦奶', '¥26']
  )
})
