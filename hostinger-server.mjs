import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import worker from './dist/server/index.js';

const root = resolve(fileURLToPath(new URL('./dist/client/', import.meta.url)));
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const assets = {
  async fetch(request) {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = resolve(root, relativePath);
    const insideRoot = filePath === root || filePath.startsWith(`${root}${sep}`);

    if (!insideRoot || !existsSync(filePath) || !statSync(filePath).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers({
      'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    });

    if (relativePath.startsWith('_next/static/')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return new Response(Readable.toWeb(createReadStream(filePath)), { headers });
  },
};

function requestHeaders(rawHeaders) {
  const headers = new Headers();
  for (let index = 0; index < rawHeaders.length; index += 2) {
    headers.append(rawHeaders[index], rawHeaders[index + 1]);
  }
  return headers;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = requestHeaders(incoming.rawHeaders);
    const forwardedProtocol = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const protocol = forwardedProtocol || 'http';
    const host = forwardedHost || headers.get('host') || `localhost:${port}`;
    const url = new URL(incoming.url || '/', `${protocol}://${host}`);
    const method = incoming.method || 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';

    const request = new Request(url, {
      method,
      headers,
      body: hasBody ? Readable.toWeb(incoming) : undefined,
      duplex: hasBody ? 'half' : undefined,
    });

    // Hostinger does not provide Cloudflare's static-asset binding at runtime.
    // Serve the generated client files directly before handing application
    // routes to the Vinext worker so CSS, JavaScript, fonts, and images load.
    const staticResponse = method === 'GET' || method === 'HEAD'
      ? await assets.fetch(request)
      : null;

    const response = staticResponse && staticResponse.status !== 404
      ? staticResponse
      : await worker.fetch(
          request,
          { ...process.env, ASSETS: assets },
          {
            passThroughOnException() {},
            waitUntil(promise) {
              Promise.resolve(promise).catch(console.error);
            },
          },
        );

    outgoing.statusCode = response.status;
    outgoing.statusMessage = response.statusText;
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie') outgoing.setHeader(name, value);
    });

    const cookies = response.headers.getSetCookie?.() || [];
    if (cookies.length) outgoing.setHeader('set-cookie', cookies);

    if (!response.body || method === 'HEAD') {
      outgoing.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) {
      outgoing.statusCode = 500;
      outgoing.setHeader('content-type', 'text/plain; charset=utf-8');
    }
    outgoing.end('Internal server error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Sahaan is listening on port ${port}`);
});
