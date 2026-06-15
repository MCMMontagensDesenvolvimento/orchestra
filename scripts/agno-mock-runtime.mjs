#!/usr/bin/env node
import http from 'node:http';
import { createHash } from 'node:crypto';

const port = Number(process.env.AGNO_MOCK_PORT ?? 7777);
const host = process.env.AGNO_MOCK_HOST ?? '127.0.0.1';
const delayMs = Number(process.env.AGNO_MOCK_DELAY_MS ?? 0);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('request_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = http.createServer(async (req, res) => {
  try {
    if (delayMs > 0) await wait(delayMs);

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, {
        status: 'healthy',
        provider: 'agno',
        version: 'mock-local',
        capabilities: {
          textGeneration: true,
          ragContext: true,
          toolDescriptors: true,
          traceEvents: true,
        },
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/capabilities') {
      sendJson(res, 200, {
        provider: 'agno',
        supportsTextGeneration: true,
        supportsStreaming: false,
        supportsRagContext: true,
        supportsMcpTools: false,
        supportsToolCalling: false,
        supportsCitations: true,
        supportsTraceEvents: true,
        supportsSandbox: true,
        supportsExternalProviders: false,
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/runs') {
      const payload = await readJson(req);
      const inputPreview = String(payload?.input?.preview ?? payload?.input?.text ?? '').slice(0, 160);
      const ragSources = Array.isArray(payload?.ragContext?.sources) ? payload.ragContext.sources.length : 0;
      const mcpTools = Array.isArray(payload?.mcpContext?.tools) ? payload.mcpContext.tools.length : 0;
      const outputText = `Resposta deterministica do Agno mock local para "${inputPreview}". RAG sources=${ragSources}; MCP descriptors=${mcpTools}.`;
      sendJson(res, 200, {
        status: 'completed',
        output: {
          text: outputText,
          preview: outputText,
          hash: createHash('sha256').update(outputText).digest('hex'),
        },
        events: [
          {
            type: 'model_started',
            status: 'running',
            message: 'Mock model execution started.',
            metadata: { localRuntime: true },
          },
          {
            type: 'model_completed',
            status: 'completed',
            message: 'Mock model execution completed.',
            metadata: { localRuntime: true },
          },
        ],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        metadata: {
          provider: 'agno',
          localRuntime: true,
          mockRuntime: true,
        },
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'request_failed',
    });
  }
});

server.listen(port, host, () => {
  console.log(`Agno mock runtime listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
