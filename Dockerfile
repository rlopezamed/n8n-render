FROM n8nio/n8n:latest

USER root

# Create a dedicated folder for custom/community nodes
RUN mkdir -p /home/node/.n8n/nodes && chown -R node:node /home/node/.n8n

USER node
WORKDIR /home/node/.n8n/nodes

# Create a tiny package.json with your community nodes
RUN cat > package.json <<'JSON'
{
  "name": "n8n-custom-nodes",
  "private": true,
  "dependencies": {
    "n8n-nodes-browserless": "1.1.3",
    "n8n-nodes-docling-serve": "0.0.2",
    "n8n-nodes-pdf-lib": "0.1.6",
    "n8n-nodes-pdfco": "1.0.6"
  }
}
JSON

# Install with pnpm (required by some community nodes)
RUN pnpm install --prod
