import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
} from '../../src/modules/runtime/runtime-contract.schema';

const repoRoot = resolve(__dirname, '../../..');
const bridgeRoot = resolve(repoRoot, 'runtime/agno-bridge');

function validRequest() {
  return {
    specVersion: 'orchestra.runtime.execute.v1',
    assistantRuntimeSpec: {
      specVersion: 'orchestra.runtime.assistant.v1',
      trace: { traceId: 'trace-bridge-contract', runId: 'run-bridge-contract' },
      tenant: { id: 'tenant-1' },
      workspace: { id: 'workspace-1' },
      actor: { userId: 'user-1' },
      assistant: { id: 'assistant-1' },
      input: { message: 'Safe bridge contract request.' },
      conversationContext: {
        messages: [
          { role: 'user', content: 'Previous safe question.' },
          { role: 'assistant', content: 'Previous safe answer.' },
        ],
        summary: {
          enabled: true,
          included: true,
          messageCount: 2,
          totalChars: 44,
          truncated: false,
          maxMessages: 12,
          maxMessageChars: 1200,
          maxTotalChars: 6000,
        },
      },
      model: { provider: 'local', model: 'deterministic-sandbox' },
      policy: {
        executionMode: 'sync',
        streaming: false,
        timeoutMs: 15_000,
        maxToolCalls: 0,
        maxRagResults: 5,
        maxContextChars: 12_000,
        failClosed: true,
      },
      instructions: {},
      rag: {
        enabled: true,
        mode: 'resolved_context',
        sources: [{ sourceId: 'source-1', title: 'Safe source', excerpt: 'Governed safe excerpt.', score: 0.9 }],
      },
      tools: {
        enabled: true,
        mode: 'gateway',
        descriptors: [{
          toolId: 'tool-1',
          name: 'lookup_policy',
          description: 'Look up a governed policy.',
          riskLevel: 'low',
          approvalRequired: false,
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
          gatewayRef: { type: 'orchestra_tool_gateway', action: 'mcp.tool.execute' },
        }],
      },
      observability: {
        usageEventEnabled: true,
        auditEnabled: true,
        qualityEvaluationEnabled: false,
      },
      limits: { enforce: true },
    },
  };
}

describe('Agno bridge Docker contract', () => {
  it('produces health, capabilities, and execute payloads accepted by the backend V1 schemas', () => {
    const python = String.raw`
import json
import sys
sys.path.insert(0, sys.argv[1])
from bridge import BridgeConfig, BridgeService

config = BridgeConfig.from_env({
    "AGNO_BRIDGE_EXECUTION_MODE": "stub",
    "AGNO_BRIDGE_PROVIDER": "stub",
    "AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY": "false",
    "AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED": "true",
    "AGNO_RUNTIME_HTTP_TOOLS_ENABLED": "true",
    "AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS": "0",
    "AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED": "false",
})
service = BridgeService(config)
status, response = service.execute(json.load(sys.stdin))
print(json.dumps({
    "status": status,
    "health": service.health(),
    "capabilities": service.capabilities(),
    "response": response,
}))
`;
    const result = spawnSync('python3', ['-c', python, bridgeRoot], {
      encoding: 'utf8',
      input: JSON.stringify(validRequest()),
    });

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output.status).toBe(200);
    expect(runtimeHealthResponseV1Schema.safeParse(output.health).success).toBe(true);
    expect(runtimeCapabilitiesResponseV1Schema.safeParse(output.capabilities).success).toBe(true);
    expect(runtimeExecuteResponseV1Schema.safeParse(output.response).success).toBe(true);
  });

  it('keeps backend example defaults closed and provider credentials bridge-only', () => {
    const backendExample = readFileSync(resolve(repoRoot, 'backend/.env.example'), 'utf8');
    const bridgeExample = readFileSync(resolve(bridgeRoot, '.env.example'), 'utf8');
    const expectedBackendDefaults = [
      'RUNTIME_PROVIDER=local',
      'AGNO_RUNTIME_HTTP_ENABLED=false',
      'AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false',
      'AGNO_RUNTIME_HTTP_SECURITY_KEY=',
      'AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false',
      'AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false',
      'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0',
      'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false',
    ];

    for (const expected of expectedBackendDefaults) {
      expect(backendExample).toContain(`${expected}\n`);
    }
    expect(backendExample).not.toMatch(/^(?:OPENAI_API_KEY|AZURE_OPENAI_API_KEY|ANTHROPIC_API_KEY)=/m);
    expect(bridgeExample).toMatch(/^OPENAI_API_KEY=$/m);
    expect(bridgeExample).toMatch(/^AZURE_OPENAI_API_KEY=$/m);
    expect(bridgeExample).toMatch(/^ANTHROPIC_API_KEY=$/m);
    expect(bridgeExample).not.toMatch(/^(?:OPENAI_API_KEY|AZURE_OPENAI_API_KEY|ANTHROPIC_API_KEY)=.+$/m);
  });
});
