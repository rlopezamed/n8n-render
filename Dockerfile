FROM n8nio/n8n:latest

USER root

RUN npm install -g \
  n8n-nodes-browserless \
  n8n-nodes-docling-serve \
  n8n-nodes-pdf-lib \
  n8n-nodes-pdfco

USER node
