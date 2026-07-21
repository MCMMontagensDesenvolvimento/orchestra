#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(evalDir, '../../..');
const mode = process.argv[2] ?? '--dry-run';
const supportedModes = new Set(['--dry-run', '--run-offline', '--report']);

if (!supportedModes.has(mode) || process.argv.length > 3) {
  process.stderr.write('Usage: validate.mjs [--dry-run|--run-offline|--report]\n');
  process.exit(2);
}

const caseFiles = [
  'cases.chat-rag.json',
  'cases.response-scope.json',
  'cases.mcp-readonly.json',
  'cases.corporate-readonly.json',
  'cases.security.json',
];
const requiredCategories = new Set([
  'rag_grounding',
  'response_scope',
  'mcp_readonly',
  'prompt_injection',
  'quota_enforcement',
  'raw_payload_leakage',
  'corporate_readonly',
]);
const requiredTags = new Set([
  'rag_grounding',
  'response_scope',
  'mcp_readonly',
  'mcp_flag_block',
  'mcp_write_block',
  'prompt_injection',
  'quota_enforcement',
  'raw_payload_leakage',
  'corporate_readonly',
  'corporate_disabled_default',
  'corporate_unsafe_host',
  'corporate_secretref_required',
  'corporate_write_block',
  'corporate_raw_payload',
]);
const forbiddenMetadataFields = [
  'rawPrompt',
  'rawContext',
  'rawArgs',
  'rawOutput',
  'headers',
  'cookies',
  'Authorization',
  'secretRef',
  'apiKey',
];
const safeOfflineMetadataFields = new Set([
  'responseScopeMode',
  'ragMode',
  'mcpRemoteAllowed',
  'usageLimitBlocked',
  'rawContentLogged',
]);
const dangerousToolOperation = /(?:^|[^a-z])(create|update|delete|remove|write|post|put|patch|drop|truncate|send|transfer|approve|execute|shell|command)(?:$|[^a-z])/i;
const errors = [];
const passedGates = [];

function normalized(value) {
  return String(value).replace(/[-_\s]/g, '').toLowerCase();
}

function addError(gate, reference, message) {
  const safeReference = typeof reference === 'string' && /^[a-zA-Z0-9._-]+$/.test(reference)
    ? reference
    : 'suite';
  errors.push(`${gate} [${safeReference}]: ${message}`);
}

function pass(gate) {
  passedGates.push(gate);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    addError('offline-source-contracts', path.basename(relativePath), 'required source file is missing');
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function validateNoCredentialMaterial(fileName, rawText) {
  const patterns = [
    /sk-[A-Za-z0-9_-]{12,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bBearer\s+\S+/i,
    /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/i,
    /(?:password|token|api[_-]?key|secret)\s*[:=]\s*["']?[A-Za-z0-9._~+/-]{12,}/i,
  ];
  if (patterns.some((pattern) => pattern.test(rawText))) {
    addError('safe-fixtures', fileName, 'apparent credential or connection material detected');
  }
  if (/https?:\/\//i.test(rawText)) {
    addError('safe-fixtures', fileName, 'URLs are forbidden in the versioned synthetic cases');
  }
}

function validateCaseShape(testCase, fileName, ids) {
  if (!isRecord(testCase)) {
    addError('case-structure', fileName, 'case must be an object');
    return;
  }
  const id = typeof testCase.id === 'string' ? testCase.id : fileName;
  if (typeof testCase.id !== 'string' || !/^16s-[a-z0-9-]{8,80}$/.test(testCase.id)) {
    addError('case-structure', id, 'id is missing or invalid');
  } else if (ids.has(testCase.id)) {
    addError('case-structure', id, 'id must be unique');
  } else {
    ids.add(testCase.id);
  }
  if (typeof testCase.category !== 'string' || !requiredCategories.has(testCase.category)) {
    addError('case-structure', id, 'category is missing or unsupported');
  }
  if (typeof testCase.objective !== 'string' || testCase.objective.trim().length < 20 || testCase.objective.length > 240) {
    addError('case-structure', id, 'objective must contain between 20 and 240 characters');
  }
  if (!Array.isArray(testCase.tags) || testCase.tags.length === 0 || testCase.tags.some((tag) => typeof tag !== 'string')) {
    addError('case-structure', id, 'tags must be a non-empty string array');
  }
  if (!isRecord(testCase.input) || testCase.input.synthetic !== true || typeof testCase.input.scenario !== 'string') {
    addError('case-structure', id, 'input must be synthetic and identify a scenario');
  }
  if (!isRecord(testCase.expectation) || typeof testCase.expectation.decision !== 'string') {
    addError('case-structure', id, 'expectation and deterministic decision are required');
    return;
  }
  const safeExpectations = {
    offlineOnly: true,
    externalProviderCalled: false,
    externalMcpCalled: false,
    corporateServiceCalled: false,
    rawContentLogged: false,
  };
  for (const [key, expected] of Object.entries(safeExpectations)) {
    if (testCase.expectation[key] !== expected) {
      addError('offline-safety', id, `${key} must remain ${expected}`);
    }
  }
}

function deterministicDecision(testCase) {
  const input = testCase.input;
  if (input.quota?.mode === 'enforce' && input.quota?.exceeded === true) {
    return 'block_quota_before_runtime';
  }
  if (input.connector) {
    if (input.connector.enabled !== true) return 'block_corporate_disabled';
    if (input.connector.hostSafety !== 'public_approved') return 'block_corporate_unsafe_host';
    if (input.connector.secretRefConfigured !== true) return 'block_corporate_secretref_missing';
    if (input.tool) {
      const operationText = `${input.tool.name ?? ''} ${input.tool.operation ?? ''}`.replace(/[_./:-]+/g, ' ');
      if (input.tool.readOnly !== true || dangerousToolOperation.test(operationText)) return 'block_write_tool';
    }
    if (input.scenario === 'corporate_raw_payload') return 'sanitize_raw_payload';
    return 'allow_corporate_readonly';
  }
  if (input.scenario === 'raw_payload_leakage') return 'sanitize_raw_payload';
  if (input.injectionAttempt === true) {
    return input.tool ? 'block_injection_write_tool' : 'reject_instruction_override';
  }
  if (input.tool) {
    const flags = input.featureFlags ?? {};
    if (flags.remoteEnabled !== true) return 'block_remote_disabled';
    if (flags.executionEnabled !== true) return 'block_execution_disabled';
    if (flags.readOnlyEnabled !== true) return 'block_readonly_disabled';
    const operationText = `${input.tool.name ?? ''} ${input.tool.operation ?? ''}`.replace(/[_./:-]+/g, ' ');
    if (flags.allowWriteTools === true || input.tool.readOnly !== true || dangerousToolOperation.test(operationText)) {
      return 'block_write_tool';
    }
    return 'allow_readonly_tool';
  }
  if (input.knowledgeMatch === true) return 'answer_grounded';
  if (input.responseScopeMode === 'knowledge_only') return 'refuse_outside_knowledge';
  if (input.responseScopeMode === 'general_allowed') return 'allow_general_response';
  return 'unsupported_scenario';
}

function validateOfflineCase(testCase) {
  const id = testCase.id;
  if (!isRecord(testCase.input) || !isRecord(testCase.expectation) || !Array.isArray(testCase.tags)) return;
  const actualDecision = deterministicDecision(testCase);
  if (actualDecision !== testCase.expectation.decision) {
    addError('deterministic-decisions', id, 'computed decision differs from the versioned expectation');
  }

  if (testCase.tags.includes('quota_enforcement')) {
    const required = ['usageLimitBlocked', 'blockedBeforeRuntime'];
    if (required.some((field) => testCase.expectation[field] !== true)
      || ['ragAttempted', 'runtimeAttempted', 'toolExecutionAttempted'].some((field) => testCase.expectation[field] !== false)) {
      addError('quota-enforcement', id, 'quota enforce must block RAG, runtime and tools before execution');
    }
  }

  if (testCase.tags.includes('mcp_write_block')) {
    if (testCase.expectation.mcpRemoteBlocked !== true
      || testCase.expectation.mcpRemoteAllowed !== false
      || testCase.expectation.externalMcpCalled !== false) {
      addError('mcp-write-block', id, 'write-shaped MCP case must fail closed without a call');
    }
  }

  if (testCase.tags.includes('rag_grounding') && testCase.input.knowledgeMatch === true) {
    if (testCase.expectation.ragMode !== 'resolved_context' || testCase.expectation.answerSource !== 'knowledge') {
      addError('rag-grounding', id, 'answerable RAG case must require resolved knowledge context');
    }
  }

  if (testCase.tags.includes('raw_payload_leakage')) {
    const candidateFields = Array.isArray(testCase.input.candidateMetadataFields)
      ? testCase.input.candidateMetadataFields
      : [];
    const actualPersisted = candidateFields.filter((field) => safeOfflineMetadataFields.has(field));
    const expectedPersisted = Array.isArray(testCase.expectation.persistedMetadataFields)
      ? testCase.expectation.persistedMetadataFields
      : [];
    if (JSON.stringify(actualPersisted) !== JSON.stringify(expectedPersisted)
      || testCase.expectation.forbiddenMetadataFieldsAbsent !== true) {
      addError('raw-payload-leakage', id, 'offline metadata allowlist differs from the expected safe fields');
    }
    const candidateNormalized = new Set(candidateFields.map(normalized));
    for (const field of forbiddenMetadataFields) {
      if (!candidateNormalized.has(normalized(field))) {
        addError('raw-payload-leakage', id, 'required forbidden-field probe is missing');
        break;
      }
    }
    if (expectedPersisted.some((field) => forbiddenMetadataFields.some((blocked) => normalized(blocked) === normalized(field)))) {
      addError('raw-payload-leakage', id, 'forbidden field appears in persisted metadata expectation');
    }
  }
}

function validateVersionedSuite() {
  const ids = new Set();
  const suites = [];
  const allCases = [];

  for (const fileName of caseFiles) {
    const absolutePath = path.join(evalDir, fileName);
    if (!fs.existsSync(absolutePath)) {
      addError('suite-files', fileName, 'required eval file is missing');
      continue;
    }
    const rawText = fs.readFileSync(absolutePath, 'utf8');
    validateNoCredentialMaterial(fileName, rawText);
    let document;
    try {
      document = JSON.parse(rawText);
    } catch {
      addError('suite-files', fileName, 'file is not valid JSON');
      continue;
    }
    if (!isRecord(document)
      || document.$schema !== 'orchestra.eval-suite.16s.v1'
      || document.version !== '16s.1'
      || typeof document.suite !== 'string'
      || !Array.isArray(document.cases)
      || document.cases.length === 0) {
      addError('suite-files', fileName, 'suite header or cases array is invalid');
      continue;
    }
    suites.push(document.suite);
    for (const testCase of document.cases) {
      validateCaseShape(testCase, fileName, ids);
      if (isRecord(testCase)) allCases.push(testCase);
    }
  }

  if (suites.length === caseFiles.length) pass('versioned-suite-files');
  if (!errors.some((error) => error.startsWith('case-structure'))) pass('required-case-fields');
  if (!errors.some((error) => error.startsWith('safe-fixtures'))) pass('no-apparent-secrets-or-corporate-urls');
  if (!errors.some((error) => error.startsWith('offline-safety'))) pass('offline-provider-free-expectations');

  const categories = new Set(allCases.map((testCase) => testCase.category));
  const tags = new Set(allCases.flatMap((testCase) => testCase.tags ?? []));
  for (const category of requiredCategories) {
    if (!categories.has(category)) addError('coverage', category, 'required category has no case');
  }
  for (const tag of requiredTags) {
    if (!tags.has(tag)) addError('coverage', tag, 'required gate has no tagged case');
  }
  const scopeModes = new Set(allCases.map((testCase) => testCase.input?.responseScopeMode).filter(Boolean));
  for (const requiredMode of ['knowledge_only', 'general_allowed']) {
    if (!scopeModes.has(requiredMode)) addError('coverage', requiredMode, 'required responseScopeMode has no case');
  }
  if (!errors.some((error) => error.startsWith('coverage'))) pass('mandatory-category-and-gate-coverage');

  return { allCases, suites, categories };
}

function requirePatterns(relativePath, patterns, gate) {
  const source = readText(relativePath);
  if (!source) return '';
  for (const pattern of patterns) {
    if (!source.includes(pattern)) {
      addError(gate, path.basename(relativePath), 'required governed source contract is missing');
      break;
    }
  }
  return source;
}

function validateOfflineSourceContracts() {
  const agentRuns = requirePatterns('backend/src/modules/agent-runs/agent-runs.service.ts', [
    'if (usageLimitPrecheck.metadata.usageLimitBlocked)',
    "errorCode: 'AI_USAGE_LIMIT_EXCEEDED'",
    'const runtimeConfig = getRuntimeConfig();',
    'buildRuntimeExecutionContext({',
  ], 'quota-source-contract');
  if (agentRuns) {
    const quotaBlock = agentRuns.indexOf('if (usageLimitPrecheck.metadata.usageLimitBlocked)');
    const runtimeConfig = agentRuns.indexOf('const runtimeConfig = getRuntimeConfig();', quotaBlock);
    const runtimeContext = agentRuns.indexOf('buildRuntimeExecutionContext({', quotaBlock);
    if (quotaBlock < 0 || runtimeConfig < quotaBlock || runtimeContext < quotaBlock) {
      addError('quota-source-contract', 'agent-runs.service.ts', 'quota block must precede runtime and RAG preparation');
    }
  }

  requirePatterns('backend/tests/api/agent-runs.test.ts', [
    'blocks an exceeded enforce usage limit before RAG, runtime, provider or tools',
    'expect(executeSpy).not.toHaveBeenCalled()',
    'expect(mocks.knowledgeService.queryRag).not.toHaveBeenCalled()',
  ], 'quota-source-contract');

  requirePatterns('backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts', [
    "if (!input.config.remoteEnabled) return block('remote_disabled')",
    "if (input.config.allowWriteTools) return block('write_tools_not_allowed')",
    "if (!input.tool.readOnly) return block('tool_not_readonly')",
    "if (hasDangerousMcpRemoteOperation(input.tool)) return block('dangerous_operation')",
  ], 'mcp-readonly-source-contract');
  requirePatterns('backend/tests/runtime/runtime-tool-gateway.test.ts', [
    'blocks a remote write-capable tool before creating a client',
    'expect(createRemoteClient).not.toHaveBeenCalled()',
    "mcpRemoteBlockedReason: 'dangerous_operation'",
  ], 'mcp-readonly-source-contract');

  const adapter = requirePatterns('backend/src/modules/runtime/runtime.agno-http-adapter.ts', [
    'const unsafeMetadataFragments = [',
    'const allowedMetadataKeys = new Set([',
    'const contractEventMetadataKeys = new Set([',
    'rawContentLogged',
    'responseScopeMode',
    'mcpRemoteAllowed',
  ], 'observability-allowlist');
  if (adapter) {
    const match = adapter.match(/const allowedMetadataKeys = new Set\(\[([\s\S]*?)\]\);/);
    if (!match) {
      addError('observability-allowlist', 'runtime.agno-http-adapter.ts', 'metadata allowlist cannot be parsed');
    } else {
      const allowlisted = new Set([...match[1].matchAll(/'([^']+)'/g)].map((item) => normalized(item[1])));
      for (const field of forbiddenMetadataFields) {
        if (allowlisted.has(normalized(field))) {
          addError('observability-allowlist', 'runtime.agno-http-adapter.ts', 'forbidden raw field entered the metadata allowlist');
          break;
        }
      }
    }
  }

  requirePatterns('backend/src/modules/runtime/runtime-contract.schema.ts', [
    "'apikey'",
    "'authorization'",
    "'cookie'",
    "'headers'",
    "'rawpayload'",
    "'rawprompt'",
    "'secretref'",
    "'toolargs'",
    "'tooloutput'",
  ], 'runtime-contract-forbidden-fields');
  requirePatterns('backend/src/modules/ai-observability/ai-observability.service.ts', [
    'const unsafeKeyFragments = [',
    "'apikey'",
    "'authorization'",
    "'connectionstring'",
    "'cookie'",
    "'header'",
    "'password'",
    "'prompt'",
    "'secretref'",
    "'token'",
    'sanitizeAiUsageMetadata',
  ], 'observability-forbidden-fields');

  const mapper = requirePatterns('backend/src/modules/ai-observability/runtime-observability.mapper.ts', [
    'responseScopeMode:',
    'ragMode:',
    'rawContentLogged:',
    'usageLimitBlocked:',
    'mcpRemoteAllowed:',
    'externalMcpCalled:',
  ], 'analytics-allowlisted-fields');
  const analytics = requirePatterns('frontend/src/pages/Analytics/AnalyticsPage.tsx', [
    'responseScopeMode',
    'rawContentLogged',
    'usageLimitBlocked',
    'mcpRemoteAllowed',
  ], 'analytics-allowlisted-fields');
  for (const [reference, source] of [
    ['runtime-observability.mapper.ts', mapper],
    ['AnalyticsPage.tsx', analytics],
  ]) {
    if (!source) continue;
    for (const field of forbiddenMetadataFields) {
      const propertyPattern = new RegExp(`\\b${field.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:`);
      if (propertyPattern.test(source)) {
        addError('analytics-allowlisted-fields', reference, 'forbidden raw field is exposed as a mapped property');
        break;
      }
    }
  }

  requirePatterns('backend/src/modules/runtime/runtime.tool-gateway.service.ts', [
    'inputHash: sha256(request.arguments)',
    'externalMcpCalled: remoteResult.externalMcpCalled',
  ], 'gateway-no-raw-payload');
  const gateway = readText('backend/src/modules/runtime/runtime.tool-gateway.service.ts');
  for (const forbiddenPattern of ['inputPreview: request.arguments', 'outputPreview: content']) {
    if (gateway.includes(forbiddenPattern)) {
      addError('gateway-no-raw-payload', 'runtime.tool-gateway.service.ts', 'raw MCP payload persistence pattern detected');
    }
  }

  requirePatterns('backend/src/config/env.ts', [
    "MCP_REMOTE_ENABLED: booleanString('false')",
    "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')",
    "MCP_REMOTE_READONLY_ENABLED: booleanString('false')",
    "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')",
  ], 'mcp-fail-closed-defaults');

  requirePatterns('backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts', [
    "corporateReadonlyToolName = 'corporate.status.read'",
    "if (!this.config.enabled)",
    "input.authType !== 'bearer' || !input.credentialRef",
    "method: 'GET'",
    "redirect: 'manual'",
    "additionalProperties: false",
    'readBoundedJson',
    'sanitizedStatus',
  ], 'corporate-readonly-source-contract');
  requirePatterns('backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts', [
    'createGovernedMcpRemoteTransport',
    'matchesCorporateReadonlyOrigin',
    'new FailClosedMcpRemoteClientTransport()',
  ], 'corporate-readonly-source-contract');
  requirePatterns('backend/src/modules/mcp/remote/mcp-remote-egress.ts', [
    'metadataHosts',
    'isBlockedMcpRemoteAddress',
    "parsed.protocol !== 'https:'",
    'parsed.username || parsed.password',
    'parsed.search',
    'parsed.hash',
  ], 'corporate-readonly-source-contract');
  requirePatterns('backend/src/config/env.ts', [
    "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')",
    "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')",
  ], 'corporate-readonly-source-contract');

  const offlineGatePrefixes = [
    'quota-source-contract',
    'mcp-readonly-source-contract',
    'observability-allowlist',
    'runtime-contract-forbidden-fields',
    'observability-forbidden-fields',
    'analytics-allowlisted-fields',
    'gateway-no-raw-payload',
    'mcp-fail-closed-defaults',
    'corporate-readonly-source-contract',
    'offline-source-contracts',
  ];
  if (!errors.some((error) => offlineGatePrefixes.some((prefix) => error.startsWith(prefix)))) {
    pass('governed-runtime-source-contracts');
  }
}

const suite = validateVersionedSuite();

if (mode === '--run-offline') {
  for (const testCase of suite.allCases) validateOfflineCase(testCase);
  if (!errors.some((error) => [
    'deterministic-decisions',
    'quota-enforcement',
    'mcp-write-block',
    'rag-grounding',
    'raw-payload-leakage',
  ].some((prefix) => error.startsWith(prefix)))) {
    pass('deterministic-offline-case-evaluation');
  }
}

if (mode === '--dry-run' || mode === '--run-offline') {
  validateOfflineSourceContracts();
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`FAIL ${error}\n`);
  process.stderr.write(`\n16S eval summary: mode=${mode.slice(2)} cases=${suite.allCases.length} gates=${passedGates.length} fail=${errors.length}\n`);
  process.exit(1);
}

if (mode === '--report') {
  const categoryCounts = [...suite.categories].sort().map((category) => {
    const count = suite.allCases.filter((testCase) => testCase.category === category).length;
    return `${category}=${count}`;
  });
  process.stdout.write('Orchestra 16S versioned eval report\n');
  process.stdout.write(`schema=orchestra.eval-suite.16s.v1 version=16s.1 cases=${suite.allCases.length}\n`);
  process.stdout.write(`categories: ${categoryCounts.join(' ')}\n`);
  process.stdout.write(`gates: ${passedGates.join(', ')}\n`);
  process.stdout.write('network=disabled provider=disabled corporate-services=disabled raw-payload-output=disabled\n');
} else {
  for (const gate of passedGates) process.stdout.write(`PASS ${gate}\n`);
  process.stdout.write(`\n16S eval summary: mode=${mode.slice(2)} cases=${suite.allCases.length} gates=${passedGates.length} fail=0\n`);
}
