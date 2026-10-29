const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const httpProxy = require('http-proxy');

const allowedIPs = new Set([
  '76.187.32.107',
  '12.245.211.196',
  '172.56.189.25',
  '146.75.164.220',
  '12.245.211.196',
'12.245.211.197',
'12.245.211.198',
'12.245.211.199',
  '170.85.102.255',
  '170.85.103.27',
  '99.42.217.8'
]);

const publicPort = Number(process.env.PORT || 10000);
const internalPort = 5680;
const publicHost = 'integration.advantismed.com';

if (publicPort === internalPort) {
  throw new Error('PORT must differ from the internal n8n port.');
}

const child = spawn('/docker-entrypoint.sh', ['start'], {
  stdio: 'inherit',
  detached: true,
  env: {
    ...process.env,
    N8N_LISTEN_ADDRESS: '127.0.0.1',
    N8N_PORT: String(internalPort),
    N8N_PROXY_HOPS: '1',
    N8N_HOST: publicHost,
    N8N_PROTOCOL: 'https',
    N8N_EDITOR_BASE_URL: `https://${publicHost}/`,
    N8N_WEBHOOK_URL: `https://${publicHost}/`,
    WEBHOOK_URL: `https://${publicHost}/`,
  },
});

const proxy = httpProxy.createProxyServer({
  target: `http://127.0.0.1:${internalPort}`,
  ws: true,
  xfwd: false,
});

function visitorIP(req) {
  const value = req.headers['cf-connecting-ip'];

  // Missing or malformed headers never grant editor access.
  return typeof value === 'string' && net.isIP(value.trim())
    ? value.trim()
    : '';
}

function rawPath(req) {
  return (req.url || '').split('?')[0];
}

function publicRoute(req) {
  const path = rawPath(req);

  // Avoid encoded or normalized paths bypassing route restrictions.
  if (
    !path.startsWith('/') ||
    /[%\\]/.test(path) ||
    path.split('/').some(part => part === '.' || part === '..')
  ) {
    return false;
  }

  return (
    path.startsWith('/webhook/') ||
    path.startsWith('/api/v1/')
  );
}

function prepareHeaders(req, ip) {
  // Give n8n one sanitized forwarding hop.
  delete req.headers.forwarded;
  req.headers['x-forwarded-for'] = ip || '0.0.0.0';
  req.headers['x-forwarded-host'] = publicHost;
  req.headers['x-forwarded-proto'] = 'https';
}

const server = http.createServer((req, res) => {
  const ip = visitorIP(req);
  const adminAllowed = allowedIPs.has(ip);

  // Let Render check n8n's readiness through the proxy.
  const healthCheck =
    rawPath(req) === '/healthz/readiness' &&
    (req.method === 'GET' || req.method === 'HEAD');

  if (!adminAllowed && !publicRoute(req) && !healthCheck) {
    res.writeHead(403, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    });
    res.end('Forbidden');
    return;
  }

  prepareHeaders(req, ip);
  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const ip = visitorIP(req);

  // Editor WebSocket access follows the same IP restriction.
  if (!allowedIPs.has(ip)) {
    socket.end(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    return;
  }

  prepareHeaders(req, ip);
  proxy.ws(req, socket, head);
});

proxy.on('error', (error, req, output) => {
  console.error('Proxy error:', error.code || error.message);

  if (typeof output.writeHead === 'function') {
    if (!output.headersSent) {
      output.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    output.end('n8n temporarily unavailable');
  } else {
    output.destroy();
  }
});

let stopping = false;

function stop(signal = 'SIGTERM', exitCode = 0) {
  if (stopping) return;
  stopping = true;

  server.close();

  if (child.pid) {
    try {
      process.kill(-child.pid, signal);
    } catch {}
  }

  setTimeout(() => {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    process.exit(exitCode);
  }, 20000).unref();
}

process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop('SIGINT'));

child.on('error', error => {
  console.error('Could not start n8n:', error.message);
  stop('SIGTERM', 1);
});

child.on('exit', code => {
  if (stopping) process.exit(code || 0);
  console.error('n8n exited unexpectedly:', code);
  stop('SIGTERM', code || 1);
});

server.on('error', error => {
  console.error('Proxy listener failed:', error.message);
  stop('SIGTERM', 1);
});

server.listen(publicPort, '0.0.0.0', () => {
  console.log(`Access proxy listening on ${publicPort}`);
});
