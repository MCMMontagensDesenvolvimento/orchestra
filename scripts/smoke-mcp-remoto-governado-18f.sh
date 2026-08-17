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
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-mcp-remoto-governado-18f.sh [--dry-run|--help]

The dry-run performs static and process-local checks only. It never loads .env, resolves
DNS/secrets, opens a socket/browser, contacts network/database/MCP/provider, executes a
tool or AgentRun, starts Docker, runs Prisma/migrations, deploys or changes files.
EOF
}

render_summary() {
  local failures="$1"
  cat <<EOF
18F governed remote MCP smoke summary:
phase=18F
stage=18F.1A
offline=true
network=false
realReadiness=false
realDiscovery=false
realToolExecution=false
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

reject_executable_operations() {
  local file="$1"
  local label="$2"
  reject_pattern "$file" \
    '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh|scp|sftp|dig|nslookup|host|getent)[[:space:]]' \
    "executable network or DNS command in $label"
  reject_pattern "$file" \
    '(/dev/(tcp|udp)|(^|[^[:alnum:]_])(fetch|axios|got|request|connect|lookup)[[:space:]]*\(|node:(http|https|dns|dgram|tls))' \
    "executable network API in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(docker([[:space:]]+compose)?|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|create|rm|down)' \
    "executable Docker command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*((npx[[:space:]]+)?prisma|npm|pnpm|yarn)[[:space:]].*(migrate|db[[:space:]]+push|prisma:seed)' \
    "executable Prisma migration or seed in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(psql|mysql|mariadb|sqlite3|mongosh|redis-cli)[[:space:]]' \
    "executable database client in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npx|npm|pnpm|yarn)[[:space:]].*(playwright|cypress|test:e2e|test:visual)' \
    "executable browser command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    "executable deployment command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*[^#]*(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real|mcp[[:alnum:]_-]*[[:space:]]+(run|execute|call))' \
    "executable provider, MCP or tool command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(env([[:space:]]*\||[[:space:]]*$)|printenv([[:space:]]|$)|set[[:space:]]+-x|export[[:space:]]+-p|cat[[:space:]]+/proc/[^/]+/environ)' \
    "complete environment dump in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(source|\.)[[:space:]]+[^#]*\.env([[:space:]]|$)' \
    "automatic .env load in $label"
}

phase_change_records() {
  git -C "$ROOT_DIR" diff --name-status "$PHASE_BASE_COMMIT" --
  git -C "$ROOT_DIR" ls-files --others --exclude-standard | sed $'s/^/A\t/'
}

check_phase_scope() {
  local status first_path second_path path
  git -C "$ROOT_DIR" cat-file -e "${PHASE_BASE_COMMIT}^{commit}" 2>/dev/null \
    || fail "18F base commit $PHASE_BASE_COMMIT is unavailable"
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
  pass '18F.1A change scope contains only authorized documentation, scripts and CI'

  if git -C "$ROOT_DIR" diff --name-only "$PHASE_BASE_COMMIT" -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
    fail 'Prisma schema or migrations changed in 18F.1A'
  fi
  pass 'Prisma schema and migrations are unchanged'
}

run_local_profile() {
  env -i PATH="$PATH" \
    MCP_REMOTE_ENABLED="$1" \
    MCP_REMOTE_DISCOVERY_ENABLED="$2" \
    MCP_REMOTE_EXECUTION_ENABLED="$3" \
    MCP_REMOTE_READONLY_ENABLED="$4" \
    MCP_REMOTE_ALLOW_WRITE_TOOLS="$5" \
    MCP_REMOTE_REQUIRE_SECRET_REF="$6" \
    MCP_CORPORATE_READONLY_ENABLED="$7" \
    MCP_CORPORATE_READONLY_ORIGIN="$8" \
    MCP_CORPORATE_READONLY_ALLOWED_ORIGIN="$9" \
    MCP_REMOTE_EGRESS_ALLOWLIST="${10}" \
    MCP_CORPORATE_READONLY_SECRET_REF="${11}" \
    "$PREFLIGHT" --local-check
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }
case "$MODE" in
  --dry-run) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

for file in "$RUNBOOK" "$DOC_INDEX" "$CI" "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" "$PROD_COMPOSE"; do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"

HELP_OUTPUT="$("$PREFLIGHT" --help)" || fail 'preflight help execution'
for required_mode in --dry-run --local-check --go-no-go-template --help; do
  grep -Fq -- "$required_mode" <<<"$HELP_OUTPUT" || fail "preflight mode $required_mode"
  pass "preflight exposes mode $required_mode"
done
if "$PREFLIGHT" --unsupported >/dev/null 2>&1; then fail 'preflight accepted an unsupported mode'; fi
pass 'preflight rejects unsupported modes'

reject_executable_operations "$PREFLIGHT" '18F.1A preflight'
reject_executable_operations "$SMOKE" '18F.1A smoke'

credential_pattern='(s''k-[A-Za-z0-9_-]{16,}|AK''IA[0-9A-Z]{16}|AI''za[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})'
if grep -ERn -- "$credential_pattern" "$RUNBOOK" "$PREFLIGHT" "$SMOKE" "$DOC_INDEX" "$CI" "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE" >/dev/null; then
  fail 'apparent credential material detected in the 18F.1A scope'
fi
pass 'no apparent credential material exists in the 18F.1A scope'

check_phase_scope

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"
PREFLIGHT_OUTPUT="$("$PREFLIGHT" --dry-run)" || fail '18F.1A preflight dry-run execution'
STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] || fail '18F.1A preflight changed the worktree'
pass 'preflight dry-run is read-only'

for marker in \
  'phase=18F' 'stage=18F.1A' 'offline=true' 'network=false' \
  'remoteEnabled=true' 'discoveryEnabled=true' 'executionEnabled=false' \
  'readOnlyEnabled=true' 'writeToolsAllowed=false' 'secretRefRequired=true' \
  'realReadiness=false' 'realDiscovery=false' 'realToolExecution=false' \
  'browserRequired=false' 'deployment=false' 'migration=false' 'production=false' 'FAIL=0'
do
  grep -Fq -- "$marker" <<<"$PREFLIGHT_OUTPUT" || fail "preflight marker $marker"
  pass "preflight marker $marker"
done

GO_NOGO_BEFORE="$(git -C "$ROOT_DIR" status --short)"
GO_NOGO_OUTPUT="$("$PREFLIGHT" --go-no-go-template)" || fail 'GO/NO-GO template generation'
GO_NOGO_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$GO_NOGO_BEFORE" = "$GO_NOGO_AFTER" ] || fail 'GO/NO-GO template changed the worktree'
grep -Fxq -- '18F.1A GO/NO-GO decision checklist (offline template)' <<<"$GO_NOGO_OUTPUT" \
  || fail 'GO/NO-GO template title'
grep -Fxq -- 'Decision: [ ] GO  [ ] NO-GO' <<<"$GO_NOGO_OUTPUT" || fail 'GO/NO-GO decision line'
if grep -Eq -- '^(PASS|FAIL)|summary:' <<<"$GO_NOGO_OUTPUT"; then fail 'GO/NO-GO mode printed non-checklist output'; fi
pass 'GO/NO-GO mode prints only the offline decision checklist and changes nothing'

safe_origin='https://mcp-preflight.example'
safe_secret_ref='env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN'
LOCAL_OUTPUT="$(run_local_profile true true false true false true true \
  "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref")" \
  || fail 'valid local-check profile'
grep -Fq -- 'FAIL=0' <<<"$LOCAL_OUTPUT" || fail 'valid local-check success marker'
if grep -Fq -- "$safe_origin" <<<"$LOCAL_OUTPUT" || grep -Fq -- "$safe_secret_ref" <<<"$LOCAL_OUTPUT"; then
  fail 'local-check disclosed an operational variable value'
fi
pass 'valid local-check passes without disclosing origin or secretRef values'

if run_local_profile false true false true false true true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_ENABLED=false'; fi
if run_local_profile true false false true false true true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_DISCOVERY_ENABLED=false'; fi
if run_local_profile true true true true false true true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_EXECUTION_ENABLED=true'; fi
if run_local_profile true true false false false true true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_READONLY_ENABLED=false'; fi
if run_local_profile true true false true true true true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_ALLOW_WRITE_TOOLS=true'; fi
if run_local_profile true true false true false false true "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_REMOTE_REQUIRE_SECRET_REF=false'; fi
if run_local_profile true true false true false true false "$safe_origin" "$safe_origin" "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then fail 'local-check accepted MCP_CORPORATE_READONLY_ENABLED=false'; fi
pass 'local-check enforces all seven exact boolean states'

invalid_origins=(
  'http://mcp-preflight.example'
  'https://user@mcp-preflight.example'
  'https://user:password@mcp-preflight.example'
  'https://mcp-preflight.example/path'
  'https://mcp-preflight.example?query=1'
  'https://mcp-preflight.example#fragment'
  'https://localhost'
  'https://service.local'
  'https://metadata.google.internal'
  'https://127.0.0.1'
  'https://10.0.0.1'
  'https://169.254.169.254'
  'https://192.0.2.1'
  'https://198.51.100.1'
  'https://203.0.113.1'
  'https://[::1]'
  'https://[fc00::1]'
  'https://[fe80::1]'
  'https://[2001:db8::1]'
)
for invalid_origin in "${invalid_origins[@]}"; do
  if run_local_profile true true false true false true true \
    "$invalid_origin" "$invalid_origin" "$invalid_origin" "$safe_secret_ref" >/dev/null 2>&1
  then
    fail 'local-check accepted a blocked origin class'
  fi
done
pass 'local-check rejects non-HTTPS, credentialed, path/query/fragment, local, metadata and reserved origins'

if run_local_profile true true false true false true true "$safe_origin" 'https://other-preflight.example' "$safe_origin" "$safe_secret_ref" >/dev/null 2>&1; then
  fail 'local-check accepted a different corporate allowed origin'
fi
if run_local_profile true true false true false true true "$safe_origin" "$safe_origin" 'https://other-preflight.example' "$safe_secret_ref" >/dev/null 2>&1; then
  fail 'local-check accepted an egress allowlist different from the origin'
fi
pass 'local-check enforces textual equality of origin, corporate allowlist and egress allowlist'

invalid_secret_refs=(
  'env://ORCHESTRA_STATUS_READONLY_TOKEN'
  'env://OTHER_TOKEN'
  'synthetic-raw-token-value'
  "Bearer"" synthetic-placeholder-value"
  ''
)
for invalid_secret_ref in "${invalid_secret_refs[@]}"; do
  if run_local_profile true true false true false true true \
    "$safe_origin" "$safe_origin" "$safe_origin" "$invalid_secret_ref" >/dev/null 2>&1
  then
    fail 'local-check accepted a secretRef outside the governed corporate namespace'
  fi
done
overlong_secret_ref="env://ORCHESTRA_CORPORATE_READONLY_$(printf 'A%.0s' {1..206})"
if run_local_profile true true false true false true true \
  "$safe_origin" "$safe_origin" "$safe_origin" "$overlong_secret_ref" >/dev/null 2>&1
then
  fail 'local-check accepted a logical secretRef longer than 240 characters'
fi
pass 'local-check accepts only the bounded corporate env:// namespace and never resolves it'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_exact_line "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP default"
  require_exact_line "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' "${file#"$ROOT_DIR/"} discovery default"
  require_exact_line "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} execution default"
  require_exact_line "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} read-only default"
  require_exact_line "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} empty egress allowlist"
  require_exact_line "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} required secretRef"
  require_exact_line "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} blocked write tools"
  require_exact_line "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter default"
  require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} empty corporate origin"
done
pass 'versioned env defaults remain closed and contain no operational origin'

require_exact_line "$CI" '        run: scripts/smoke-mcp-remoto-governado-18f.sh --dry-run' 'CI invokes only the 18F.1A dry-run smoke'
[ "$(grep -Fc -- 'scripts/smoke-mcp-remoto-governado-18f.sh --dry-run' "$CI")" -eq 1 ] \
  || fail 'CI must contain exactly one 18F.1A dry-run invocation'
reject_pattern "$CI" 'scripts/preflight-mcp-remoto-governado-18f\.sh' 'direct 18F preflight invocation in CI'
reject_pattern "$CI" 'smoke-mcp-remoto-governado-18f\.sh[[:space:]]+--(local-check|go-no-go-template)' 'non-dry-run 18F mode in CI'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '18F.1A Bash syntax checks passed'

for regression in \
  'smoke-conector-corporativo-readonly-16t.sh --dry-run' \
  'smoke-homologacao-conector-readonly-16u.sh --dry-run' \
  'smoke-readiness-https-tool-status-16y.sh --dry-run' \
  'smoke-mcp-tools-governado-local-18d.sh --dry-run'
do
  read -r script argument <<<"$regression"
  require_executable "$ROOT_DIR/scripts/$script"
  "$ROOT_DIR/scripts/$script" "$argument" >/dev/null \
    || fail "offline regression $script $argument"
  pass "offline regression $script $argument"
done

printf '\n'
render_summary 0
