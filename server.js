// Простой сервер для доски нарядов. Никаких установок не требует —
// работает на чистом Node.js (встроенный модуль http).
// Запуск:  node server.js
// Хранит одно состояние (весь JSON доски) в файле data/state.json.
// Два маршрута: GET /api/state (прочитать), POST /api/state (сохранить).

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, obj){
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    const LIMIT = 2 * 1024 * 1024; // 2 MB safety cap
    req.on('data', (c) => {
      size += c.length;
      if (size > LIMIT) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/state' && req.method === 'GET') {
    try {
      if (!fs.existsSync(DATA_FILE)) return sendJson(res, 200, { exists: false });
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return sendJson(res, 200, { exists: true, data: JSON.parse(raw) });
    } catch (e) {
      return sendJson(res, 500, { error: 'read_failed' });
    }
  }

  if (req.url === '/api/state' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      // Пишем во временный файл и переименовываем — атомарная запись,
      // чтобы никто не прочитал наполовину сохранённый файл.
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, DATA_FILE);
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { error: 'write_failed' });
    }
  }

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Сервер доски нарядов работает. Используйте /api/state');
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Сервер доски нарядов запущен на порту ' + PORT));
