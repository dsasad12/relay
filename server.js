const express = require('express');
const app     = express();
app.use(express.json());

const lobbies    = {};
const MAX_PLAYERS = 4;
const CODE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket.remoteAddress
      || '0.0.0.0';
}

setInterval(() => {
  const now = Date.now();
  for (const code in lobbies)
    if (now - lobbies[code].created > CODE_TTL_MS)
      delete lobbies[code];
}, 10 * 60 * 1000);

// POST /create  →  { code }
// Body opcional: { hostIp } para cuando el host quiere especificar su IP
app.post('/create', (req, res) => {
  const hostIp = req.body?.hostIp || getClientIp(req);
  let code;
  do { code = genCode(); } while (lobbies[code]);

  lobbies[code] = { hostIp, members: 1, max: MAX_PLAYERS, created: Date.now() };
  console.log(`[${new Date().toISOString()}] Lobby creado: ${code} host=${hostIp}`);
  res.json({ code, hostIp });
});

// POST /join/:code  →  { ok, hostIp, members, max }
app.post('/join/:code', (req, res) => {
  const code  = req.params.code.toUpperCase();
  const lobby = lobbies[code];

  if (!lobby)                     return res.json({ ok: false, error: 'Código inválido' });
  if (lobby.members >= lobby.max) return res.json({ ok: false, error: 'Lobby lleno' });

  lobby.members++;
  console.log(`[${new Date().toISOString()}] Join: ${code} (${lobby.members}/${lobby.max})`);
  res.json({ ok: true, hostIp: lobby.hostIp, members: lobby.members, max: lobby.max });
});

// GET /lobby/:code  →  { members, max, hostIp }
app.get('/lobby/:code', (req, res) => {
  const lobby = lobbies[req.params.code.toUpperCase()];
  if (!lobby) return res.json({ members: 0, max: MAX_PLAYERS });
  res.json({ members: lobby.members, max: lobby.max, hostIp: lobby.hostIp });
});

// DELETE /lobby/:code
app.delete('/lobby/:code', (req, res) => {
  delete lobbies[req.params.code.toUpperCase()];
  res.json({ ok: true });
});

// GET /myip  →  { ip } — el launcher lo usa para saber la IP pública del host
app.get('/myip', (req, res) => {
  res.json({ ip: getClientIp(req) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PCBSCoop relay en puerto ${PORT}`));
