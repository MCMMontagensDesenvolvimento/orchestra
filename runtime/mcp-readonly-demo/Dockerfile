FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json catalog.js server.js ./

ENV NODE_ENV=production \
    MCP_READONLY_DEMO_HOST=0.0.0.0 \
    MCP_READONLY_DEMO_PORT=8092 \
    MCP_READONLY_DEMO_MAX_PAYLOAD_BYTES=8192 \
    MCP_READONLY_DEMO_REQUEST_TIMEOUT_MS=5000

USER node
EXPOSE 8092
CMD ["node", "server.js"]
