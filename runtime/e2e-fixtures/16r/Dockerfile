FROM node:22-alpine

WORKDIR /app

COPY package.json runtime-proxy.mjs ./

USER node
EXPOSE 8093

CMD ["node", "runtime-proxy.mjs"]
