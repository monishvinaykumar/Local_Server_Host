const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

const PORT = process.env.PORT || 5555;
const DATA_FILE = path.join(__dirname, 'projects.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'hub.log');

// MIME types for static server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

// In-memory runtime state for projects
// id -> { status, process, staticServer, logs: [], port }
const runtime = new Map();
// SSE subscriber clients
const sseClients = new Set();

// Load projects from file
function loadProjects() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading projects.json:', err.message);
  }
  return [];
}

// Save projects to file
function saveProjects(projects) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving projects.json:', err.message);
  }
}

// Broadcast SSE event to all connected dashboard tabs
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Append log to project runtime
function appendLog(projectId, text) {
  const r = runtime.get(projectId);
  if (!r) return;
  const timestamp = new Date().toLocaleTimeString();
  const line = `[${timestamp}] ${text}`;
  r.logs.push(line);
  if (r.logs.length > 300) r.logs.shift();
  broadcast('log', { projectId, line });
}

// Open URL in default browser (Windows)
function openBrowser(url) {
  if (process.platform === 'win32') {
    exec(`cmd.exe /c start "" "${url}"`, (err) => {
      if (err) console.error('Failed to open browser:', err);
    });
  } else {
    exec(`xdg-open "${url}" || open "${url}"`, () => {});
  }
}

// Kill process tree on Windows
function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${pid} /T /F`, () => resolve());
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try { process.kill(pid, 'SIGKILL'); } catch {}
      }
      resolve();
    }
  });
}

// Create built-in static file server for a project
function createStaticServer(project) {
  const server = http.createServer((req, res) => {
    let reqUrl = decodeURI(req.url.split('?')[0]);
    if (reqUrl === '/') reqUrl = '/index.html';

    const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(project.path, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Try fallback to index.html for SPA routing if available
        const indexPath = path.join(project.path, 'index.html');
        if (fs.existsSync(indexPath)) {
          filePath = indexPath;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });

      fs.createReadStream(filePath).pipe(res);
    });
  });

  return server;
}

// Start a project
async function startProject(projectId, triggerBrowser = true) {
  const projects = loadProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error('Project not found');

  let r = runtime.get(projectId);
  if (!r) {
    r = { status: 'stopped', process: null, staticServer: null, logs: [], port: project.port };
    runtime.set(projectId, r);
  }

  if (r.status === 'running' || r.status === 'starting') {
    return { ok: true, alreadyRunning: true };
  }

  r.status = 'starting';
  appendLog(projectId, `Starting "${project.name}"...`);
  broadcast('status', { projectId, status: 'starting', port: project.port });

  const targetUrl = `http://localhost:${project.port}`;

  if (project.type === 'static') {
    // Built-in static server
    return new Promise((resolve, reject) => {
      const server = createStaticServer(project);
      server.listen(project.port, () => {
        r.staticServer = server;
        r.status = 'running';
        r.port = project.port;
        appendLog(projectId, `Serving static folder on ${targetUrl}`);
        broadcast('status', { projectId, status: 'running', port: project.port });

        if (triggerBrowser) {
          setTimeout(() => openBrowser(targetUrl), 400);
        }
        resolve({ ok: true, url: targetUrl });
      });

      server.on('error', (err) => {
        r.status = 'error';
        appendLog(projectId, `Server error: ${err.message}`);
        broadcast('status', { projectId, status: 'error', port: project.port });
        reject(err);
      });
    });
  } else {
    // Command runner
    return new Promise((resolve) => {
      const command = project.command || 'npm run dev';
      appendLog(projectId, `Running command: "${command}" in ${project.path}`);

      const child = spawn(command, {
        cwd: project.path,
        shell: true,
        env: { ...process.env, PORT: String(project.port) },
      });

      r.process = child;
      r.status = 'running';
      r.port = project.port;

      child.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) appendLog(projectId, text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) appendLog(projectId, `[ERR] ${text}`);
      });

      child.on('close', (code) => {
        r.status = 'stopped';
        r.process = null;
        appendLog(projectId, `Process exited with code ${code}`);
        broadcast('status', { projectId, status: 'stopped', port: project.port });
      });

      child.on('error', (err) => {
        r.status = 'error';
        appendLog(projectId, `Failed to start process: ${err.message}`);
        broadcast('status', { projectId, status: 'error', port: project.port });
      });

      broadcast('status', { projectId, status: 'running', port: project.port });

      if (triggerBrowser && project.port) {
        setTimeout(() => openBrowser(targetUrl), 2000);
      }

      resolve({ ok: true, url: targetUrl });
    });
  }
}

// Stop a project
async function stopProject(projectId) {
  const r = runtime.get(projectId);
  if (!r || r.status === 'stopped') {
    return { ok: true, alreadyStopped: true };
  }

  appendLog(projectId, `Stopping project...`);

  if (r.staticServer) {
    await new Promise((res) => r.staticServer.close(() => res()));
    r.staticServer = null;
  }

  if (r.process && r.process.pid) {
    await killProcessTree(r.process.pid);
    r.process = null;
  }

  r.status = 'stopped';
  appendLog(projectId, `Stopped successfully.`);
  broadcast('status', { projectId, status: 'stopped', port: r.port });
  return { ok: true };
}

// Helper to scan directory for projects
function scanDirectory(baseDir) {
  const results = [];
  try {
    if (!fs.existsSync(baseDir)) return results;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    let portCounter = 3001;
    const existing = loadProjects();
    const usedPorts = new Set(existing.map((p) => Number(p.port)));

    const getNextPort = () => {
      while (usedPorts.has(portCounter) || portCounter === PORT) {
        portCounter++;
      }
      usedPorts.add(portCounter);
      return portCounter;
    };

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['node_modules', '.git', 'dev-hub', '$RECYCLE.BIN'].includes(entry.name)) continue;

      const fullPath = path.join(baseDir, entry.name);
      const pkgPath = path.join(fullPath, 'package.json');
      const indexPath = path.join(fullPath, 'index.html');
      const pyApp = path.join(fullPath, 'app.py');
      const pyMain = path.join(fullPath, 'main.py');

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          const scripts = pkg.scripts || {};
          let cmd = 'npm start';
          if (scripts.dev) cmd = 'npm run dev';
          else if (scripts.start) cmd = 'npm start';
          else if (Object.keys(scripts)[0]) cmd = `npm run ${Object.keys(scripts)[0]}`;

          results.push({
            name: pkg.name || entry.name,
            path: fullPath,
            type: 'command',
            command: cmd,
            port: getNextPort(),
            autoOpen: true,
          });
        } catch {
          // fallback
          results.push({
            name: entry.name,
            path: fullPath,
            type: 'command',
            command: 'npm run dev',
            port: getNextPort(),
            autoOpen: true,
          });
        }
      } else if (fs.existsSync(indexPath)) {
        results.push({
          name: entry.name,
          path: fullPath,
          type: 'static',
          command: '',
          port: getNextPort(),
          autoOpen: true,
        });
      } else if (fs.existsSync(pyApp)) {
        results.push({
          name: entry.name,
          path: fullPath,
          type: 'command',
          command: 'python app.py',
          port: getNextPort(),
          autoOpen: true,
        });
      } else if (fs.existsSync(pyMain)) {
        results.push({
          name: entry.name,
          path: fullPath,
          type: 'command',
          command: 'python main.py',
          port: getNextPort(),
          autoOpen: true,
        });
      }
    }
  } catch (err) {
    console.error('Scan error:', err);
  }
  return results;
}

// Request handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // JSON helper
  const sendJson = (data, code = 200) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  };

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // SSE Stream
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Parse JSON Body
  let body = {};
  if (['POST', 'PUT'].includes(method)) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      if (raw) body = JSON.parse(raw);
    } catch (e) {
      return sendJson({ error: 'Invalid JSON body' }, 400);
    }
  }

  // API Routes
  if (pathname === '/api/projects' && method === 'GET') {
    const projects = loadProjects();
    const enriched = projects.map((p) => {
      const r = runtime.get(p.id) || { status: 'stopped', logs: [], port: p.port };
      return {
        ...p,
        status: r.status,
        logs: r.logs,
      };
    });
    return sendJson(enriched);
  }

  if (pathname === '/api/projects' && method === 'POST') {
    const projects = loadProjects();
    const newProj = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: body.name || 'Unnamed Project',
      category: body.category || 'General',
      path: body.path || '',
      type: body.type || 'static',
      command: body.command || '',
      port: Number(body.port) || 3000,
      autoOpen: body.autoOpen !== false,
    };
    projects.push(newProj);
    saveProjects(projects);
    return sendJson(newProj, 201);
  }

  if (pathname.startsWith('/api/projects/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const projects = loadProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return sendJson({ error: 'Project not found' }, 404);

    projects[index] = {
      ...projects[index],
      name: body.name !== undefined ? body.name : projects[index].name,
      category: body.category !== undefined ? body.category : projects[index].category,
      path: body.path !== undefined ? body.path : projects[index].path,
      type: body.type !== undefined ? body.type : projects[index].type,
      command: body.command !== undefined ? body.command : projects[index].command,
      port: body.port !== undefined ? Number(body.port) : projects[index].port,
      autoOpen: body.autoOpen !== undefined ? body.autoOpen : projects[index].autoOpen,
    };
    saveProjects(projects);
    return sendJson(projects[index]);
  }

  if (pathname.startsWith('/api/projects/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    await stopProject(id);
    let projects = loadProjects();
    projects = projects.filter((p) => p.id !== id);
    saveProjects(projects);
    runtime.delete(id);
    return sendJson({ ok: true });
  }

  if (pathname.match(/^\/api\/projects\/[^/]+\/start$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    try {
      const openBrowserOnStart = body.openBrowser !== false;
      const resData = await startProject(id, openBrowserOnStart);
      return sendJson(resData);
    } catch (err) {
      return sendJson({ error: err.message }, 500);
    }
  }

  if (pathname.match(/^\/api\/projects\/[^/]+\/stop$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    try {
      const resData = await stopProject(id);
      return sendJson(resData);
    } catch (err) {
      return sendJson({ error: err.message }, 500);
    }
  }

  if (pathname.match(/^\/api\/projects\/[^/]+\/open$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const projects = loadProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) return sendJson({ error: 'Project not found' }, 404);
    openBrowser(`http://localhost:${project.port}`);
    return sendJson({ ok: true });
  }

  if (pathname.match(/^\/api\/projects\/[^/]+\/open-folder$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const projects = loadProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) return sendJson({ error: 'Project not found' }, 404);
    exec(`explorer "${project.path}"`);
    return sendJson({ ok: true });
  }

  if (pathname.match(/^\/api\/projects\/[^/]+\/open-vscode$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const projects = loadProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) return sendJson({ error: 'Project not found' }, 404);
    exec(`code "${project.path}"`);
    return sendJson({ ok: true });
  }

  if (pathname === '/api/start-all' && method === 'POST') {
    const projects = loadProjects();
    for (const p of projects) {
      try {
        await startProject(p.id, false);
      } catch (err) {
        console.error(`Failed to start ${p.name}:`, err.message);
      }
    }
    return sendJson({ ok: true });
  }

  if (pathname === '/api/stop-all' && method === 'POST') {
    const projects = loadProjects();
    for (const p of projects) {
      await stopProject(p.id);
    }
    return sendJson({ ok: true });
  }

  if (pathname === '/api/scan' && method === 'POST') {
    const targetDir = body.directory || path.resolve(__dirname, '..');
    const detected = scanDirectory(targetDir);
    return sendJson({ directory: targetDir, detected });
  }

  if (pathname === '/api/import-batch' && method === 'POST') {
    const toImport = body.projects || [];
    const projects = loadProjects();
    const existingPaths = new Set(projects.map((p) => path.normalize(p.path.toLowerCase())));

    let addedCount = 0;
    for (const item of toImport) {
      const norm = path.normalize(item.path.toLowerCase());
      if (!existingPaths.has(norm)) {
        projects.push({
          id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: item.name,
          path: item.path,
          type: item.type || 'static',
          command: item.command || '',
          port: Number(item.port) || 3000,
          autoOpen: true,
        });
        existingPaths.add(norm);
        addedCount++;
      }
    }
    saveProjects(projects);
    return sendJson({ ok: true, addedCount });
  }

  // Static files from /public
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safeStatic = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safeStatic);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Graceful exit handler
function cleanup() {
  console.log('\nShutting down DevHub and stopping active child processes...');
  for (const [id, r] of runtime.entries()) {
    if (r.staticServer) r.staticServer.close();
    if (r.process && r.process.pid) {
      killProcessTree(r.process.pid);
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const msg = `[${new Date().toLocaleString()}] DevHub is already running on port ${PORT}.`;
    console.log(msg);
    try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch (e) {}
    process.exit(0);
  }
  const errLog = `[${new Date().toLocaleString()}] DevHub server error: ${err.message}`;
  console.error(errLog);
  try { fs.appendFileSync(LOG_FILE, errLog + '\n'); } catch (e) {}
  process.exit(1);
});

server.listen(PORT, () => {
  const startupMsg = [
    `===============================================`,
    `  🚀 Local Dev Hub is running on port ${PORT}`,
    `  👉 Dashboard URL: http://localhost:${PORT}`,
    `  Started at: ${new Date().toLocaleString()}`,
    `===============================================`
  ].join('\n');
  console.log(startupMsg);
  try {
    fs.writeFileSync(LOG_FILE, startupMsg + '\n');
  } catch (e) {}
});
