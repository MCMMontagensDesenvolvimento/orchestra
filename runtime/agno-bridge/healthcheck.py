import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    port = os.environ.get("AGNO_RUNTIME_HTTP_PORT", "8091")
    request = Request(f"http://127.0.0.1:{port}/health", method="GET")
    security_key = os.environ.get("AGNO_RUNTIME_HTTP_SECURITY_KEY", "").strip()
    if security_key:
        request.add_header("Authorization", f"Bearer {security_key}")

    try:
        with urlopen(request, timeout=3) as response:
            payload = json.load(response, parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
        valid = (
            response.status == 200
            and payload.get("provider") == "agno"
            and payload.get("protocolVersion") == "orchestra.runtime.assistant.v1"
            and payload.get("status") in {"healthy", "degraded"}
        )
        return 0 if valid else 1
    except (HTTPError, URLError, OSError, ValueError):
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
