import { createAgnoRuntimeHttpApp } from './agno-runtime-http.app';

const defaultHost = '127.0.0.1';
const defaultPort = 8091;

const host = process.env.AGNO_RUNTIME_HTTP_HOST?.trim() || defaultHost;
const port = parsePort(process.env.AGNO_RUNTIME_HTTP_PORT, defaultPort);
const app = createAgnoRuntimeHttpApp();

const server = app.listen(port, host, () => {
  process.stdout.write(`Agno-compatible runtime contract service listening on http://${host}:${port}\n`);
});

function shutdown(signal: string) {
  process.stdout.write(`Agno-compatible runtime contract service shutting down after ${signal}\n`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

function parsePort(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}
