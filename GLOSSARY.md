# Coffee Ordering

This project models 拾刻咖啡, a fictional small coffee shop ordering experience for learning and sharing with friends. Its first version supports pickup orders without real payment. The initial test is limited to 5–10 invited friends, and customer-facing and management interfaces use Simplified Chinese.

## People and Orders

**Menu Item**:
A coffee drink offered for customers to select and order.
_Avoid_: Product, SKU

**Customer**:
A person who signs in with a WeChat identity, confirms a pickup name on first use, places coffee orders, and can view only their own orders.
_Avoid_: User

**Pickup Name**:
The name shown to the order manager to identify a customer at pickup; it may default to the customer's WeChat nickname.
_Avoid_: Account name, login name

**Order**:
A customer's request to prepare one or more configured drinks for pickup.
_Avoid_: Purchase, transaction

**Cart**:
A customer's unsubmitted selection of configured drinks.
_Avoid_: Basket

**Configured Drink**:
One menu item with a selected cup size, sweetness, temperature, and milk type; identical configurations may be represented with a quantity.
_Avoid_: Order line, SKU

**Customization**:
The customer's choices for how a menu drink is prepared, such as sweetness, temperature, or milk type.
_Avoid_: Modifier

**Cup Size**:
A selectable serving size for a menu drink; the first version offers Medium and Large.
_Avoid_: Portion

**Shop**:
A fictional coffee shop location where an order is collected; the first version has Yunshan Shop and Hupan Shop.
_Avoid_: Store, branch

**Pickup Time**:
The scheduled time when a customer plans to collect an order from a shop.
_Avoid_: Reservation time, delivery time

**Order Manager**:
The person responsible for reviewing orders submitted by customers through a separate management page.
_Avoid_: Admin, owner

**Administrator Account**:
The separate credential used by the order manager to sign in to the web management page.
_Avoid_: Customer account

**Pickup**:
Collecting a placed order at the shop, rather than dining in or receiving delivery.
_Avoid_: Takeout, delivery
