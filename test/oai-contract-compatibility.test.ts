import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { coreSchemaHash } from "../gateway-contract/src/core-schema-hash.js";
import { validateGatewayValue } from "../gateway-contract/src/schema-registry.js";
import { createGatewayCore } from "../src/core/gateway-core.js";

const runtimeCore = await import(new URL("../runtime/src/core/gateway-core.js", import.meta.url).href) as {
  createGatewayCore: typeof createGatewayCore;
};
const runtimeRegistry = await import(new URL("../runtime/gateway-contract/src/schema-registry.js", import.meta.url).href) as {
  validateGatewayValue: typeof validateGatewayValue;
};
const runtimeHash = await import(new URL("../runtime/gateway-contract/src/core-schema-hash.js", import.meta.url).href) as {
  coreSchemaHash: typeof coreSchemaHash;
};

// 独立来自 OAI 02ad53e09049c2b06c21cacd9d009c2f14e6d5bd 的七份原始 Schema 字节，不能从待测插件快照反推。
const currentOaiCore = "sha256:38786286ca26f601747cf7e52953e1cd4a57b8089e3b95cdc31fbb6f7a8b6d83";
const previousOaiCore = "sha256:032f580246eb4a214624bded717819b4d5a76191208207edc9e5a4607f5c4d23";
const caller = { agentName: "契约回归 Agent", purpose: "验证隔离环境中的设备请求契约" };
const route = {
  coreInstanceId: `core_${"a".repeat(32)}`,
  accountScope: `acct_${"b".repeat(32)}`,
  endpointId: `endpoint_${"c".repeat(32)}`,
  generation: 1,
};

const negotiate = (core: ReturnType<typeof createGatewayCore>, digest: string) => core.handle({
  method: "POST",
  target: "/open-android-intelligence/v2/negotiate",
  body: {
    negotiationId: "neg_contract_sync",
    protocol: { major: 2, minor: 1 },
    client: { installationId: "install_contract_sync", appVersion: "2.2.1", platform: "android", platformApi: 35 },
    features: {
      auth: ["password"],
      messages: ["chat-v1"],
      attachments: ["staged-sha256-v1"],
      events: ["sse-cursor-v1"],
      deviceRequests: ["risk-queue-v1"],
    },
    schemaHashes: { core: digest },
  },
});

describe.each([
  { name: "源码", createCore: createGatewayCore, validate: validateGatewayValue, digest: coreSchemaHash },
  { name: "发布 runtime", createCore: runtimeCore.createGatewayCore, validate: runtimeRegistry.validateGatewayValue, digest: runtimeHash.coreSchemaHash },
])("$name 的当前 OAI 契约", ({ createCore, validate, digest }) => {
  it("使用固定 OAI 原始 Schema 的 CORE，避免两份旧快照互相印证", () => {
    expect(digest()).toBe(currentOaiCore);
  });

  it("验证 caller，并保留不含 caller 的旧持久请求解码能力", () => {
    expect(validate("device.caller", caller).ok).toBe(true);
    expect(validate("device.caller", { ...caller, agentName: " " }).ok).toBe(false);
    expect(validate("device.caller", { ...caller, unexpected: true }).ok).toBe(false);
    const request = {
      requestId: "device_req_contract_sync",
      capability: { id: "screen.read", version: "1" },
      provider: { pluginId: "test.provider", authorKeyId: `sha256:${"d".repeat(64)}` },
      parameters: {},
      risk: "read",
      grantRevision: 1,
      createdAt: "2026-11-12T00:00:00.000Z",
      expiresAt: "2026-11-12T00:00:30.000Z",
      requiresForegroundConfirmation: false,
    };
    expect(validate("device.request", { ...request, caller }).ok).toBe(true);
    expect(validate("device.request", request).ok).toBe(true);
    expect(validate("device.request", { ...request, caller: { agentName: caller.agentName } }).ok).toBe(false);
  });

  it("注册主动推送的五类路由、投递和撤销 Schema，并拒绝额外字段", () => {
    const examples = [
      ["push.route", route],
      ["push.registration", { registrationKey: "contract-sync", label: "隔离回归端点", ttlSeconds: 60 }],
      ["push.delivery", {
        eventId: "event_contract_sync", route, eventType: "test.contract",
        occurredAt: "2026-11-12T00:00:00.000Z", expiresAt: "2026-11-12T00:00:30.000Z", payload: {},
      }],
      ["push.ack", { eventId: "event_contract_sync" }],
      ["push.revoke", { route, eventIds: ["event_contract_sync"] }],
    ] as const;
    for (const [schema, value] of examples) {
      expect(validate(schema, value).ok, schema).toBe(true);
      expect(validate(schema, { ...value, unexpected: true }).ok, schema).toBe(false);
    }
    expect(validate("push.route", { ...route, generation: 0 }).ok).toBe(false);
  });

  it("接受真实授权进度闭集，拒绝伪造完成状态", () => {
    expect(validate("device.authorizationProgress", { state: "awaiting_confirmation" }).ok).toBe(true);
    expect(validate("device.authorizationProgress", { state: "executing" }).ok).toBe(true);
    expect(validate("device.authorizationProgress", { state: "succeeded" }).ok).toBe(false);
  });

  it("实际存储并回读包含 caller 的设备请求事件，错误声明不能入库", async () => {
    const core = createCore({
      storageRoot: mkdtempSync(join(tmpdir(), "openclaw-oai-caller-event-")),
      attachmentMasterKey: Buffer.alloc(32, 0x42),
    });
    const account = await core.openGatewayAccount("acct_contract_sync");
    const now = new Date("2026-11-12T00:00:00.000Z");
    const payload = { requestId: "device_req_contract_sync", risk: "read", grantRevision: 1, caller, parameters: {} };
    try {
      const saved = account.events.append({
        eventType: "device.requested", correlationId: "cor_contract_sync", payload, now,
      });
      expect(account.events.readAfter(null, now)).toEqual([saved]);
      expect(() => account.events.append({
        eventType: "device.requested", correlationId: "cor_invalid_caller", now,
        payload: { ...payload, caller: { ...caller, unexpected: true } },
      })).toThrow("SCHEMA_INVALID");
      expect(account.events.readAfter(null, now)).toEqual([saved]);
    } finally {
      account.close();
    }
  });

  it("实际协商当前 CORE，并继续拒绝旧 CORE", async () => {
    const core = createCore({
      storageRoot: mkdtempSync(join(tmpdir(), "openclaw-oai-contract-sync-")),
      attachmentMasterKey: Buffer.alloc(32, 0x42),
    });
    const accepted = await negotiate(core, currentOaiCore);
    expect(accepted.error).toBeUndefined();
    expect(accepted.data?.protocol).toEqual({ major: 2, minor: 1 });
    const rejected = await negotiate(core, previousOaiCore);
    expect(rejected.error?.code).toBe("PROTOCOL_INCOMPATIBLE");
  });
});
