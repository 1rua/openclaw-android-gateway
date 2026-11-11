# 当前 OAI 契约快照同步验证

日期：2026-11-12。Canonical 仓库：`1rua/openclaw-android-gateway`。关联本仓 #3、草稿 PR #4、`1rua/open-android-intelligence#170`。

执行源码固定提交：`8ad90bcb52e298242f7726acc7724eb52b2551d8`。本报告与证据由后续文档提交纳管，执行源码没有在证据提交中修改。

## 结论与改动

当前固定 OpenClaw 的契约快照真实落后于 OAI，并非 PR 合成 merge 或比较目录错误。本修复使用原生成器，把 `contract-pin.json` 指向 OAI 不可变提交 `02ad53e09049c2b06c21cacd9d009c2f14e6d5bd`，同步 4 个源文件并由原 build 生成 4 个对应 runtime 文件。静态清单的 `capabilitySchemaHash` 由实际 `coreSchemaHash()` 计算更新，README 同步固定来源。

未修改 checker、生成器、业务路由或既有能力声明。保持 `1.1.0` 元数据，不创建标签或 Release；安装和 OAI 固定版本必须使用经审查的完整源码提交。新 caller/push 定义可验证，并不等于声明本插件新增了设备授权或主动推送业务处理器。

## 诊断事实

OAI Full CI `43094885415` / job `130781201049` 在历史 Hermes 真实 vectors `70/70` 后，原命令 `python gateway-contract/tools/check-contract-pin.py --plugin-root-env OPENCLAW_PLUGIN_ROOT` 退出 1。插件版本为 `c7c087b9fe28adcc658a1cbdb71689a377b65214`，原契约 pin 为 `f0b3f1bd4f6f3301b820e38c9f3241bcac05cd10`。

Runner `105d9d5bf44270157f45bd00bf2f5748205cbade` 是 PR #143 的合成 merge，其父提交为 main `d88fffed134f57c5cf6ca4733e65b61f6e13120d` 与 dev `02ad53e09049c2b06c21cacd9d009c2f14e6d5bd`；runner 与 dev 的整 tree 相同，均为 `1cd2028c652fefcd7c5e9fea666dbd9b57054c35`。逐文件比较全部 26 份受管输入，原插件包与旧 pin 完全相同，dev 与 runner 完全相同，旧 pin 与当前仅以下 4 份不同：

- `gateway-contract/core-dispatched-schemas.json`
- `gateway-contract/schemas/device-request.schema.json`
- `gateway-contract/schemas/event.schema.json`
- `gateway-contract/src/schema-registry.ts`

内容来源为 OAI `17895223c16fc84dfbe7c889943a608f7fbaa095`，加入 caller、授权进度与 push Schema，并修改 device.requested 分派摘要；该提交没有同步实现 pin。隔离 runner 检出的原 checker 退出 1，底层 Git diff 退出 1 且 stderr 为空，而对 HEAD 自身的受管路径比较退出 0，确认不是 Git 执行错误。OpenClaw 自身快照检查亦报 pin 不一致。原失败输出及全文件摘要均保留在证据目录。

## 现有修订核验

Canonical 仓库没有 dev 分支，修复基线为 main `35b2a595fd4374eb64761d08a90d83ea5390570f`。main 与此前 OAI 固定 c7c087b9 的 tree 均为 `bfcbb48a7ea2136c22059552338b10ef9c9c9dee`。已对所有现有分支和 `v1.0.0`、`v1.0.1`、`v1.0.2` 的完整受管输入比较，均不匹配；main 仅 22/26 匹配。最新 tag `v1.0.2` 与最新 GitHub Release `v1.0.1` 分开记录，没有把主分支 1.1.0 当作已发布标签。候选表保留完整 SHA 和所有差异路径。

基线没有 AGENTS.md、CLAUDE.md 或专门发布指引；已阅读 README 与 CI 的原生成/校验/构建/原生安装流程，保持单一 OAI 契约源与包内生成快照。

## 验证方法

全部命令从本任务独立工作树运行，使用 Node `24.18.0`、固定依赖锁和专用隔离状态目录。`OPEN_ANDROID_GATEWAY_CONTRACT_ROOT` 指向已验证与目标 OAI 提交内容完全相同的固定检出。依赖复用记录见 `environment.json`。

```bash
python tools/test_contract_source.py
npm run contract:generate -- --output .contract-staging/generated-current-oai
npm run contract:check
npm run typecheck
npm run build
# 首次 runtime 全文件名与 SHA-256 记录后，再原样执行一次。
npm run build
node node_modules/vitest/vitest.mjs run test/oai-contract-compatibility.test.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run --maxWorkers=1
```

共享向量另外直接调用真实源码与包内 runtime 的 `createGatewayCore().runSharedVectors()`，完整核对六份文档的 70 个 ID、pass 状态与 resultHash，并把两组结果逐项对照。OAI 原 checker 使用新插件目录在固定 runner 检出实际执行，没有替换脚本或允许跳过。

## 结果与真实边界

- 旧快照下新增源码/runtime 回归：10/10 失败，确认未注册 caller/push/授权进度，实际协商拒绝当前 OAI CORE；保留 `compatibility-red.txt`。
- 契约源：26/26 与固定 OAI 逐文件 SHA-256 一致；原生成器的 26 份输出完全相同；runtime 的 21 份原始 JSON 与目标一致。
- Python 契约工具：5/5 通过；原 `contract:check` 通过。
- 原 build 连续两次：均退出 0，61 个 runtime 文件的名称和 SHA-256 完全相同；只 4 个 runtime 文件相对基线有变化。
- 源码与 runtime 的完整共享向量：各 70/70，通过顺序、ID、status、resultHash 均一致。
- OAI 原严格 pin checker：在干净 runner 固定检出退出 0。
- 新增测试最终 12 项：同时验证独立 OAI CORE、新 caller 与旧请求解码、push 闭集、授权进度、实际事件存储与拒绝坏 caller、实际协商接受当前 CORE 并继续拒绝旧 CORE。

初次全套 217/218 通过，唯一失败准确发现静态清单旧摘要；已由真实计算结果同步清单。下一次 218/220 通过，新增事件夹具缺少空 parameters，既有历史清理会补为空对象；已使合成输入显式包含该字段，没有修改清理或存储行为。两个真实失败输出均保留，不将其写作全绿。最终全套 38 个文件、220/220 通过，新增 12/12；结果见 `full-suite-green-final.txt` 和 `compatibility-green-final.txt`。

本轮没有执行真实 OpenClaw 宿主安装或模型、设备操作；上述协商调用真实 Gateway Core 入口但不等同于 Android/真实宿主端到端验收。独立两轴审查和远端 PR CI 待主任务进行；OAI 实现 pin 更新将使用之后的独立任务分支，不用本地测试替代后续完整跨宿主门禁。

## 证据

所有证据位于 `evidence/2026-11-12-current-oai-contract/`：候选版本表、原失败、全部受管文件摘要、生成变更清单、环境、红/绿回归、两次构建摘要、完整向量结果和实际命令输出。均不包含生产账号、Token、模型配置或私人会话。
