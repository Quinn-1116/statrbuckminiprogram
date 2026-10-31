const drinkConfigurationKeys = [
  'menuItemId',
  'cupSize',
  'sweetness',
  'temperature',
  'milk'
]

function getConfiguredDrinkKey(drink) {
  return drinkConfigurationKeys.map((key) => drink[key]).join('|')
}

function sameConfiguration(left, right) {
  return getConfiguredDrinkKey(left) === getConfiguredDrinkKey(right)
}

function withLineTotal(drink) {
  return {
    ...drink,
    lineTotalFen: drink.priceFen * drink.quantity
  }
}

function normalizeCart(cart) {
  return cart.reduce((normalized, drink) => {
    const existingIndex = normalized.findIndex((line) => sameConfiguration(line, drink))
    if (existingIndex === -1) {
      normalized.push(withLineTotal({ ...drink }))
      return normalized
    }

    const existing = normalized[existingIndex]
    normalized[existingIndex] = withLineTotal({
      ...existing,
      quantity: existing.quantity + drink.quantity
    })
    return normalized
  }, [])
}

function addConfiguredDrink(cart, drink) {
  const normalizedCart = normalizeCart(cart)
  const existing = normalizedCart.find((line) => sameConfiguration(line, drink))
  if (!existing) {
    return [...normalizedCart, withLineTotal({ ...drink, quantity: 1 })]
  }

  return normalizedCart.map((line) => (sameConfiguration(line, drink)
    ? withLineTotal({ ...line, quantity: line.quantity + 1 })
    : line))
}

function setCartDrinkQuantity(cart, configuration, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('饮品数量必须是大于或等于零的整数')
  }

  const normalizedCart = normalizeCart(cart)
  if (quantity === 0) {
    return normalizedCart.filter((line) => !sameConfiguration(line, configuration))
  }

  return normalizedCart.map((line) => (sameConfiguration(line, configuration)
    ? withLineTotal({ ...line, quantity })
    : line))
}

function getCartTotalFen(cart) {
  return cart.reduce((total, line) => total + line.priceFen * line.quantity, 0)
}

module.exports = {
  addConfiguredDrink,
  getConfiguredDrinkKey,
  getCartTotalFen,
  normalizeCart,
  setCartDrinkQuantity
}
