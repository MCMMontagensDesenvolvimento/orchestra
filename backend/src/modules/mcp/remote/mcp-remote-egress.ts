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

function parseAllowedOrigins(value: string) {
  if (!value.trim()) return new Set<string>();
  const origins = new Set<string>();
  for (const entry of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      blocked('MCP remote egress allowlist contains an invalid origin.');
    }
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      blocked('MCP remote egress allowlist accepts only credential-free HTTPS origins.');
    }
    const host = normalizedHost(parsed.hostname);
    origins.add(`https://${isIP(host) === 6 ? `[${host}]` : host}:${parsed.port || '443'}`);
  }
  return origins;
}

export interface McpRemoteEgressTarget {
  protocol: 'https:';
  host: string;
  port: number;
  origin: string;
}

export async function validateMcpRemoteEgress(
  rawUrl: string,
  allowlist: string,
  resolver: McpRemoteHostResolver = resolveMcpRemoteHost,
): Promise<McpRemoteEgressTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    blocked('MCP remote destination is invalid.');
  }
  if (parsed.protocol !== 'https:') blocked('MCP remote destination protocol is blocked.');
  if (parsed.username || parsed.password) blocked('MCP remote destination must not embed credentials.');
  if (parsed.search) blocked('MCP remote destination query strings are blocked.');
  if (parsed.hash) blocked('MCP remote destination fragments are blocked.');

  const host = normalizedHost(parsed.hostname);
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host === 'local'
    || host.endsWith('.local')
    || metadataHosts.has(host)
  ) {
    blocked('MCP remote destination host is blocked.');
  }

  const port = Number(parsed.port || 443);
  const origin = `https://${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
  if (!parseAllowedOrigins(allowlist).has(origin)) {
    blocked('MCP remote destination is not allowlisted.');
  }

  const addresses = isIP(host) ? [host] : await resolver(host).catch(() => []);
  if (addresses.length === 0 || addresses.some(isBlockedMcpRemoteAddress)) {
    blocked('MCP remote destination resolved to a blocked address.');
  }

  return { protocol: 'https:', host, port, origin };
}
