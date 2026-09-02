import json
from io import BytesIO
import sys
import threading
import unittest
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


BRIDGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BRIDGE_ROOT))

from bridge import (  # noqa: E402
    BridgeConfig,
    BridgeConfigurationError,
    ExecutionPlan,
    ExecutorResult,
    GatewaySession,
    _is_openai_assistant_model,
    _openai_model_api,
    create_server,
)


def config(**overrides: str) -> BridgeConfig:
    values = {
        "AGNO_BRIDGE_EXECUTION_MODE": "stub",
        "AGNO_BRIDGE_PROVIDER": "stub",
        "AGNO_RUNTIME_HTTP_HOST": "127.0.0.1",
        "AGNO_RUNTIME_HTTP_PORT": "8091",
        "AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY": "false",
        "AGNO_RUNTIME_HTTP_SECURITY_KEY": "",
        "AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED": "false",
        "AGNO_RUNTIME_HTTP_TOOLS_ENABLED": "false",
        "AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS": "0",
        "AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED": "false",
    }
    values.update(overrides)
    return BridgeConfig.from_env(values)


def execute_payload() -> dict:
    return {
        "specVersion": "orchestra.runtime.execute.v1",
        "assistantRuntimeSpec": {
            "specVersion": "orchestra.runtime.assistant.v1",
            "trace": {"traceId": "trace-bridge-test", "runId": "run-bridge-test"},
            "tenant": {"id": "tenant-1"},
            "workspace": {"id": "workspace-1"},
            "actor": {"userId": "user-1"},
            "assistant": {"id": "assistant-1"},
            "input": {"message": "Use only governed input."},
            "model": {"provider": "local", "model": "deterministic-sandbox"},
            "policy": {
                "executionMode": "sync",
                "streaming": False,
                "timeoutMs": 15_000,
                "maxToolCalls": 0,
                "maxRagResults": 5,
                "maxContextChars": 12_000,
                "failClosed": True,
            },
            "instructions": {"system": "Answer concisely."},
            "rag": {"enabled": False, "mode": "none", "sources": []},
            "tools": {"enabled": False, "mode": "none", "descriptors": []},
            "observability": {
                "usageEventEnabled": True,
                "auditEnabled": True,
                "qualityEvaluationEnabled": False,
            },
            "limits": {"enforce": True},
        },
    }


class RecordingExecutor:
    def __init__(self) -> None:
        self.plans: list[ExecutionPlan] = []

    def execute(self, plan: ExecutionPlan) -> ExecutorResult:
        self.plans.append(plan)
        return ExecutorResult(text="Governed fake provider response.", input_tokens=4, output_tokens=5, total_tokens=9)


class RunningServer:
    def __init__(self, bridge_config: BridgeConfig, executor=None) -> None:
        self.server = create_server(bridge_config, executor, host="127.0.0.1", port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_port}"

    def request(self, path: str, *, payload=None, key: str | None = None) -> tuple[int, dict]:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(self.base_url + path, data=data, method="POST" if payload is not None else "GET")
        if payload is not None:
            request.add_header("Content-Type", "application/json")
        if key:
            request.add_header("Authorization", f"Bearer {key}")
        try:
            with urlopen(request, timeout=2) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)


class GatewayHandler(BaseHTTPRequestHandler):
    request_payload: dict | None = None
    authorization: str | None = None
    external_mcp_called = False

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        GatewayHandler.request_payload = json.loads(self.rfile.read(length))
        GatewayHandler.authorization = self.headers.get("Authorization")
        payload = GatewayHandler.request_payload
        metadata = {
            "toolCallsExecuted": 1,
            "externalMcpCalled": GatewayHandler.external_mcp_called,
            "simulated": True,
            "failedClosed": False,
            "latencyMs": 1,
        }
        if GatewayHandler.external_mcp_called:
            metadata.update({
                "mcpRemoteEvaluationApplied": True,
                "mcpRemoteAllowed": True,
                "mcpRemoteBlocked": False,
                "mcpRemoteReadOnly": True,
                "mcpRemoteHost": "mcp.example.test",
                "mcpRemoteToolId": "tool-1",
                "mcpRemoteRiskLevel": "low",
                "responseBytes": 42,
            })
        response = {
            "data": {
                "toolCallId": payload["toolCallId"],
                "status": "succeeded",
                "result": {"content": "Governed sandbox tool execution completed."},
                "metadata": metadata,
            },
            "requestId": "request-gateway-test",
        }
        body = json.dumps(response).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        del format, args


class AgnoBridgeTests(unittest.TestCase):
    def test_health_and_capabilities_are_contract_compatible_without_auth(self):
        with RunningServer(config()) as server:
            health_status, health = server.request("/health")
            capabilities_status, capabilities = server.request("/capabilities")

        self.assertEqual(health_status, 200)
        self.assertEqual(health["provider"], "agno")
        self.assertEqual(health["protocolVersion"], "orchestra.runtime.assistant.v1")
        self.assertEqual(health["status"], "healthy")
        self.assertEqual(capabilities_status, 200)
        self.assertFalse(capabilities["supportsExternalProviders"])
        self.assertFalse(capabilities["supportsFileInputs"])
        self.assertEqual(capabilities["maxToolCalls"], 0)

    def test_authentication_protects_all_three_endpoints_without_echoing_key(self):
        key = "phase-16h-transport-placeholder"
        protected = config(
            AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY="true",
            AGNO_RUNTIME_HTTP_SECURITY_KEY=key,
        )
        with RunningServer(protected) as server:
            unauthorized = [
                server.request("/health"),
                server.request("/capabilities"),
                server.request("/execute", payload=execute_payload()),
            ]
            authorized = [
                server.request("/health", key=key),
                server.request("/capabilities", key=key),
                server.request("/execute", payload=execute_payload(), key=key),
            ]

        self.assertEqual([item[0] for item in unauthorized], [401, 401, 401])
        self.assertEqual([item[0] for item in authorized], [200, 200, 200])
        self.assertNotIn(key, json.dumps(unauthorized))

    def test_execute_uses_offline_stub_and_preserves_trace(self):
        with RunningServer(config()) as server:
            status, response = server.request("/execute", payload=execute_payload())

        self.assertEqual(status, 200)
        self.assertEqual(response["specVersion"], "orchestra.runtime.response.v1")
        self.assertEqual(response["trace"], {"traceId": "trace-bridge-test", "runId": "run-bridge-test"})
        self.assertEqual(response["status"], "succeeded")
        self.assertTrue(response["output"]["metadata"]["simulated"])
        self.assertFalse(response["output"]["metadata"]["externalProviderCalled"])

    def test_invalid_or_sensitive_payload_is_redacted(self):
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["metadata"] = {"rawPrompt": "must-not-leak"}
        with RunningServer(config()) as server:
            status, response = server.request("/execute", payload=payload)

        serialized = json.dumps(response)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], "RUNTIME_BAD_REQUEST")
        self.assertNotIn("rawPrompt", serialized)
        self.assertNotIn("must-not-leak", serialized)

    def test_rag_context_comes_only_from_orchestra_and_is_not_echoed(self):
        recorder = RecordingExecutor()
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["rag"] = {
            "enabled": True,
            "mode": "resolved_context",
            "sources": [{
                "sourceId": "source-1",
                "title": "Governed source",
                "excerpt": "phase-16h-governed-rag-marker",
                "score": 0.9,
            }],
        }
        with RunningServer(config(AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED="true"), recorder) as server:
            status, response = server.request("/execute", payload=payload)

        self.assertEqual(status, 200)
        self.assertEqual(len(recorder.plans), 1)
        self.assertIn("phase-16h-governed-rag-marker", recorder.plans[0].prompt)
        self.assertNotIn("phase-16h-governed-rag-marker", json.dumps(response))
        self.assertEqual(response["output"]["metadata"]["ragSourceCount"], 1)

    def test_tool_descriptors_are_received_without_external_execution(self):
        recorder = RecordingExecutor()
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["tools"] = {
            "enabled": True,
            "mode": "gateway",
            "descriptors": [{
                "toolId": "tool-1",
                "name": "lookup_policy",
                "description": "Look up a governed policy.",
                "riskLevel": "low",
                "approvalRequired": False,
                "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}},
                "gatewayRef": {"type": "orchestra_tool_gateway", "action": "mcp.tool.execute"},
            }],
        }
        with RunningServer(config(AGNO_RUNTIME_HTTP_TOOLS_ENABLED="true"), recorder) as server:
            status, response = server.request("/execute", payload=payload)

        self.assertEqual(status, 200)
        self.assertEqual(len(recorder.plans[0].spec["tools"]["descriptors"]), 1)
        self.assertEqual(response["output"]["metadata"]["toolDescriptorCount"], 1)
        self.assertEqual(response["output"]["metadata"]["toolCallsExecuted"], 0)
        self.assertFalse(response["output"]["metadata"]["externalMcpCalled"])
        self.assertNotIn("inputSchema", json.dumps(response))

    def test_gateway_supports_the_backend_16f_response_envelope(self):
        GatewayHandler.external_mcp_called = False
        gateway_server = ThreadingHTTPServer(("127.0.0.1", 0), GatewayHandler)
        gateway_thread = threading.Thread(target=gateway_server.serve_forever, daemon=True)
        gateway_thread.start()
        key = "phase-16h-gateway-placeholder"
        try:
            gateway_config = config(
                AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY="true",
                AGNO_RUNTIME_HTTP_SECURITY_KEY=key,
                AGNO_RUNTIME_HTTP_TOOLS_ENABLED="true",
                AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS="1",
                AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED="true",
                ORCHESTRA_TOOL_GATEWAY_URL=f"http://127.0.0.1:{gateway_server.server_port}/api/v1/runtime/agno/tool-calls",
            )
            spec = execute_payload()["assistantRuntimeSpec"]
            spec["policy"]["maxToolCalls"] = 1
            session = GatewaySession(gateway_config, spec)
            content = session.call({"toolId": "tool-1"}, {"query": "safe value"})
        finally:
            gateway_server.shutdown()
            gateway_server.server_close()
            gateway_thread.join(timeout=2)

        self.assertEqual(content, "Governed sandbox tool execution completed.")
        self.assertEqual(session.executed, 1)
        self.assertTrue(session.simulated)
        self.assertEqual(GatewayHandler.request_payload["runtimeTraceId"], "trace-bridge-test")
        self.assertEqual(GatewayHandler.request_payload["agentRunId"], "run-bridge-test")
        self.assertEqual(GatewayHandler.request_payload["assistantId"], "assistant-1")
        self.assertEqual(GatewayHandler.authorization, f"Bearer {key}")

    def test_gateway_accepts_only_governed_remote_readonly_metadata(self):
        GatewayHandler.external_mcp_called = True
        gateway_server = ThreadingHTTPServer(("127.0.0.1", 0), GatewayHandler)
        gateway_thread = threading.Thread(target=gateway_server.serve_forever, daemon=True)
        gateway_thread.start()
        try:
            gateway_config = config(
                AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY="true",
                AGNO_RUNTIME_HTTP_SECURITY_KEY="phase-16p-gateway-placeholder",
                AGNO_RUNTIME_HTTP_TOOLS_ENABLED="true",
                AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS="1",
                AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED="true",
                ORCHESTRA_TOOL_GATEWAY_URL=f"http://127.0.0.1:{gateway_server.server_port}/api/v1/runtime/agno/tool-calls",
            )
            spec = execute_payload()["assistantRuntimeSpec"]
            spec["policy"]["maxToolCalls"] = 1
            session = GatewaySession(gateway_config, spec)
            session.call({"toolId": "tool-1"}, {"query": "safe value"})
        finally:
            GatewayHandler.external_mcp_called = False
            gateway_server.shutdown()
            gateway_server.server_close()
            gateway_thread.join(timeout=2)

        self.assertTrue(session.external_mcp_called)
        self.assertTrue(session.gateway_metadata["mcpRemoteReadOnly"])
        self.assertEqual(session.gateway_metadata["mcpRemoteHost"], "mcp.example.test")

    def test_openai_assistant_model_compatibility_filters_specialized_families(self):
        eligible = [
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-0125",
            "gpt-4",
            "gpt-4-0613",
            "gpt-4-turbo",
            "gpt-4-turbo-2024-04-09",
            "gpt-4o-mini",
            "gpt-4o-2024-11-20",
            "gpt-4.1",
            "gpt-4.1-mini-2025-04-14",
            "gpt-5",
            "gpt-5.3-chat-latest",
            "gpt-5.6-luna",
            "gpt-5.6-terra",
            "gpt-5.6-sol",
            "o1",
            "o1-pro",
            "o3-mini",
            "o4-mini",
        ]

        specialized = [
            "babbage-002",
            "gpt-3.5-turbo-instruct",
            "davinci-002",
            "gpt-4o-mini-transcribe",
            "gpt-4o-mini-tts",
            "gpt-4o-search-preview",
            "gpt-5-codex",
            "gpt-5-search-api",
            "gpt-audio",
            "gpt-image-2",
            "gpt-realtime-2.1",
            "o4-mini-deep-research",
            "omni-moderation-latest",
            "sora-2",
            "text-embedding-3-small",
            "whisper-1",
        ]

        for model in eligible:
            with self.subTest(model=model):
                self.assertTrue(_is_openai_assistant_model(model))

        for model in specialized:
            with self.subTest(model=model):
                self.assertFalse(_is_openai_assistant_model(model))

    def test_openai_model_api_routes_general_models_to_responses_and_chat_aliases_to_chat(self):
        self.assertEqual(_openai_model_api("gpt-4o-mini"), "responses")
        self.assertEqual(_openai_model_api("gpt-4.1"), "responses")
        self.assertEqual(_openai_model_api("gpt-5.6-sol"), "responses")
        self.assertEqual(_openai_model_api("o3"), "responses")
        self.assertEqual(_openai_model_api("gpt-5.3-chat-latest"), "chat")

    def test_provider_discovery_catalog_excludes_specialized_openai_models(self):
        provider_payload = {
            "object": "list",
            "data": [
                {"id": "gpt-4o-mini", "object": "model"},
                {"id": "gpt-5.6-sol", "object": "model"},
                {"id": "gpt-image-2", "object": "model"},
                {"id": "gpt-realtime-2.1", "object": "model"},
                {"id": "text-embedding-3-small", "object": "model"},
                {"id": "sora-2", "object": "model"},
            ],
        }

        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            AGNO_BRIDGE_DEFAULT_MODEL="gpt-4o-mini",
            OPENAI_API_KEY="test-openai-discovery-key-never-sent",
        )

        with patch(
            "bridge.urlopen",
            return_value=BytesIO(json.dumps(provider_payload).encode("utf-8")),
        ):
            with RunningServer(real) as server:
                status, capabilities = server.request("/capabilities")

        self.assertEqual(status, 200)
        self.assertEqual(
            capabilities["modelCatalog"],
            {
                "provider": "openai",
                "models": ["gpt-4o-mini", "gpt-5.6-sol"],
                "defaultModel": "gpt-4o-mini",
            },
        )

    def test_real_openai_capabilities_expose_only_governed_model_catalog(self):
        api_key = "test-openai-key-never-sent"
        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_ALLOWED_MODELS="gpt-4o-mini",
            OPENAI_API_KEY=api_key,
        )

        with RunningServer(real) as server:
            status, capabilities = server.request("/capabilities")

        self.assertEqual(status, 200)
        self.assertTrue(capabilities["supportsExternalProviders"])
        self.assertEqual(
            capabilities["modelCatalog"],
            {
                "provider": "openai",
                "models": ["gpt-4o-mini"],
                "defaultModel": "gpt-4o-mini",
            },
        )
        self.assertNotIn(api_key, json.dumps(capabilities))

    def test_real_openai_without_allowed_models_omits_model_catalog(self):
        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            OPENAI_API_KEY="test-openai-key-never-sent",
        )

        with RunningServer(real) as server:
            status, capabilities = server.request("/capabilities")

        self.assertEqual(status, 200)
        self.assertTrue(capabilities["supportsExternalProviders"])
        self.assertNotIn("modelCatalog", capabilities)

    def test_provider_discovery_lists_available_openai_models_and_caches(self):
        api_key = "test-openai-discovery-key-never-sent"

        provider_payload = {
            "object": "list",
            "data": [
                {"id": "gpt-4o-mini", "object": "model"},
                {"id": "gpt-4.1", "object": "model"},
                {"id": "text-embedding-3-small", "object": "model"},
            ],
        }

        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            AGNO_BRIDGE_DEFAULT_MODEL="gpt-4o-mini",
            AGNO_BRIDGE_MODEL_DISCOVERY_CACHE_TTL_SECONDS="600",
            OPENAI_API_KEY=api_key,
        )

        fake_response = BytesIO(json.dumps(provider_payload).encode("utf-8"))

        with patch("bridge.urlopen", return_value=fake_response) as provider_request:
            with RunningServer(real) as server:
                first_status, first = server.request("/capabilities")
                second_status, second = server.request("/capabilities")

        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 200)
        self.assertEqual(first["modelCatalog"], {
            "provider": "openai",
            "models": [
                "gpt-4.1",
                "gpt-4o-mini",
            ],
            "defaultModel": "gpt-4o-mini",
        })
        self.assertEqual(second["modelCatalog"], first["modelCatalog"])
        self.assertEqual(provider_request.call_count, 1)

        request = provider_request.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.openai.com/v1/models")
        self.assertEqual(
            request.get_header("Authorization"),
            f"Bearer {api_key}",
        )
        self.assertNotIn(api_key, json.dumps(first))

    def test_provider_discovery_intersects_openai_models_with_governed_allowlist(self):
        provider_payload = {
            "object": "list",
            "data": [
                {"id": "gpt-4o-mini", "object": "model"},
                {"id": "gpt-4.1", "object": "model"},
                {"id": "text-embedding-3-small", "object": "model"},
            ],
        }

        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="gpt-4o-mini,gpt-4.1",
            AGNO_BRIDGE_DEFAULT_MODEL="gpt-4.1",
            OPENAI_API_KEY="test-openai-discovery-key-never-sent",
        )

        with patch(
            "bridge.urlopen",
            return_value=BytesIO(json.dumps(provider_payload).encode("utf-8")),
        ):
            with RunningServer(real) as server:
                status, capabilities = server.request("/capabilities")

        self.assertEqual(status, 200)
        self.assertEqual(capabilities["modelCatalog"], {
            "provider": "openai",
            "models": ["gpt-4o-mini", "gpt-4.1"],
            "defaultModel": "gpt-4.1",
        })

    def test_provider_discovery_failure_omits_model_catalog_fail_closed(self):
        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            OPENAI_API_KEY="test-openai-discovery-key-never-sent",
        )

        with patch("bridge.urlopen", side_effect=OSError("provider unavailable")):
            with RunningServer(real) as server:
                status, capabilities = server.request("/capabilities")

        self.assertEqual(status, 200)
        self.assertTrue(capabilities["supportsExternalProviders"])
        self.assertNotIn("modelCatalog", capabilities)

    def test_provider_discovery_allows_execution_only_for_discovered_model(self):
        provider_payload = {
            "object": "list",
            "data": [
                {"id": "gpt-4o-mini", "object": "model"},
                {"id": "gpt-4.1", "object": "model"},
            ],
        }

        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            AGNO_BRIDGE_DEFAULT_MODEL="gpt-4o-mini",
            OPENAI_API_KEY="test-openai-discovery-key-never-sent",
        )

        executor = RecordingExecutor()
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["model"] = {
            "provider": "openai",
            "model": "gpt-4o-mini",
        }

        with patch(
            "bridge.urlopen",
            return_value=BytesIO(json.dumps(provider_payload).encode("utf-8")),
        ):
            with RunningServer(real, executor) as server:
                status, response = server.request("/execute", payload=payload)

        self.assertEqual(status, 200)
        self.assertEqual(response["status"], "succeeded")
        self.assertEqual(len(executor.plans), 1)
        self.assertEqual(executor.plans[0].provider, "openai")
        self.assertEqual(executor.plans[0].model, "gpt-4o-mini")

    def test_provider_discovery_blocks_execution_for_model_not_in_effective_catalog(self):
        provider_payload = {
            "object": "list",
            "data": [
                {"id": "gpt-4o-mini", "object": "model"},
            ],
        }

        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="provider",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            AGNO_BRIDGE_DEFAULT_MODEL="gpt-4o-mini",
            OPENAI_API_KEY="test-openai-discovery-key-never-sent",
        )

        executor = RecordingExecutor()
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["model"] = {
            "provider": "openai",
            "model": "gpt-not-returned-by-provider",
        }

        with patch(
            "bridge.urlopen",
            return_value=BytesIO(json.dumps(provider_payload).encode("utf-8")),
        ):
            with RunningServer(real, executor) as server:
                status, response = server.request("/execute", payload=payload)

        self.assertEqual(status, 403)
        self.assertEqual(response["status"], "blocked")
        self.assertEqual(response["error"]["code"], "RUNTIME_POLICY_BLOCKED")
        self.assertEqual(len(executor.plans), 0)

    def test_real_static_mode_without_governed_models_blocks_execution(self):
        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
            AGNO_BRIDGE_MODEL_DISCOVERY="static",
            AGNO_BRIDGE_ALLOWED_MODELS="",
            OPENAI_API_KEY="test-openai-key-never-sent",
        )

        executor = RecordingExecutor()
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["model"] = {
            "provider": "openai",
            "model": "arbitrary-model",
        }

        with RunningServer(real, executor) as server:
            status, response = server.request("/execute", payload=payload)

        self.assertEqual(status, 403)
        self.assertEqual(response["status"], "blocked")
        self.assertEqual(response["error"]["code"], "RUNTIME_POLICY_BLOCKED")
        self.assertEqual(len(executor.plans), 0)

    def test_real_mode_without_provider_key_is_misconfigured_and_fails_closed(self):
        real = config(
            AGNO_BRIDGE_EXECUTION_MODE="real",
            AGNO_BRIDGE_PROVIDER="openai",
        )
        payload = execute_payload()
        payload["assistantRuntimeSpec"]["model"] = {"provider": "openai", "model": "approved-model"}
        with RunningServer(real) as server:
            _, health = server.request("/health")
            _, capabilities = server.request("/capabilities")
            status, response = server.request("/execute", payload=payload)

        self.assertEqual(health["status"], "misconfigured")
        self.assertFalse(capabilities["supportsExternalProviders"])
        self.assertNotIn("modelCatalog", capabilities)
        self.assertEqual(status, 502)
        self.assertEqual(response["error"]["code"], "RUNTIME_PROVIDER_FAILED")
        self.assertTrue(response["error"]["details"]["failedClosed"])

    def test_required_transport_auth_without_key_is_rejected_at_startup(self):
        with self.assertRaises(BridgeConfigurationError):
            config(AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY="true")


if __name__ == "__main__":
    unittest.main()
