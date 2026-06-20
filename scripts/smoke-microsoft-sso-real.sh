#!/usr/bin/env bash
set -euo pipefail

if [ "${RUN_REAL_MICROSOFT_SSO_SMOKE:-false}" != "true" ]; then
  echo "SKIP microsoft-sso-real: set RUN_REAL_MICROSOFT_SSO_SMOKE=true to run this opt-in smoke."
  exit 0
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
COOKIE_NAME="${COOKIE_NAME:-orchestra_session}"

headers_file="$(mktemp)"
response_file="$(mktemp)"
trap 'rm -f "$headers_file" "$response_file"' EXIT

expect_status() {
  local expected="$1"
  local label="$2"
  shift 2

  local status
  : > "$headers_file"
  status="$(curl -sS -D "$headers_file" -o "$response_file" -w '%{http_code}' "$@")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL $label expected=$expected actual=$status"
    cat "$response_file"
    exit 1
  fi

  echo "OK $label $status"
}

expect_status 200 "auth-sso-config-real" "$BASE_URL/api/v1/auth/sso/config"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert data["provider"] == "microsoft"; assert data["enabled"] is True; assert data["configured"] is True; assert data["loginUrl"] == "/api/v1/auth/microsoft/start"; assert data["allowedDomains"]; forbidden=("id"+"_token","access"+"_token","refresh"+"_token","authorization"+"_code","client"+"_secret"); assert not any(item in text.lower() for item in forbidden)' "$response_file"

expect_status 302 "auth-microsoft-start-real" "$BASE_URL/api/v1/auth/microsoft/start"

python3 - "$headers_file" "$COOKIE_NAME" <<'PY'
import sys

headers = open(sys.argv[1], encoding="utf-8", errors="replace").read().splitlines()
transaction_cookie = f"{sys.argv[2]}_microsoft_sso"
location = next((line.split(":", 1)[1].strip() for line in headers if line.lower().startswith("location:")), "")
set_cookies = [line for line in headers if line.lower().startswith("set-cookie:")]
assert location.startswith("https://login.microsoftonline.com/")
assert any(f"{transaction_cookie}=" in cookie and "HttpOnly" in cookie for cookie in set_cookies)
PY

expect_status 302 "auth-microsoft-logout-real" "$BASE_URL/api/v1/auth/microsoft/logout"

python3 - "$headers_file" "$COOKIE_NAME" <<'PY'
import sys

headers = open(sys.argv[1], encoding="utf-8", errors="replace").read().splitlines()
cookie_name = sys.argv[2]
location = next((line.split(":", 1)[1].strip() for line in headers if line.lower().startswith("location:")), "")
set_cookies = [line for line in headers if line.lower().startswith("set-cookie:")]
assert location.startswith("https://login.microsoftonline.com/")
assert "post_logout_redirect_uri=" in location
assert any(f"{cookie_name}=;" in cookie for cookie in set_cookies)
PY

cat <<EOF
Manual browser smoke:
1. Open $FRONTEND_URL/login.
2. Click the Microsoft sign-in button.
3. Complete Entra ID sign-in with an allowed corporate account.
4. Confirm redirect to $FRONTEND_URL/app/dashboard.
5. Confirm GET $BASE_URL/api/v1/auth/me returns the Orchestra session when called by the app.
6. Trigger logout from the app and confirm the Orchestra session cookie is cleared.
EOF
