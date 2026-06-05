FROM n8nio/n8n:latest

USER root

RUN mkdir -p /home/node/.n8n/nodes && chown -R node:node /home/node/.n8n

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
  },
  "pnpm": {
    "dangerouslyAllowAllBuilds": true
  }
}
JSON

RUN pnpm install --prod --config.dangerouslyAllowAllBuilds=true
