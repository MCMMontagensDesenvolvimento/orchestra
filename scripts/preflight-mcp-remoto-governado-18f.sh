#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHASE_BASE_COMMIT="58e5936"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/mcp/ORCHESTRA_MCP_REMOTO_GOVERNADO_REAL_18F.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-mcp-remoto-governado-18f.sh"
SMOKE="$ROOT_DIR/scripts/smoke-mcp-remoto-governado-18f.sh"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
CI="$ROOT_DIR/.github/workflows/ci.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
REMOTE_DIR="$ROOT_DIR/backend/src/modules/mcp/remote"
REMOTE_CONFIG="$REMOTE_DIR/mcp-remote.config.ts"
REMOTE_CLIENT="$REMOTE_DIR/mcp-remote.client.ts"
READINESS="$REMOTE_DIR/mcp-remote-readiness.service.ts"
DISCOVERY="$REMOTE_DIR/mcp-remote-discovery.service.ts"
EGRESS="$REMOTE_DIR/mcp-remote-egress.ts"
READONLY_POLICY="$REMOTE_DIR/mcp-remote-readonly-policy.ts"
TRANSPORT="$REMOTE_DIR/mcp-remote-transport.ts"
TRANSPORT_FACTORY="$REMOTE_DIR/mcp-remote-transport.factory.ts"
CORPORATE_CONFIG="$REMOTE_DIR/corporate-readonly/corporate-readonly.config.ts"
CORPORATE_TRANSPORT="$REMOTE_DIR/corporate-readonly/corporate-readonly.transport.ts"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-mcp-remoto-governado-18f.sh [--dry-run|--local-check|--go-no-go-template|--help]

  --dry-run           Validate the versioned 18F.1A artifacts and existing fail-closed MCP contracts.
  --local-check       Validate only the allowlisted process variables without resolving a secret.
  --go-no-go-template Print only the offline 18F.1A decision checklist.
  --help              Print this help.

Every mode is offline. No mode loads .env, performs DNS/network/database access, invokes
MCP/provider/tool/AgentRun, starts Docker, runs Prisma/migrations, opens a browser, deploys
or changes files. Variable values are never printed.
EOF
}

render_summary() {
  local failures="$1"
  cat <<EOF
18F governed remote MCP preflight summary:
phase=18F
stage=18F.1A
mode=${MODE#--}
profile=local-check
offline=true
network=false
remoteEnabled=true
discoveryEnabled=true
executionEnabled=false
readOnlyEnabled=true
writeToolsAllowed=false
secretRefRequired=true
corporateReadonlyEnabled=true
realReadiness=false
realDiscovery=false
realToolExecution=false
browserRequired=false
deployment=false
migration=false
production=false
PASS=$pass_count
FAIL=$failures
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n\n' "$1" >&2
  render_summary 1 >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "${1#"$ROOT_DIR/"} is missing"
  pass "${1#"$ROOT_DIR/"} exists"
}

require_executable() {
  require_file "$1"
  [ -x "$1" ] || fail "${1#"$ROOT_DIR/"} is not executable"
  pass "${1#"$ROOT_DIR/"} is executable"
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  grep -Fq -- "$pattern" "$file" || fail "$label is missing"
  pass "$label"
}

require_exact_line() {
  local file="$1"
  local line="$2"
  local label="$3"
  grep -Fxq -- "$line" "$file" || fail "$label is missing or changed"
  pass "$label"
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then fail "$label is present"; fi
  pass "$label is absent"
}

phase_change_records() {
  git -C "$ROOT_DIR" diff --name-status "$PHASE_BASE_COMMIT" --
  git -C "$ROOT_DIR" ls-files --others --exclude-standard | sed $'s/^/A\t/'
}

check_phase_scope() {
  local status first_path second_path path
  git -C "$ROOT_DIR" cat-file -e "${PHASE_BASE_COMMIT}^{commit}" 2>/dev/null \
    || fail "18F base commit $PHASE_BASE_COMMIT is unavailable"
  pass "18F base commit $PHASE_BASE_COMMIT is available"

  [ -n "$(phase_change_records)" ] || fail '18F.1A change set is empty'
  while IFS=$'\t' read -r status first_path second_path; do
    [ -n "$status" ] || continue
    path="${second_path:-$first_path}"
    case "$path" in
      docs/ai-orchestration/mcp/ORCHESTRA_MCP_REMOTO_GOVERNADO_REAL_18F.md|\
      scripts/preflight-mcp-remoto-governado-18f.sh|\
      scripts/smoke-mcp-remoto-governado-18f.sh|\
      docs/ai-orchestration/README.md|\
      .github/workflows/ci.yml)
        ;;
      *)
        fail "file outside the 18F.1A allowlist changed: $path"
        ;;
    esac
  done < <(phase_change_records)
  pass '18F.1A changes are limited to the five authorized artifacts'
  pass 'frontend/backend functional code, Prisma, migrations, env examples and Compose are unchanged'
  pass 'historical 16U and 16Y artifacts are unchanged'
}

check_fail_closed_defaults() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    require_exact_line "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} keeps remote MCP disabled"
    require_exact_line "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' "${file#"$ROOT_DIR/"} keeps discovery disabled"
    require_exact_line "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} keeps execution disabled"
    require_exact_line "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} keeps remote read-only disabled"
    require_exact_line "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} keeps egress allowlist empty"
    require_exact_line "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} requires secretRef"
    require_exact_line "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} blocks write tools"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} keeps corporate adapter disabled"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} keeps corporate origin empty"
    reject_pattern "$file" '^MCP_CORPORATE_READONLY_ORIGIN=' "${file#"$ROOT_DIR/"} operational origin variable"
    reject_pattern "$file" '^MCP_CORPORATE_READONLY_SECRET_REF=' "${file#"$ROOT_DIR/"} operational secretRef variable"
  done

  for pattern in \
    "MCP_REMOTE_ENABLED: booleanString('false')" \
    "MCP_REMOTE_DISCOVERY_ENABLED: booleanString('false')" \
    "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" \
    "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" \
    "MCP_REMOTE_REQUIRE_SECRET_REF: booleanString('true')" \
    "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')" \
    "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" \
    "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')"
  do
    require_pattern "$ENV_CONFIG" "$pattern" "backend fail-closed default $pattern"
  done

  for pattern in \
    'MCP_REMOTE_ENABLED: "false"' \
    'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
    'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
    'MCP_REMOTE_READONLY_ENABLED: "false"' \
    'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
    'MCP_REMOTE_REQUIRE_SECRET_REF: "true"' \
    'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
    'MCP_CORPORATE_READONLY_ENABLED: "false"' \
    'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""'
  do
    require_pattern "$PROD_COMPOSE" "$pattern" "production fail-closed setting $pattern"
  done
  reject_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ORIGIN:' 'production operational origin variable'
  reject_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_SECRET_REF:' 'production operational secretRef variable'
}

run_dry_run() {
  local file
  for file in \
    "$RUNBOOK" "$DOC_INDEX" "$CI" "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" "$PROD_COMPOSE" \
    "$REMOTE_CONFIG" "$REMOTE_CLIENT" "$READINESS" "$DISCOVERY" "$EGRESS" "$READONLY_POLICY" \
    "$TRANSPORT" "$TRANSPORT_FACTORY" "$CORPORATE_CONFIG" "$CORPORATE_TRANSPORT"
  do
    require_file "$file"
  done
  require_executable "$PREFLIGHT"
  require_executable "$SMOKE"

  check_phase_scope
  check_fail_closed_defaults

  require_pattern "$REMOTE_CONFIG" 'discoveryEnabled: env.MCP_REMOTE_DISCOVERY_ENABLED' 'remote config maps discovery independently'
  require_pattern "$REMOTE_CONFIG" 'executionEnabled: env.MCP_REMOTE_EXECUTION_ENABLED' 'remote config maps execution independently'
  require_pattern "$REMOTE_CONFIG" 'requireSecretRef: env.MCP_REMOTE_REQUIRE_SECRET_REF' 'remote config requires logical secret references'
  require_pattern "$REMOTE_CONFIG" 'allowWriteTools: env.MCP_REMOTE_ALLOW_WRITE_TOOLS' 'remote config keeps write policy explicit'

  require_pattern "$READINESS" "if (purpose === 'discovery')" 'readiness has a discovery-specific branch'
  require_pattern "$READINESS" "if (!config.discoveryEnabled)" 'readiness gates discovery explicitly'
  require_pattern "$READINESS" 'MCP_REMOTE_EXECUTION_ENABLED=false; discovery can continue while runtime execution remains blocked.' \
    'readiness allows discovery while execution remains blocked'
  require_pattern "$READINESS" 'MCP remote discovery readiness is structurally ready, with runtime execution still governed separately.' \
    'readiness reports discovery separately from execution'
  require_pattern "$READINESS" "if (!config.executionEnabled)" 'readiness independently blocks tool execution'

  require_pattern "$DISCOVERY" "purpose: 'discovery'" 'discovery requests discovery-purpose readiness'
  require_pattern "$DISCOVERY" "if (readiness.status !== 'ready')" 'discovery stops before transport when readiness is not ready'
  require_pattern "$DISCOVERY" 'executionBlocked: true' 'discovery evidence records execution blocked'
  require_pattern "$DISCOVERY" 'validateMcpRemoteEgress(' 'real discovery remains behind egress validation'
  require_pattern "$DISCOVERY" 'this.transport.discoverTools({' 'real discovery transport remains explicit and uncalled by preflight'

  require_pattern "$EGRESS" "parsed.protocol !== 'https:'" 'egress requires HTTPS outside the local demo'
  require_pattern "$EGRESS" 'parsed.username || parsed.password' 'egress rejects embedded credentials'
  require_pattern "$EGRESS" 'parsed.search' 'egress rejects query strings'
  require_pattern "$EGRESS" 'parsed.hash' 'egress rejects fragments'
  require_pattern "$EGRESS" "host === 'localhost'" 'egress blocks localhost'
  require_pattern "$EGRESS" "host.endsWith('.local')" 'egress blocks .local names'
  require_pattern "$EGRESS" 'metadataHosts.has(host)' 'egress blocks metadata hosts'
  require_pattern "$EGRESS" 'isBlockedMcpRemoteAddress' 'egress blocks private and reserved addresses'
  require_pattern "$EGRESS" 'parseAllowedOrigins(allowlist, policy).has(origin)' 'egress requires exact allowlisting'

  require_pattern "$READONLY_POLICY" 'if (!input.config.executionEnabled)' 'read-only policy blocks when execution is disabled'
  require_pattern "$READONLY_POLICY" 'if (input.config.allowWriteTools)' 'read-only policy rejects write-enabled configuration'
  require_pattern "$TRANSPORT" 'export class FailClosedMcpRemoteClientTransport' 'fail-closed remote transport exists'
  require_pattern "$TRANSPORT_FACTORY" 'return new FailClosedMcpRemoteClientTransport();' 'transport factory falls back closed'
  require_pattern "$CORPORATE_TRANSPORT" "method: 'GET'" 'corporate transport remains GET-only'
  reject_pattern "$CORPORATE_TRANSPORT" "method:[[:space:]]*'(POST|PUT|PATCH|DELETE)'" 'write method in corporate transport'

  for section in \
    '## Objetivo da 18F' '## Diagnóstico 18F.0' '## Divisão da Fase 18F' \
    '## Escopo da 18F.1A' '## Fora de escopo' '## Relação com as fases anteriores' \
    '## Flags do perfil local-check' '## Origem e allowlist' '## SecretRef' \
    '## Fail-closed' '## Critérios GO/NO-GO da 18F.1A' '## Evidências permitidas' \
    '## Riscos' '## Rollback da 18F.1A' '## Handoff explícito para 18F.1B'
  do
    require_pattern "$RUNBOOK" "$section" "runbook section $section"
  done
  for marker in \
    'network=false' 'realReadiness=false' 'realDiscovery=false' 'realToolExecution=false' \
    'browserRequired=false' 'deployment=false' 'migration=false' 'production=false'
  do
    require_pattern "$RUNBOOK" "$marker" "runbook boundary $marker"
  done

  require_pattern "$DOC_INDEX" 'A Fase 18F.1A adiciona somente o preflight offline' 'documentation index references the offline-only 18F.1A'
  require_exact_line "$CI" '        run: scripts/smoke-mcp-remoto-governado-18f.sh --dry-run' 'CI invokes only the 18F.1A dry-run smoke'
  [ "$(grep -Fc -- 'scripts/smoke-mcp-remoto-governado-18f.sh --dry-run' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 18F.1A dry-run invocation'
  pass 'CI contains exactly one 18F.1A dry-run invocation'
  reject_pattern "$CI" 'scripts/preflight-mcp-remoto-governado-18f\.sh' 'direct 18F preflight execution in CI'
  reject_pattern "$CI" 'smoke-mcp-remoto-governado-18f\.sh[[:space:]]+--(local-check|go-no-go-template)' 'non-dry-run 18F mode in CI'

  if grep -ERn -- "https://[^[:space:]\"']+" "$REMOTE_DIR" >/dev/null; then
    fail 'an operational HTTPS endpoint is hard-coded in remote MCP functional code'
  fi
  pass 'remote MCP functional code contains no hard-coded HTTPS endpoint'

  bash -n "$PREFLIGHT"
  bash -n "$SMOKE"
  pass '18F.1A Bash syntax checks passed'
}

require_local_variable() {
  local name="$1"
  [ -n "${!name+x}" ] || fail "$name is not set"
  [ -n "${!name}" ] || fail "$name is empty"
  pass "$name is present"
}

require_value() {
  local name="$1"
  local expected="$2"
  [ "${!name}" = "$expected" ] || fail "$name must be $expected for the 18F.1A local-check profile"
  pass "$name has the required boolean state"
}

run_local_check() {
  local variables=(
    MCP_REMOTE_ENABLED
    MCP_REMOTE_DISCOVERY_ENABLED
    MCP_REMOTE_EXECUTION_ENABLED
    MCP_REMOTE_READONLY_ENABLED
    MCP_REMOTE_ALLOW_WRITE_TOOLS
    MCP_REMOTE_REQUIRE_SECRET_REF
    MCP_CORPORATE_READONLY_ENABLED
    MCP_CORPORATE_READONLY_ORIGIN
    MCP_CORPORATE_READONLY_ALLOWED_ORIGIN
    MCP_REMOTE_EGRESS_ALLOWLIST
    MCP_CORPORATE_READONLY_SECRET_REF
  )
  local name
  for name in "${variables[@]}"; do require_local_variable "$name"; done

  require_value MCP_REMOTE_ENABLED true
  require_value MCP_REMOTE_DISCOVERY_ENABLED true
  require_value MCP_REMOTE_EXECUTION_ENABLED false
  require_value MCP_REMOTE_READONLY_ENABLED true
  require_value MCP_REMOTE_ALLOW_WRITE_TOOLS false
  require_value MCP_REMOTE_REQUIRE_SECRET_REF true
  require_value MCP_CORPORATE_READONLY_ENABLED true

  ORIGIN_TO_VALIDATE="$MCP_CORPORATE_READONLY_ORIGIN" node <<'NODE18F' \
    || fail 'MCP_CORPORATE_READONLY_ORIGIN must be one exact public HTTPS origin'
const { isIP } = require('node:net');

const raw = process.env.ORIGIN_TO_VALIDATE;
let parsed;
try {
  parsed = new URL(raw);
} catch {
  process.exit(1);
}

const hostWithBrackets = parsed.hostname.toLowerCase();
const host = hostWithBrackets.replace(/^\[|\]$/g, '');
const metadataHosts = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.azure.internal',
  'instance-data.ec2.internal',
]);

function blockedIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && c === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function ipv6Value(address) {
  if (address.includes('%') || address.split('::').length > 2) return null;
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.reduce((value, part) => (value << 16n) | BigInt(`0x${part}`), 0n);
}

function inIpv6Cidr(value, prefixText, bits) {
  const prefix = ipv6Value(prefixText);
  if (value === null || prefix === null) return true;
  const shift = BigInt(128 - bits);
  return (value >> shift) === (prefix >> shift);
}

function blockedIpv6(address) {
  const value = ipv6Value(address);
  return value === null || [
    ['::', 8],
    ['5f00::', 16],
    ['100::', 64],
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
  ].some(([prefix, bits]) => inIpv6Cidr(value, prefix, bits));
}

const blockedName = host === 'localhost'
  || host.endsWith('.localhost')
  || host === 'local'
  || host.endsWith('.local')
  || metadataHosts.has(host)
  || parsed.hostname.endsWith('.');
const ipVersion = isIP(host);
const blockedAddress = ipVersion === 4
  ? blockedIpv4(host)
  : ipVersion === 6 && blockedIpv6(host);

if (
  parsed.protocol !== 'https:'
  || parsed.username
  || parsed.password
  || parsed.pathname !== '/'
  || parsed.search
  || parsed.hash
  || raw !== parsed.origin
  || blockedName
  || blockedAddress
) {
  process.exit(1);
}
NODE18F
  pass 'MCP_CORPORATE_READONLY_ORIGIN is one exact public HTTPS origin'

  [ "$MCP_CORPORATE_READONLY_ALLOWED_ORIGIN" = "$MCP_CORPORATE_READONLY_ORIGIN" ] \
    || fail 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN must be textually equal to MCP_CORPORATE_READONLY_ORIGIN'
  pass 'corporate allowed origin is textually equal to the origin'

  [ "$MCP_REMOTE_EGRESS_ALLOWLIST" = "$MCP_CORPORATE_READONLY_ORIGIN" ] \
    || fail 'MCP_REMOTE_EGRESS_ALLOWLIST must contain exactly the single approved origin'
  pass 'egress allowlist contains exactly the single approved origin'

  [[ "$MCP_CORPORATE_READONLY_SECRET_REF" =~ ^env://[A-Z][A-Z0-9_]{2,127}$ ]] \
    || fail 'MCP_CORPORATE_READONLY_SECRET_REF must be a logical env reference'
  pass 'corporate secretRef is logical and was neither resolved nor printed'
}

render_go_no_go_template() {
  cat <<'EOF'
18F.1A GO/NO-GO decision checklist (offline template)
[ ] Dry-run completed with FAIL=0.
[ ] Local-check completed with FAIL=0 and no variable value disclosed.
[ ] Remote and discovery are enabled only in the approved ephemeral process.
[ ] Execution remains false and write tools remain blocked.
[ ] The single public HTTPS origin, allowed origin and egress allowlist are textually equal.
[ ] The secretRef is logical env:// and was not resolved.
[ ] Versioned defaults, origins and phase scope remain fail-closed.
[ ] Evidence is sanitized and reviewed by the accountable operator.
[ ] Handoff to 18F.1B is not implicit and requires a separate approved window.
Decision: [ ] GO  [ ] NO-GO
EOF
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }
case "$MODE" in
  --dry-run)
    run_dry_run
    ;;
  --local-check)
    run_local_check
    ;;
  --go-no-go-template)
    render_go_no_go_template
    exit 0
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

printf '\n'
render_summary 0
