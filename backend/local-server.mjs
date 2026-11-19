/**
 * File: backend/local-server.mjs
 * Purpose: Zero-dependency Node.js local development server that loads .env
 *          from the project root, simulates Amazon API Gateway events, and
 *          invokes the AWS Lambda handler in backend/index.mjs.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from './index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

/**
 * Loads environment variables from the root .env file using built-in fs
 * without logging or exposing sensitive keys.
 */
function loadDotEnv(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return false;
  }

  const content = fs.readFileSync(envFilePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Strip surrounding single or double quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

loadDotEnv(ENV_PATH);

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
    const pathname = parsedUrl.pathname;

    // 1. Health check endpoint
    if (pathname === '/health') {
      const hasKey = Boolean(
        process.env.OPENWEATHER_API_KEY &&
          process.env.OPENWEATHER_API_KEY !== 'your_openweather_api_key_here'
      );
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'weather-dashboard-local-lambda-proxy',
          apiKeyConfigured: hasKey,
          nodeVersion: process.version,
        })
      );
      return;
    }

    // 2. API Gateway simulation routes (/weather and /api/weather)
    if (pathname === '/weather' || pathname === '/api/weather') {
      const queryStringParameters = {};
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        queryStringParameters[key] = value;
      }

      const lambdaEvent = {
        version: '2.0',
        routeKey: `${req.method} ${pathname}`,
        rawPath: pathname,
        rawQueryString: parsedUrl.search.slice(1),
        headers: req.headers,
        queryStringParameters,
        httpMethod: req.method,
        requestContext: {
          http: {
            method: req.method,
            path: pathname,
            sourceIp: req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || '',
          },
        },
      };

      const lambdaResult = await handler(lambdaEvent);

      res.writeHead(lambdaResult.statusCode || 200, lambdaResult.headers || {});
      res.end(lambdaResult.body || '');
      return;
    }

    // 3. Optional static file serving for frontend/ directory during local development
    let relativePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(FRONTEND_DIR, safePath);

    if (filePath.startsWith(FRONTEND_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 4. Fallback 404 JSON response
    res.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        error: `Route ${pathname} not found. Use GET /weather?city=Jammu`,
        code: 'ROUTE_NOT_FOUND',
      })
    );
  } catch (err) {
    res.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        error: 'Unexpected local server error.',
        code: 'LOCAL_SERVER_ERROR',
      })
    );
  }
});

server.listen(PORT, () => {
  const hasKey = Boolean(
    process.env.OPENWEATHER_API_KEY &&
      process.env.OPENWEATHER_API_KEY !== 'your_openweather_api_key_here'
  );
  console.log(`============================================================`);
  console.log(` Local AWS Lambda Weather Server running on port ${PORT}`);
  console.log(` Node.js Runtime : ${process.version}`);
  console.log(` API Key Loaded  : ${hasKey ? 'YES (hidden)' : 'NO (check .env)'}`);
  console.log(` Test Endpoint   : http://localhost:${PORT}/weather?city=Jammu`);
  console.log(` Frontend Preview: http://localhost:${PORT}/`);
  console.log(`============================================================`);
});
