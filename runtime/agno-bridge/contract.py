import json
import math
import re
from typing import Any


ASSISTANT_SPEC_VERSION = "orchestra.runtime.assistant.v1"
EXECUTE_REQUEST_VERSION = "orchestra.runtime.execute.v1"
EXECUTE_RESPONSE_VERSION = "orchestra.runtime.response.v1"

ERROR_CODES = {
    "RUNTIME_UNAVAILABLE",
    "RUNTIME_TIMEOUT",
    "RUNTIME_BAD_REQUEST",
    "RUNTIME_POLICY_BLOCKED",
    "RUNTIME_TOOL_BLOCKED",
    "RUNTIME_RAG_BLOCKED",
    "RUNTIME_PROVIDER_FAILED",
    "RUNTIME_INVALID_RESPONSE",
    "RUNTIME_UNKNOWN_ERROR",
}

UNSAFE_KEY_FRAGMENTS = {
    "apikey",
    "authorization",
    "baseurl",
    "cookie",
    "credential",
    "connectionstring",
    "endpoint",
    "headers",
    "gatewayurl",
    "internalurl",
    "password",
    "providerapikey",
    "rawpayload",
    "rawdocuments",
    "rawmcpserverconfig",
    "rawprompt",
    "rawproviderresponse",
    "rawresponse",
    "rawtool",
    "rawtoolmanifest",
    "stack",
    "secret",
    "secretref",
    "serverurl",
    "token",
    "toolargs",
    "tooloutput",
    "toolresult",
}
ALLOWED_TOKEN_KEYS = {"maxtokens", "inputtokens", "outputtokens", "totaltokens"}
SENSITIVE_STRING = re.compile(r"(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|https?://[^/\s:@]+:[^/\s@]+@)", re.I)
INTERNAL_URL = re.compile(
    r"https?://(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|"
    r"172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[^/\s]+\.(?:internal|local))"
    r"(?::\d+)?(?:[/?#\s]|$)",
    re.I,
)
SAFE_TRACE_ID = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")


class ContractValidationError(ValueError):
    pass


def _fail() -> None:
    raise ContractValidationError("Runtime request payload is invalid.")


def _record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail()
    return value


def _strict_object(
    value: Any,
    required: set[str],
    optional: set[str] | None = None,
) -> dict[str, Any]:
    obj = _record(value)
    optional = optional or set()
    if not required.issubset(obj) or set(obj) - required - optional:
        _fail()
    return obj


def _string(value: Any, minimum: int, maximum: int, *, nullable: bool = False) -> str | None:
    if nullable and value is None:
        return None
    if not isinstance(value, str):
        _fail()
    trimmed = value.strip()
    if len(trimmed) < minimum or len(trimmed) > maximum:
        _fail()
    return trimmed


def _id(value: Any, *, nullable: bool = False) -> str | None:
    return _string(value, 1, 160, nullable=nullable)


def _boolean(value: Any) -> bool:
    if not isinstance(value, bool):
        _fail()
    return value


def _integer(value: Any, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        _fail()
    return value


def _number(value: Any, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not minimum <= value <= maximum:
        _fail()
    return float(value)


def _enum(value: Any, allowed: set[str]) -> str:
    if not isinstance(value, str) or value not in allowed:
        _fail()
    return value


def _array(value: Any, maximum: int) -> list[Any]:
    if not isinstance(value, list) or len(value) > maximum:
        _fail()
    return value


def _normalized_key(key: str) -> str:
    return re.sub(r"[-_\s]", "", key).lower()


def _unsafe_key(key: str) -> bool:
    normalized = _normalized_key(key)
    if normalized in ALLOWED_TOKEN_KEYS:
        return False
    return any(fragment in normalized for fragment in UNSAFE_KEY_FRAGMENTS)


def contains_unsafe_payload(value: Any, depth: int = 0) -> bool:
    if isinstance(value, str):
        return bool(SENSITIVE_STRING.search(value) or INTERNAL_URL.search(value))
    if value is None or isinstance(value, (bool, int, float)):
        return False
    if depth > 8:
        return True
    if isinstance(value, list):
        return any(contains_unsafe_payload(item, depth + 1) for item in value)
    if not isinstance(value, dict):
        return True
    return any(
        not isinstance(key, str) or _unsafe_key(key) or contains_unsafe_payload(entry, depth + 1)
        for key, entry in value.items()
    )


def _safe_json(value: Any, depth: int = 0) -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value):
            _fail()
        return
    if isinstance(value, str):
        if len(value) > 2_000:
            _fail()
        return
    if depth > 8:
        _fail()
    if isinstance(value, list):
        if len(value) > 50:
            _fail()
        for item in value:
            _safe_json(item, depth + 1)
        return
    if isinstance(value, dict):
        if len(value) > 80:
            _fail()
        for key, entry in value.items():
            if not isinstance(key, str):
                _fail()
            _safe_json(entry, depth + 1)
        return
    _fail()


def _safe_object(value: Any) -> dict[str, Any]:
    obj = _record(value)
    _safe_json(obj)
    try:
        size = len(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    except (TypeError, ValueError):
        _fail()
    if size > 8_000 or contains_unsafe_payload(obj):
        _fail()
    return obj


def _optional_safe_metadata(obj: dict[str, Any]) -> None:
    if "metadata" in obj:
        _safe_object(obj["metadata"])


def _validate_trace(value: Any) -> None:
    obj = _strict_object(value, {"traceId", "runId"}, {"requestId"})
    _id(obj["traceId"])
    _id(obj["runId"])
    if "requestId" in obj:
        _id(obj["requestId"])


def _validate_actor(value: Any) -> None:
    obj = _strict_object(value, {"userId"}, {"roleIds", "permissionHints"})
    _id(obj["userId"])
    for key in ("roleIds", "permissionHints"):
        if key in obj:
            for item in _array(obj[key], 80):
                _id(item)


def _validate_assistant(value: Any) -> None:
    obj = _strict_object(value, {"id"}, {"versionId", "name", "status", "locale"})
    _id(obj["id"])
    if "versionId" in obj:
        _id(obj["versionId"], nullable=True)
    if "name" in obj:
        _string(obj["name"], 0, 240)
    if "status" in obj:
        _string(obj["status"], 0, 80)
    if "locale" in obj:
        _string(obj["locale"], 2, 20, nullable=True)


def _validate_attachments(value: Any) -> None:
    for attachment in _array(value, 20):
        obj = _strict_object(
            attachment,
            {"attachmentId", "type"},
            {"name", "mimeType", "sizeBytes", "metadata"},
        )
        _id(obj["attachmentId"])
        _enum(obj["type"], {"file", "image", "text"})
        if "name" in obj:
            _string(obj["name"], 0, 240)
        if "mimeType" in obj:
            _string(obj["mimeType"], 0, 120)
        if "sizeBytes" in obj:
            _integer(obj["sizeBytes"], 0, 25_000_000)
        _optional_safe_metadata(obj)


def _validate_input(value: Any) -> None:
    obj = _strict_object(value, {"message"}, {"attachments", "metadata"})
    _string(obj["message"], 1, 16_000)
    if "attachments" in obj:
        _validate_attachments(obj["attachments"])
    _optional_safe_metadata(obj)


def _validate_conversation(value: Any) -> None:
    obj = _strict_object(value, {"messages", "summary"})
    messages = _array(obj["messages"], 50)
    total_chars = 0
    if not messages:
        _fail()
    for message in messages:
        item = _strict_object(message, {"role", "content"})
        _enum(item["role"], {"user", "assistant"})
        content = _string(item["content"], 1, 4_000)
        total_chars += len(content or "")
    summary = _strict_object(
        obj["summary"],
        {"enabled", "included", "messageCount", "totalChars", "truncated", "maxMessages", "maxMessageChars", "maxTotalChars"},
    )
    if _boolean(summary["enabled"]) is not True or _boolean(summary["included"]) is not True:
        _fail()
    message_count = _integer(summary["messageCount"], 1, 50)
    stated_total = _integer(summary["totalChars"], 1, 20_000)
    _boolean(summary["truncated"])
    max_messages = _integer(summary["maxMessages"], 1, 50)
    max_message_chars = _integer(summary["maxMessageChars"], 1, 4_000)
    max_total_chars = _integer(summary["maxTotalChars"], 1, 20_000)
    if message_count != len(messages) or stated_total != total_chars or len(messages) > max_messages:
        _fail()
    if total_chars > max_total_chars or any(len(item["content"].strip()) > max_message_chars for item in messages):
        _fail()


def _validate_model(value: Any) -> None:
    obj = _strict_object(value, {"provider", "model"}, {"temperature", "maxTokens", "topP"})
    _string(obj["provider"], 1, 80)
    _string(obj["model"], 1, 160)
    if "temperature" in obj:
        _number(obj["temperature"], 0, 2)
    if "maxTokens" in obj:
        _integer(obj["maxTokens"], 1, 200_000)
    if "topP" in obj:
        _number(obj["topP"], 0, 1)


def _validate_policy(value: Any) -> None:
    obj = _strict_object(
        value,
        {"executionMode", "streaming", "timeoutMs", "maxToolCalls", "maxRagResults", "maxContextChars", "failClosed"},
    )
    if obj["executionMode"] != "sync" or obj["streaming"] is not False or obj["failClosed"] is not True:
        _fail()
    _integer(obj["timeoutMs"], 1, 300_000)
    _integer(obj["maxToolCalls"], 0, 50)
    _integer(obj["maxRagResults"], 0, 100)
    _integer(obj["maxContextChars"], 0, 200_000)


def _validate_instructions(value: Any) -> None:
    obj = _strict_object(value, set(), {"system", "developer", "responseFormat"})
    if "system" in obj:
        _string(obj["system"], 0, 12_000)
    if "developer" in obj:
        _string(obj["developer"], 0, 12_000)
    if "responseFormat" in obj:
        _string(obj["responseFormat"], 0, 120)


def _validate_rag(value: Any, policy: dict[str, Any]) -> None:
    obj = _strict_object(value, {"enabled", "mode", "sources"})
    enabled = _boolean(obj["enabled"])
    mode = _enum(obj["mode"], {"none", "resolved_context", "gateway"})
    sources = _array(obj["sources"], 100)
    for source in sources:
        item = _strict_object(source, {"sourceId", "excerpt"}, {"documentId", "chunkId", "title", "score", "metadata"})
        _id(item["sourceId"])
        for key in ("documentId", "chunkId"):
            if key in item:
                _id(item[key])
        if "title" in item:
            _string(item["title"], 0, 240)
        _string(item["excerpt"], 1, 4_000)
        if "score" in item:
            _number(item["score"], 0, 1)
        _optional_safe_metadata(item)
    if mode == "none" and sources:
        _fail()
    if not enabled and mode != "none":
        _fail()
    if mode == "resolved_context" and len(sources) > policy["maxRagResults"]:
        _fail()


def _validate_tools(value: Any) -> None:
    obj = _strict_object(value, {"enabled", "mode", "descriptors"})
    enabled = _boolean(obj["enabled"])
    mode = _enum(obj["mode"], {"none", "gateway"})
    descriptors = _array(obj["descriptors"], 50)
    for descriptor in descriptors:
        item = _strict_object(
            descriptor,
            {"toolId", "name", "approvalRequired", "gatewayRef"},
            {"description", "riskLevel", "inputSchema", "metadata"},
        )
        _id(item["toolId"])
        _string(item["name"], 1, 120)
        if "description" in item:
            _string(item["description"], 0, 1_000)
        if "riskLevel" in item:
            _enum(item["riskLevel"], {"low", "medium", "high"})
        _boolean(item["approvalRequired"])
        if "inputSchema" in item:
            _safe_object(item["inputSchema"])
        gateway_ref = _strict_object(item["gatewayRef"], {"type", "action"})
        if gateway_ref["type"] != "orchestra_tool_gateway" or gateway_ref["action"] != "mcp.tool.execute":
            _fail()
        if "metadata" in item:
            metadata = _strict_object(item["metadata"], {"source"}, {"bindingId", "descriptorIndex"})
            if metadata["source"] != "orchestra_mcp_catalog":
                _fail()
            if "bindingId" in metadata:
                _id(metadata["bindingId"])
            if "descriptorIndex" in metadata:
                _integer(metadata["descriptorIndex"], 1, 50)
    if mode == "none" and descriptors:
        _fail()
    if not enabled and mode != "none":
        _fail()
    if enabled and mode != "gateway":
        _fail()
    if mode == "gateway" and not descriptors:
        _fail()


def _validate_observability(value: Any) -> None:
    obj = _strict_object(value, {"usageEventEnabled", "auditEnabled", "qualityEvaluationEnabled"})
    for entry in obj.values():
        _boolean(entry)


def _validate_limits(value: Any) -> None:
    obj = _strict_object(value, {"enforce"}, {"limitEvaluationId", "blockedBeforeRuntime"})
    _boolean(obj["enforce"])
    if "limitEvaluationId" in obj:
        _id(obj["limitEvaluationId"])
    if "blockedBeforeRuntime" in obj:
        _boolean(obj["blockedBeforeRuntime"])


def validate_execute_request(value: Any) -> dict[str, Any]:
    request = _strict_object(value, {"specVersion", "assistantRuntimeSpec"})
    if request["specVersion"] != EXECUTE_REQUEST_VERSION:
        _fail()
    spec = _strict_object(
        request["assistantRuntimeSpec"],
        {
            "specVersion", "trace", "tenant", "workspace", "actor", "assistant", "input", "model",
            "policy", "instructions", "rag", "tools", "observability", "limits",
        },
        {"conversationContext", "metadata"},
    )
    if spec["specVersion"] != ASSISTANT_SPEC_VERSION:
        _fail()
    _validate_trace(spec["trace"])
    tenant = _strict_object(spec["tenant"], {"id"})
    _id(tenant["id"])
    workspace = _strict_object(spec["workspace"], {"id"})
    _id(workspace["id"], nullable=True)
    _validate_actor(spec["actor"])
    _validate_assistant(spec["assistant"])
    _validate_input(spec["input"])
    if "conversationContext" in spec:
        _validate_conversation(spec["conversationContext"])
    _validate_model(spec["model"])
    _validate_policy(spec["policy"])
    _validate_instructions(spec["instructions"])
    _validate_rag(spec["rag"], spec["policy"])
    _validate_tools(spec["tools"])
    _validate_observability(spec["observability"])
    _validate_limits(spec["limits"])
    _optional_safe_metadata(spec)
    if contains_unsafe_payload(request):
        _fail()
    return request


def trace_from_unknown(value: Any) -> dict[str, str]:
    fallback = {"traceId": "invalid-request", "runId": "invalid-run"}
    if not isinstance(value, dict):
        return fallback
    spec = value.get("assistantRuntimeSpec")
    if not isinstance(spec, dict):
        return fallback
    trace = spec.get("trace")
    if not isinstance(trace, dict):
        return fallback

    result = dict(fallback)
    for source, target in (("traceId", "traceId"), ("runId", "runId")):
        candidate = trace.get(source)
        if isinstance(candidate, str) and SAFE_TRACE_ID.fullmatch(candidate):
            result[target] = candidate
    return result
