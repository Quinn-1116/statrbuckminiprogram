# CloudBase friend-test setup

Environment: `colourful-wallaby-d3d2urb83c3777` (free trial). The mini program uses the CloudBase JavaScript SDK and custom authentication; it does not use `wx.cloud` because this is a standalone CloudBase environment.

## Secrets and identities

Configure these values in the CloudBase function settings, never in Git or chat:

- Both functions: `TCB_ENV=colourful-wallaby-d3d2urb83c3777`.
- `get-login-ticket`: `WX_APPID=wx6254058434908874`, `WX_SECRET` from the WeChat mini-program console, `TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID`, and `TCB_CUSTOM_LOGIN_PRIVATE_KEY` from the CloudBase custom-login key pair.
- `order-api`: `ADMIN_UID=2116328262249512960`.

Console verification on 2026-10-31: custom authentication is enabled, anonymous login is disabled, and username/password login is enabled. The only listed user is the active `administrator` account, whose UID matches `ADMIN_UID`. Do not enable public registration. The console's registration policy was not independently verified. The login-ticket function must be callable before a user is authenticated; it accepts only a short-lived `wx.login` code, exchanges it with WeChat, and issues a signed CloudBase ticket for the verified OpenID.

## PGDoc environment and permissions

The selected environment uses CloudBase PostgreSQL with the `pgdoc` Document plugin enabled. The console's PostgreSQL > Document editor opens the `pgdoc_data` schema. As verified on 2026-10-31, both `orders` and `customers` collections exist there. The legacy document-database route still reports that the feature is unavailable; use the PostgreSQL Document editor instead.

In PG mode, document collections use the document API but do not support traditional document security rules. The collection permission selector offers `ADMINONLY` (no client access); PostgreSQL table access is separately governed by GRANT and row-level security (RLS). Both `orders` and `customers` were verified as `ADMINONLY` in the console on 2026-10-31. Verify server-side Cloud Function access before enabling invocations. Do not manually alter plugin-owned schemas or objects. The two functions have not been deployed. Do not upgrade this trial or enable pay-as-you-go without separate explicit approval.

## Build and deploy

From the repository root, run `npm ci`, then run `npm ci` in each function directory using its lockfile, followed by `npm run build:functions` and `npm run build:admin`. Both functions use `@cloudbase/node-sdk@4.2.1`; their lockfiles override axios to `1.21.0` to address the SDK's pinned vulnerable version. Keep that override when refreshing dependencies and rerun `npm audit --omit=dev`. Build the WeChat mini-program npm package in WeChat DevTools before previewing. Deploy the two generated Node 20 function entrypoints as `get-login-ticket` and `order-api` to the environment above. Set the function environment variables before enabling invocations. Do not upload `.env` files or local credentials.

Create `orders` and `customers` collections. Deny direct client reads and writes; all access goes through the functions. The `order-api` function scopes customer history and detail queries by authenticated CloudBase UID, and only exposes all-order reads/status changes to the configured administrator UID.

Add the mini-program AppID and its CloudBase environment to the WeChat/CloudBase trusted-domain configuration. For the web manager, host the generated static admin page over HTTPS and add that origin to CloudBase's trusted domains/CORS configuration. Do not expose the local Node admin server publicly.

## End-to-end verification

1. Sign in with two invited WeChat accounts. Confirm each first checkout asks for and retains a pickup name.
2. Submit one order from each account. Confirm the server-derived total, store, China Standard Time pickup slot, and initial status.
3. Open each account's history and verify it only returns its own order; try the other account's order ID and verify access is denied.
4. Sign in to the web manager with the provisioned account. Confirm both orders appear, advance one status by one step, and verify that customer's history reflects the change.
5. Confirm a non-admin CloudBase account cannot list or update all orders, and direct database access is denied.
6. Review CloudBase resource-point usage before and after the test. Stop before upgrading the plan or enabling pay-as-you-go.

This checklist is not evidence that deployment or end-to-end verification has already happened. As of 2026-10-31, both committed function lockfiles pass `npm audit --omit=dev`; repeat the audit against the exact deployment package. Do not enable public invocations until identity mapping, database rules, function access control, rate limits, and cross-account isolation have passed the real-account checks above.
