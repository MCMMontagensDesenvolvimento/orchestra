import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from '../../../shared/errors/app-error';

export type McpRemoteHostResolver = (host: string) => Promise<string[]>;

const metadataHosts = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.azure.internal',
  'instance-data.ec2.internal',
]);

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function blocked(message: string): never {
  throw new AppError(409, 'MCP_REMOTE_EGRESS_BLOCKED', message);
}

function blockedIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function blockedIpv6(address: string) {
  const normalized = normalizedHost(address);
  if (normalized.includes('%')) return true;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) !== 4 || blockedIpv4(mapped);
  }
  return /^(?:fc|fd)/.test(normalized)
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:')
    || normalized === '2001:db8::';
}

export function isBlockedMcpRemoteAddress(address: string) {
  const version = isIP(normalizedHost(address));
  if (version === 4) return blockedIpv4(normalizedHost(address));
  if (version === 6) return blockedIpv6(normalizedHost(address));
  return true;
}

export async function resolveMcpRemoteHost(host: string) {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export interface McpRemoteEgressPolicy {
  environment?: 'development' | 'test' | 'production';
  allowInsecureLocalDemo?: boolean;
  localDemoOrigin?: string;
}

function normalizedOrigin(parsed: URL) {
  const host = normalizedHost(parsed.hostname);
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  return `${parsed.protocol}//${isIP(host) === 6 ? `[${host}]` : host}:${Number(parsed.port || defaultPort)}`;
}

function configuredLocalDemoOrigin(policy: McpRemoteEgressPolicy) {
  if (!policy.allowInsecureLocalDemo || policy.environment === 'production' || !policy.localDemoOrigin) return null;
  let parsed: URL;
  try {
    parsed = new URL(policy.localDemoOrigin);
  } catch {
    blocked('MCP local demo origin is invalid.');
  }
  const host = normalizedHost(parsed.hostname);
  const allowedHost = host === 'mcp-readonly-demo'
    || host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1';
  if (
    parsed.protocol !== 'http:'
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || !allowedHost
  ) {
    blocked('MCP local demo origin must be an exact credential-free loopback or mcp-readonly-demo HTTP origin.');
  }
  return normalizedOrigin(parsed);
}

function parseAllowedOrigins(value: string, policy: McpRemoteEgressPolicy) {
  if (!value.trim()) return new Set<string>();
  const origins = new Set<string>();
  const localDemoOrigin = configuredLocalDemoOrigin(policy);
  for (const entry of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      blocked('MCP remote egress allowlist contains an invalid origin.');
    }
    const origin = normalizedOrigin(parsed);
    const isControlledLocalDemo = parsed.protocol === 'http:' && origin === localDemoOrigin;
    if (
      (parsed.protocol !== 'https:' && !isControlledLocalDemo)
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      blocked('MCP remote egress allowlist accepts HTTPS origins or the explicitly enabled local demo origin.');
    }
    origins.add(origin);
  }
  return origins;
}

export interface McpRemoteEgressTarget {
  protocol: 'https:' | 'http:';
  host: string;
  port: number;
  origin: string;
}

export async function validateMcpRemoteEgress(
  rawUrl: string,
  allowlist: string,
  resolver: McpRemoteHostResolver = resolveMcpRemoteHost,
  policy: McpRemoteEgressPolicy = {},
): Promise<McpRemoteEgressTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    blocked('MCP remote destination is invalid.');
  }
  const origin = normalizedOrigin(parsed);
  const localDemoOrigin = configuredLocalDemoOrigin(policy);
  const isControlledLocalDemo = parsed.protocol === 'http:' && origin === localDemoOrigin;
  if (parsed.protocol !== 'https:' && !isControlledLocalDemo) blocked('MCP remote destination protocol is blocked.');
  if (parsed.username || parsed.password) blocked('MCP remote destination must not embed credentials.');
  if (parsed.search) blocked('MCP remote destination query strings are blocked.');
  if (parsed.hash) blocked('MCP remote destination fragments are blocked.');

  const host = normalizedHost(parsed.hostname);
  if (!isControlledLocalDemo && (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host === 'local'
    || host.endsWith('.local')
    || metadataHosts.has(host)
  )) {
    blocked('MCP remote destination host is blocked.');
  }

  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  if (!parseAllowedOrigins(allowlist, policy).has(origin)) {
    blocked('MCP remote destination is not allowlisted.');
  }

  if (!isControlledLocalDemo) {
    const addresses = isIP(host) ? [host] : await resolver(host).catch(() => []);
    if (addresses.length === 0 || addresses.some(isBlockedMcpRemoteAddress)) {
      blocked('MCP remote destination resolved to a blocked address.');
    }
  }

  return { protocol: parsed.protocol as 'https:' | 'http:', host, port, origin };
}
