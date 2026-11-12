# 当前 OAI 契约快照同步计划

日期：2026-11-12。仓库：`1rua/openclaw-android-gateway`。关联本仓 #3、OAI #170。

## 固定事实与边界

修复分支以 canonical 仓库 `main` 的 `35b2a595fd4374eb64761d08a90d83ea5390570f` 为基线；远端不存在 `dev`。当前主分支与 OAI 固定的 `c7c087b9fe28adcc658a1cbdb71689a377b65214` 内容相同，均为 `1.1.0`，契约 pin 为 `f0b3f1bd4f6f3301b820e38c9f3241bcac05cd10`。现有分支和 `v1.0.0`、`v1.0.1`、`v1.0.2` 均没有与目标完全相同的 26 份受管输入。最新 GitHub Release 为 `v1.0.1`，不能把主分支内容当成已发布标签。

目标契约固定为 OAI `02ad53e09049c2b06c21cacd9d009c2f14e6d5bd`。其 PR #143 合成 merge `105d9d5bf44270157f45bd00bf2f5748205cbade` 与该目标整 tree 相同，均为 `1cd2028c652fefcd7c5e9fea666dbd9b57054c35`。原门禁在干净合成 merge 检出退出 1；底层 Git 比较退出 1 且 stderr 为空，确认真实内容漂移。

仓库基线没有 AGENTS.md 或专门发行指引。实施遵循 README 中的原生成器与 CI：单一契约源、包内快照、严格 pin 核验与生成 runtime。保持 `1.1.0` 元数据，本轮不创建标签、不发布 Release、不合并 PR、不操作宿主或账号数据。

## 实施范围

1. 把 `contract-pin.json` 固定到目标不可变 OAI 提交。
2. 使用现有 `contract:generate` 生成完整快照，仅同步 4 个确有差异的源文件：分派索引、device-request、event、schema-registry。
3. 使用原 `build` 生成并保留对应 runtime；不手写另一套协议。
4. 增加 caller、push、授权进度定义与 source/runtime CORE、真实协商接口的回归；先证明旧快照失败，再验证同步后通过。
5. 将候选版本逐文件核验、原始失败、诊断和执行结果放入 `docs/reviews/` 及其证据目录。
6. 经独立审查固定本仓不可变提交后，OAI #170 再在独立分支更新实现 pin；两个 PR 暂不合并。

## 验证顺序

- 原快照下新增契约/协商测试给出红反馈。
- 原 contract-source 工具测试、`contract:generate` 与生成目录逐文件比较、`contract:check`。
- 类型检查、全套既有插件测试与新增测试。
- 原 build 连续执行两次，比较 runtime 全文件名称、内容摘要，确认第二次没有漂移。
- 分别执行 source 和包内 runtime 的全部 70 个共享向量，并验证 ID、status、resultHash。
- OAI 原严格 pin checker，以及当前跨宿主完整结果比对仍由 OAI 集成分支执行。
- 独立 Standards / Spec 两轴审查，核对本仓 #3 与 OAI #170 的覆盖。
