import { createHash } from 'crypto';
import { AppError } from '../../../shared/errors/app-error';
import { getMcpRemoteConfig } from './mcp-remote.config';
import { FailClosedMcpRemoteDiscoveryTransport, type McpRemoteDiscoveryTransport, type McpRemoteDiscoveryTransportTool } from './mcp-remote-transport';
import { McpRemoteReadinessService, mcpRemoteReadinessService } from './mcp-remote-readiness.service';
import type {
  McpRemoteDiscoveredTool,
  McpRemoteDiscoveredToolRiskLevel,
  McpRemoteDiscoveryInput,
  McpRemoteDiscoveryOutput,
  McpRemoteExistingToolSpec,
  McpRemoteFeatureConfig,
  McpRemoteReadiness,
} from './mcp-remote.types';

const maxDescriptionChars = 1000;
const maxDisplayNameChars = 160;
const maxExternalNameChars = 128;
const maxProtocolVersionChars = 64;
const maxSchemaBytes = 12000;
const maxSchemaDepth = 8;
const maxArrayItems = 50;
const sensitiveKeyFragments = ['authorization', 'cookie', 'credential', 'password', 'privatekey', 'secret', 'token', 'apikey'];

type DiscoveryWarning = { code: string; message: string };

function safeString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
}

function displayNameFromExternalName(externalName: string) {
  const words = externalName.replace(/[-_.]+/g, ' ').trim().split(/\s+/g);
  return words.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

function addWarning(warnings: DiscoveryWarning[], code: string, message: string) {
  if (!warnings.some((warning) => warning.code === code && warning.message === message)) {
    warnings.push({ code, message });
  }
}

function sanitizeSchema(value: unknown, warnings: DiscoveryWarning[], depth = 0): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    addWarning(warnings, 'MCP_REMOTE_SCHEMA_VALUE_OMITTED', 'A schema value was omitted because it is not serializable.');
    return undefined;
  }

  if (depth > maxSchemaDepth) {
    addWarning(warnings, 'MCP_REMOTE_SCHEMA_DEPTH_LIMIT', 'A schema branch was omitted because it exceeded the depth limit.');
    return undefined;
  }

  if (Array.isArray(value)) {
    if (value.length > maxArrayItems) {
      addWarning(warnings, 'MCP_REMOTE_SCHEMA_ARRAY_LIMIT', 'A schema array was truncated to the configured item limit.');
    }
    return value.slice(0, maxArrayItems)
      .map((item) => sanitizeSchema(item, warnings, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }

  if (!isRecord(value)) {
    addWarning(warnings, 'MCP_REMOTE_SCHEMA_VALUE_OMITTED', 'A schema value was omitted because it is not a plain JSON value.');
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype' || isSensitiveKey(key)) {
      addWarning(warnings, 'MCP_REMOTE_SCHEMA_FIELD_OMITTED', 'A schema field was omitted by the sanitizer.');
      continue;
    }
    const sanitizedValue = sanitizeSchema(value[key], warnings, depth + 1);
    if (typeof sanitizedValue !== 'undefined') {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

function enforceSchemaSize(value: unknown, warnings: DiscoveryWarning[]): unknown {
  const serialized = stableStringify(value);
  if (Buffer.byteLength(serialized, 'utf8') <= maxSchemaBytes) return value;
  addWarning(warnings, 'MCP_REMOTE_SCHEMA_SIZE_LIMIT', 'A schema was omitted because its sanitized size exceeded the limit.');
  return { omitted: true, reason: 'schema_size_limit' };
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = normalizeForHash(value[key]);
      if (typeof child !== 'undefined') normalized[key] = child;
    }
    return normalized;
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

function specHash(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function textForRisk(tool: Pick<McpRemoteDiscoveredTool, 'externalName' | 'displayName' | 'description'>) {
  return `${tool.externalName} ${tool.displayName} ${tool.description ?? ''}`.toLowerCase();
}

function hasGenericSchema(tool: Pick<McpRemoteDiscoveredTool, 'inputSchema'>) {
  if (!tool.inputSchema || !isRecord(tool.inputSchema)) return true;
  const properties = tool.inputSchema.properties;
  if (!isRecord(properties)) return true;
  return Object.keys(properties).length > 5;
}

function inferRisk(tool: Pick<McpRemoteDiscoveredTool, 'externalName' | 'displayName' | 'description' | 'inputSchema'>): McpRemoteDiscoveredToolRiskLevel {
  const text = textForRisk(tool);
  const broadAccess = /\b(all|any|workspace|tenant|global|wide|broad)\b/.test(text);
  if (/\b(delete|destroy|drop|transfer|payment|credential|secret|token|admin|permission)\b/.test(text)) {
    return 'critical';
  }
  if (/\b(write|update|create|send|email|approve|reject)\b/.test(text)) {
    return 'high';
  }
  if (/\b(search|read|list)\b/.test(text)) {
    return broadAccess || hasGenericSchema(tool) ? 'medium' : 'low';
  }
  if (/\b(health|status|version|info)\b/.test(text) && !hasGenericSchema(tool)) {
    return 'low';
  }
  return 'medium';
}

function requiresApproval(riskLevel: McpRemoteDiscoveredToolRiskLevel) {
  return riskLevel !== 'low';
}

function sanitizeTool(tool: McpRemoteDiscoveryTransportTool, warnings: DiscoveryWarning[]): McpRemoteDiscoveredTool | null {
  const externalName = safeString(tool.externalName, maxExternalNameChars);
  if (!externalName) {
    addWarning(warnings, 'MCP_REMOTE_TOOL_REJECTED', 'A discovered tool was rejected because it did not include a valid externalName.');
    return null;
  }

  const inputSchema = typeof tool.inputSchema === 'undefined'
    ? undefined
    : enforceSchemaSize(sanitizeSchema(tool.inputSchema, warnings), warnings);
  const outputSchema = typeof tool.outputSchema === 'undefined'
    ? undefined
    : enforceSchemaSize(sanitizeSchema(tool.outputSchema, warnings), warnings);
  const displayName = safeString(tool.displayName, maxDisplayNameChars) ?? displayNameFromExternalName(externalName);
  const description = safeString(tool.description, maxDescriptionChars);

  const baseTool = {
    externalName,
    displayName,
    ...(description ? { description } : {}),
    ...(typeof inputSchema !== 'undefined' ? { inputSchema } : {}),
    ...(typeof outputSchema !== 'undefined' ? { outputSchema } : {}),
  };
  const inferredRiskLevel = inferRisk(baseTool);
  const sanitizedTool: McpRemoteDiscoveredTool = {
    ...baseTool,
    specHash: specHash(baseTool),
    inferredRiskLevel,
    requiresApproval: requiresApproval(inferredRiskLevel),
    defaultPolicy: {
      allowRuntimeExecution: false,
      sandboxOnly: true,
      blockedByDefault: true,
    },
  };

  return sanitizedTool;
}

function sanitizeTransportWarnings(warnings: Array<{ code: string; message: string }> | undefined): DiscoveryWarning[] {
  return (warnings ?? []).map((warning) => {
    const code = safeString(warning.code, 80)?.replace(/[^A-Za-z0-9_:-]/g, '_') || 'MCP_REMOTE_TRANSPORT_WARNING';
    return {
      code: containsSensitiveText(code) ? 'MCP_REMOTE_TRANSPORT_WARNING' : code,
      message: containsSensitiveText(warning.message)
        ? 'Transport warning omitted because it referenced credential material.'
        : safeString(warning.message, 300) ?? 'Transport returned an empty warning.',
    };
  });
}

function containsSensitiveText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

function diffTools(existingTools: McpRemoteExistingToolSpec[] | undefined, discoveredTools: McpRemoteDiscoveredTool[]) {
  const discovered = new Map(discoveredTools.map((tool) => [tool.externalName, tool]));
  const existing = new Map((existingTools ?? []).map((tool) => [tool.externalName, tool]));

  const added = [...discovered.keys()].filter((externalName) => !existing.has(externalName)).sort();
  const removed = [...existing.keys()].filter((externalName) => !discovered.has(externalName)).sort();
  const changed = [...discovered.values()]
    .filter((tool) => {
      const existingTool = existing.get(tool.externalName);
      return Boolean(existingTool?.specHash) && existingTool?.specHash !== tool.specHash;
    })
    .map((tool) => tool.externalName)
    .sort();

  return { added, changed, removed };
}

function blockedOutput(input: McpRemoteDiscoveryInput, readiness: McpRemoteReadiness, warnings: DiscoveryWarning[]): McpRemoteDiscoveryOutput {
  return {
    serverId: input.server.id,
    status: 'blocked',
    discoveredAt: new Date().toISOString(),
    tools: [],
    diff: {
      added: [],
      changed: [],
      removed: (input.existingTools ?? []).map((tool) => tool.externalName).sort(),
    },
    warnings,
    readiness,
    sanitizedMetadata: {
      executionBlocked: true,
      transportCalled: false,
      reason: readiness.reason,
    },
  };
}

function failureWarning(error: unknown): DiscoveryWarning {
  if (error instanceof AppError) {
    return {
      code: containsSensitiveText(error.code) ? 'MCP_REMOTE_DISCOVERY_FAILED' : error.code,
      message: containsSensitiveText(error.message)
        ? 'MCP remote discovery failed before producing a sanitized result.'
        : error.message,
    };
  }
  return { code: 'MCP_REMOTE_DISCOVERY_FAILED', message: 'MCP remote discovery failed before producing a sanitized result.' };
}

export class McpRemoteDiscoveryService {
  private readonly readinessService: McpRemoteReadinessService;
  private readonly transport: McpRemoteDiscoveryTransport;
  private readonly config: McpRemoteFeatureConfig;

  constructor(options: {
    readinessService?: McpRemoteReadinessService;
    transport?: McpRemoteDiscoveryTransport;
    config?: McpRemoteFeatureConfig;
  } = {}) {
    this.readinessService = options.readinessService ?? mcpRemoteReadinessService;
    this.transport = options.transport ?? new FailClosedMcpRemoteDiscoveryTransport();
    this.config = options.config ?? getMcpRemoteConfig();
  }

  async runGovernedDiscovery(input: McpRemoteDiscoveryInput): Promise<McpRemoteDiscoveryOutput> {
    const warnings: DiscoveryWarning[] = [];
    const readiness = this.readinessService.getReadiness({
      server: input.server,
      policy: input.policy,
      credentialsConfigured: input.credentialsConfigured,
      purpose: 'discovery',
      config: this.config,
    });

    if (readiness.status !== 'ready') {
      addWarning(warnings, 'MCP_REMOTE_DISCOVERY_BLOCKED', readiness.reason);
      return blockedOutput(input, readiness, warnings);
    }

    if (!input.server.baseUrl) {
      addWarning(warnings, 'MCP_REMOTE_DISCOVERY_BLOCKED', 'MCP remote server is missing baseUrl.');
      return blockedOutput(input, readiness, warnings);
    }

    try {
      const transportOutput = await this.transport.discoverTools({
        serverId: input.server.id,
        baseUrl: input.server.baseUrl,
        authType: input.server.authType ?? 'none',
        credentialsConfigured: input.credentialsConfigured,
        timeoutMs: this.config.defaultTimeoutMs,
        requestId: input.requestId,
      });

      warnings.push(...sanitizeTransportWarnings(transportOutput.warnings));
      const tools = transportOutput.tools
        .map((tool) => sanitizeTool(tool, warnings))
        .filter((tool): tool is McpRemoteDiscoveredTool => tool !== null)
        .sort((left, right) => left.externalName.localeCompare(right.externalName));

      const protocolVersion = safeString(transportOutput.protocolVersion, maxProtocolVersionChars);
      const hashPayload = { protocolVersion, tools };

      return {
        serverId: input.server.id,
        status: 'completed',
        discoveredAt: new Date().toISOString(),
        ...(protocolVersion ? { protocolVersion } : {}),
        specHash: specHash(hashPayload),
        tools,
        diff: diffTools(input.existingTools, tools),
        warnings,
        readiness,
        sanitizedMetadata: {
          executionBlocked: true,
          transportCalled: true,
          toolCount: tools.length,
          timeoutMs: this.config.defaultTimeoutMs,
        },
      };
    } catch (error) {
      warnings.push(failureWarning(error));
      return {
        serverId: input.server.id,
        status: 'failed',
        discoveredAt: new Date().toISOString(),
        tools: [],
        diff: {
          added: [],
          changed: [],
          removed: (input.existingTools ?? []).map((tool) => tool.externalName).sort(),
        },
        warnings,
        readiness,
        sanitizedMetadata: {
          executionBlocked: true,
          transportCalled: true,
          timeoutMs: this.config.defaultTimeoutMs,
        },
      };
    }
  }

  async discoverRemoteTools(input: McpRemoteDiscoveryInput): Promise<McpRemoteDiscoveryOutput> {
    return this.runGovernedDiscovery(input);
  }
}

export const mcpRemoteDiscoveryService = new McpRemoteDiscoveryService();
