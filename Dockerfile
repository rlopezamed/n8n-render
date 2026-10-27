FROM n8nio/n8n:2.43.8

USER root

RUN mkdir -p /home/node/.n8n/nodes /opt/access-proxy \
    && chown -R node:node /home/node/.n8n /opt/access-proxy

USER node
WORKDIR /home/node/.n8n/nodes

RUN cat > package.json <<'JSON'
{
  "name": "n8n-custom-nodes",
  "private": true,
  "dependencies": {
    "n8n-nodes-browserless": "1.1.3",
    "n8n-nodes-docling-serve": "0.0.5",
    "n8n-nodes-pdf-lib": "0.1.6",
    "n8n-nodes-pdfco": "1.0.6"
  }
}
JSON

RUN npm install --omit=dev --legacy-peer-deps

WORKDIR /opt/access-proxy

RUN npm init -y \
    && npm install --omit=dev --save-exact http-proxy@1.18.1

COPY --chown=node:node access-proxy.cjs /opt/access-proxy/access-proxy.cjs

WORKDIR /home/node/.n8n/nodes

ENTRYPOINT ["node", "/opt/access-proxy/access-proxy.cjs"]
CMD []
