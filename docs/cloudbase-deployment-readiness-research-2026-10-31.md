# CloudBase 部署阻塞项研究（2026-10-31）

访问日期：2026-10-31。本文检查本地仓库、CloudBase/微信/SDK 一手资料，并对两个函数目录运行只读 `npm audit --omit=dev --json` 及 npm registry 元数据查询；没有连接 CloudBase 或微信账号、没有执行部署，也没有修改业务代码、依赖或锁文件。链接对应的官方页面可能更新；验收时应重新核对控制台和锁文件。

## 实施后状态（2026-10-31）

本文以下内容是改动前的审计快照。随后已在本地将两个函数迁移至 `@cloudbase/node-sdk@4.2.1`，以 npm override 固定 axios `1.21.0`；两函数当前锁文件的 `npm audit --omit=dev --json` 均为 0 项。订单列表已实现每页 50 条的有界分页和稳定排序，前端已提供加载更多。实现与当前验证情况以 `docs/cloudbase-security-review-2026-10-31.md` 为准。

仍未连接或写入 CloudBase/微信环境，因此身份隔离、`orders`/`customers` 数据库规则、云函数调用权限与限频、真实订单及管理员 UID、线上事务/分页行为仍须在测试环境联调后才能解除发布阻塞。

## 结论

**当前不能据现有证据判定可部署。** 有些代码层修复已在当前工作树实现，但认证身份映射、云端权限、实际 SDK 查询行为、漏洞影响和真实云函数运行都缺少端到端证据。原有 `docs/cloudbase-security-review-2026-10-31.md` 将这几项列为阻塞项，整体方向正确；本报告补充来源核实并修正容易过度推断的部分。

## 范围和本地事实

- 订单函数依赖 `@cloudbase/node-sdk` `3.18.7`；`get-login-ticket` 同版本，分别有独立 `package-lock.json`。小程序根项目另用 `@cloudbase/js-sdk` `2.27.3` 和 `@cloudbase/adapter-wx_mp` `1.3.1`。
- `get-login-ticket` 将微信 `jscode2session` 返回的 `openid` 传入 `app.auth().createTicket(openId, ...)`。客户端取得 ticket 后用 `signInWithCustomTicket` 登录。
- `order-api` 以 `app.auth().getAuthContext(context)` 取得身份；客户数据按 `context.uid` 读写，管理员操作以 `context.uid === ADMIN_UID` 判断。身份不从事件参数读取。
- 当前订单 `listAll` / `listMine` 查询未传 `.limit()` 或分页游标；`readOrders()` 和 `readCustomerOrders()` 都直接 `.get()`。`writeStatus` 使用 `runTransaction`，事务内只按文档 ID 读写单个订单。
- 已有本地安全审查记录：数据库 SDK 入参/返回形状、订单业务 ID 对齐已有代码修复及回归测试；订单行数和微信请求体大小/超时也有限制。但这不构成真实 CloudBase 验证。

## 1. SDK 版本与 npm audit

### 已核实

仓库锁文件固定 `@cloudbase/node-sdk@3.18.7`。SDK 包的 `package.json` 对 axios 使用精确依赖 `0.27.2`，并依赖数据库包；当前安装树中的 `lodash.set` 为 `4.3.2`、`lodash.unset` 为 `4.5.2`。这些版本来自两份函数锁文件/安装树，而不是推测。

本次在获得网络授权后，分别对两个函数目录运行只读 `npm audit --omit=dev --json`。两者都返回 5 项（4 高、1 中），受影响包和修复建议一致：`@cloudbase/node-sdk`、`@cloudbase/database`、axios、lodash.set、lodash.unset。npm audit 的修复建议是升级 `@cloudbase/node-sdk` 至 `3.0.0`，并明确 `isSemVerMajor: true`；这不是“可无风险升级”的证明，且需核对该版本是否真能解决全部 advisory、接口兼容和 Node 20 云函数行为。报告没有把 audit 数量等同于可利用漏洞数量。

锁定版本对应的 advisory 主要包括：

- axios `0.27.2`：`GHSA-wf5p-g6vw-rhxx`（CSRF，`>=0.8.1 <0.28.0`）、`GHSA-jr5f-v2jv-69x6`（绝对 URL 导致 SSRF/凭证泄露，`<0.30.0`）、`GHSA-3p68-rc4w-qgx5`（NO_PROXY 绕过，`<0.31.0`）、`GHSA-w9j2-pvgh-6h63`（validateStatus 合并策略，`<=0.31.0`）、`GHSA-9fr6-4gfg-395g`（prototype pollution gadget，`>=0.27.2 <0.34.0`），以及 npm audit JSON 中列出的其他 axios 修复不完整/NO_PROXY advisories。应以最新 audit JSON 中的 `via[].url` 和影响范围作为逐条清单。[GHSA-jr5f-v2jv-69x6](https://github.com/advisories/GHSA-jr5f-v2jv-69x6)、[GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g)
- lodash.set `4.3.2`：`GHSA-p6mc-m468-83gw`，prototype pollution，受影响范围 `>=3.7.0 <=4.3.2`。[GHSA-p6mc-m468-83gw](https://github.com/advisories/GHSA-p6mc-m468-83gw)
- lodash.unset `4.5.2`：`GHSA-f23m-r3pf-42rh` 和 `GHSA-xxjr-mmjv-4gpg`，`_.unset`/`_.omit` 数组路径绕过导致 prototype pollution，影响范围分别包括 `<4.18.0` 和 `<=4.5.2`。[GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh)、[GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg)

这些是依赖版本/公告匹配，不等于应用已证实可被远程利用。需要结合 SDK 调用路径、可控输入、部署网络能力评估可达性；但在未完成评估及修复前仍是部署阻塞项。

### 升级判断

升级到更新的 `@cloudbase/node-sdk` **尚不能判定为安全升级**。3.18.7 对 axios 精确 pin 到 `0.27.2`，数据库 `1.4.3` 也精确依赖含漏洞版本的 lodash.set/unset。npm audit 的 `fixAvailable` 给出的 `3.0.0` 是 major 变更且小于当前 `3.18.7`，不是可直接采纳的升级建议；需重新检查 registry 的可用版本和元数据、逐项验证审计输出及完整依赖树。若不存在兼容且清洁的 SDK 版本，就需要经验证的依赖替换/覆盖或等待上游修复，而非盲目降级/强制更新。升级前后均需对登录 ticket、auth context、数据库 CRUD、事务和最终函数包做回归。不得用 `npm audit fix --force` 代替兼容审查。

## 2. Custom ticket、uid/customUserId 与 getAuthContext

本地 SDK `types/index.d.ts` 声明 `getAuthContext(context)` 返回 `uid`、`loginType`，可选 `appId` / `openId`，**不包含 `customUserId`**。`getUserInfo()` 才分别返回 `uid`、`customUserId`、`openId`。对应 `dist/auth/index.js` 的 `getAuthContext` 实现从本次 context 解析 `TCB_UUID` 与 `LOGINTYPE`；在 `createTicket(uid, options)` 实现中，传入值作为请求参数 `uuid` 发送，SDK 官方 auth 文档将该参数称为自定义用户 ID。也就是说“票据入参”与“平台返回的 uid/customUserId”术语存在映射，需要以服务端实际认证上下文验证，不能把 `createTicket` 的参数名误当成最终 `uid` 的定义。[官方 SDK auth 文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/auth.md)；[SDK auth 源码](https://github.com/TencentCloudBase/node-sdk/blob/master/src/auth/index.ts)

因此：

- `openid` 是微信侧应用用户标识；本实现选择把已由微信服务端验证的 OpenID 作为 custom-ticket 输入，这是应用自己的身份映射决策。
- 不能由参数名或旧文档单独推出 CloudBase 最终认证上下文里的 `uid` 一定等于 OpenID，亦不能把 `customUserId` 和 `uid` 混为同一字段。当前代码以 `context.uid` 做客户主键与管理员白名单，只有真实登录后返回值和真实调用上下文才能证实这一映射。
- `getAuthContext(context)` 适用于在云函数调用中解析**该次调用**的认证上下文；当前函数传入 `main(event, context)` 的 `context`，符合接口形态。它不会自动完成业务授权，也不代表调用者已登录。代码必须拒绝空 `uid`，并对管理员使用独立 allowlist 判断；现有实现有这两层判断。
- SDK 的 `getAuthContext` 返回中 `uid` 是身份字段；调用方不能从请求 event 接受用户 UID。管理员 `ADMIN_UID` 必须与其实际 CloudBase 登录态核对，且需要验证未登录/匿名、普通客户、管理员三种调用路径。

**未验证**：自定义 ticket 兑换后的真实 `uid`、`customUserId`、`openId` 值；不同函数调用间上下文隔离；浏览器管理员登录是否返回配置的 UID。需在隔离测试环境做真实认证并记录脱敏后的字段与测试账号角色。

## 3. 数据库规则与云函数调用权限

CloudBase 官方数据库文档说明：集合权限可使用基本权限或安全规则；安全规则配置包含 `read` / `write` 表达式，创建、更新、删除继承 write；官方还明确前端查询条件必须是安全规则限制的子集。配置入口在 CloudBase 控制台的文档型数据库集合权限管理。[数据库安全规则](https://docs.cloudbase.net/en/database/security-rules)；[基本权限](https://docs.cloudbase.net/en/database/data-permission)

本项目所有读写都经服务端函数，因此 `orders`、`customers` 对客户端应配置明确拒绝（例如安全规则 `{"read": false, "write": false}`，或基本权限“无权限”），再确认服务端 Node SDK/云函数仍可访问。不要配置客户端所有人可读写，也不要误把针对微信 `_openid` 的 owner 模板套到当前以 CloudBase `uid` 绑定、且业务上必须由服务端访问的模型上。需分别对小程序客户、管理员浏览器客户端尝试直接读、写、创建、更新、删除，确认全部拒绝；同时用函数验证预期服务端读写正常。

函数调用权限与函数内部业务授权是两层。官方函数安全规则是环境级 JSON，要求有 `*` 通配配置，各 function 配置 `invoke`；客户端 `callFunction` 适用，管理端 API、定时器、数据库触发器不适用。规则值支持公开、登录态等简单表达式，具体 UID/角色限制不应只靠函数级规则，应由函数代码或 OPA 完成。[函数访问控制](https://docs.cloudbase.net/cloud-function/security-rules)

- `order-api` 必须仅允许已认证调用（匿名登录应排除）；应用内仍由函数用真实 `uid` 分流客户/管理员权限。当前控制台规则未提供，无法核实是否配置。
- `get-login-ticket` 在认证前由小程序调用，故调用规则需要允许未登录客户端到达该函数；但这使函数可被滥用。其内部只接受短期 `wx.login` code 并向微信校验，代码设有超时/响应大小限制；平台侧仍需配置调用频率限制、资源上限和告警。CloudBase 函数配置提供限频能力。[函数配置与限频入口](https://docs.cloudbase.net/cloud-function/function-configuration/config)
- 不要为了 ticket 函数方便而把环境内所有函数设为公开。按环境级规则单独覆盖目标函数，并检查通配默认规则。

## 4. 查询分页与事务契约

CloudBase Node SDK 官方数据库文档列出 `limit()`、`skip()`、`orderBy()`、`get()` 等查询方法；新版 API 参考给出的最大返回条数为 1000，`skip` 要求非负整数。[Node SDK 数据库文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)；[查询 API（limit/skip）](https://docs.cloudbase.net/en/api-reference/webv3-pg/database)

当前订单查询没有 limit、skip 或稳定排序。因此即使 SDK/服务端限制单次返回条数，代码也没有显式完整分页；大于单页的数据可能被截断或性能随数据增长恶化。需为用户订单和管理列表分别制定有界 page size、稳定排序（例如 `createdAt` 加 `_id` 唯一 tie-breaker）、下一页游标/偏移策略和筛选条件。`skip` 对不断变化的订单列表可能跨页重复或漏项；上线前应按实际数据库支持确认是否可使用基于排序键的 keyset pagination。文档中的 1000 上限来自 Web v3 API 参考，不能不加验证地视为本仓库 node-sdk 3.x 每个运行模式的精确硬上限。

官方事务文档说明事务仅支持服务端 Node SDK；事务操作表明确当前事务只支持单文档操作，并列出事务读写方法。[事务操作](https://docs.cloudbase.net/en/database/transaction)。当前 `writeStatus` 的事务仅涉及一份订单文档，与此范围一致，但本地 fake DB 测试不能证明 CloudBase 的真实冲突检测、重试、提交结果或并发状态迁移。部署验收需对同一订单并发推进状态，确认最多一个合法的一步状态变化成功，失败/重试不产生跳级、覆盖或重复副作用。

## 5. 已修复与仍存问题

| 项目 | 当前判断 | 依据/剩余动作 |
|---|---|---|
| SDK set/update 数据形状、文档返回形状 | 本地代码已按 SDK 形状修复；现有回归测试在本轮前已通过 35/35 | 测试替身不能替代 CloudBase 实际读写 |
| 订单业务 ID 与文档 ID | 已修复：创建用 `.doc(id).set(order)`，状态更新同一 doc ID | 仍需验证重复请求、冲突及事务行为 |
| 身份从请求体伪造 | 当前代码使用 SDK auth context，而非 event UID | ticket 映射和真实 `uid` 尚未实测 |
| 数据库客户端权限 | 文档要求显式规则；仓库只有部署说明，未见云端配置证据 | 两个集合需验证各角色直连读写全部拒绝 |
| 函数调用权限 | 尚无控制台配置/导出证据 | `order-api` 登录调用；`get-login-ticket` 必须可预登录调用且限频 |
| 分页 | 未实现 | 两类列表都需显式有界分页与稳定排序 |
| 事务 | 代码结构符合单文档事务范围 | 真实云端并发语义仍未知 |
| 依赖漏洞 | 锁文件含受影响依赖；旧报告有 audit 计数 | 重新导出 JSON 并逐 advisory 做路径分析；选定经回归验证的修复 |
| 构建/测试 | 原有安全审查记录了测试和构建通过 | 仅证明本地构建，不证明函数运行时、权限或真实数据链可用 |

## 6. 离线不可验证项与部署前验收证据

以下事实无法从仓库或静态 SDK 类型确认，部署前应在专用/可回滚环境收集证据：

1. **身份证据**：两名不同微信客户完成真实登录后，`getAuthContext(context)` 的 `uid` 与 ticket 映射关系；管理员真实登录 UID 与 `ADMIN_UID` 一致。日志需脱敏，不打印 ticket、密钥或完整凭证。
2. **隔离证据**：客户 A 的列表/详情仅有 A 的订单；A 请求 B 的订单 ID 被拒绝或返回不可区分的 not-found；匿名、伪造 event 字段、普通客户调用管理员操作均失败；管理员才可列出/推进订单。
3. **规则证据**：控制台导出的 `orders`、`customers` 权限规则及函数 invoke 规则；小程序客户和管理员客户端对 collections 的直接 CRUD 测试均拒绝；服务端函数访问仍通过。
4. **真实运行证据**：Node 20 云函数部署包包含入口和生产依赖、不含本地凭证/测试数据；函数冷启动、登录票据、建档、创建订单、读列表/详情、状态推进有成功响应及云端日志 request ID。
5. **分页/事务证据**：多页数据集的条数、排序、无重无漏；同一订单并发更新与重复提交结果；事务冲突/重试和异常路径记录。
6. **供应链证据**：两函数分别对最终部署目录执行 `npm audit --omit=dev --json` 并保存脱敏报告；逐项 advisory 的受影响版本、修复版本、可达调用点、缓解条件；候选 SDK/覆盖版本完整锁定后重新测试。
7. **运行配置证据**：环境 ID、函数运行时/超时/限频、环境变量名称已配置但值不外泄；trusted domain/CORS、管理员账号关闭公开注册；预算/资源点基线与测试前后差值。避免开启付费升级或生产写入，除非取得明确授权。

## 参考资料

以下一手来源均于 2026-10-31 访问：

- [npm：@cloudbase/node-sdk](https://www.npmjs.com/package/%40cloudbase/node-sdk)
- [TencentCloudBase/node-sdk：auth 文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/auth.md)
- [TencentCloudBase/node-sdk：auth 源码](https://github.com/TencentCloudBase/node-sdk/blob/master/src/auth/index.ts)
- [CloudBase：数据库安全规则](https://docs.cloudbase.net/en/database/security-rules)
- [CloudBase：数据库基本权限](https://docs.cloudbase.net/en/database/data-permission)
- [CloudBase：云函数访问控制](https://docs.cloudbase.net/cloud-function/security-rules)
- [CloudBase：云函数基础配置与限频](https://docs.cloudbase.net/cloud-function/function-configuration/config)
- [CloudBase：数据库事务](https://docs.cloudbase.net/en/database/transaction)
- [CloudBase：Node SDK 数据库操作文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)
- [CloudBase：查询 API limit/skip](https://docs.cloudbase.net/en/api-reference/webv3-pg/database)
- [GitHub Advisory GHSA-9fr6-4gfg-395g（axios）](https://github.com/advisories/GHSA-9fr6-4gfg-395g)
- [GitHub Advisory GHSA-p6mc-m468-83gw（lodash.set）](https://github.com/advisories/GHSA-p6mc-m468-83gw)
- [GitHub Advisory GHSA-f23m-r3pf-42rh（lodash.unset）](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh)
- [GitHub Advisory GHSA-xxjr-mmjv-4gpg（lodash.unset）](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg)

