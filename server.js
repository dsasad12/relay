const express = require('express');
const app     = express();
app.use(express.json());

// lobbies[code] = { hostIp, members, max, created }
const lobbies = {};
const MAX_PLAYERS = 4;
const CODE_TTL_MS = 60 * 60 * 1000; // 1 hora

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Limpiar lobbies expirados cada 10 min
setInterval(() => {
  const now = Date.now();
  for (const code in lobbies)
    if (now - lobbies[code].created > CODE_TTL_MS)
      delete lobbies[code];
}, 10 * 60 * 1000);

// POST /create  →  { code }
app.post('/create', (req, res) => {
  const hostIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  let code;
  do { code = genCode(); } while (lobbies[code]);

  lobbies[code] = { hostIp, members: 1, max: MAX_PLAYERS, created: Date.now() };
  console.log(`Lobby creado: ${code} por ${hostIp}`);
  res.json({ code });
});

// POST /join/:code  →  { ok, hostIp }
app.post('/join/:code', (req, res) => {
  const code   = req.params.code.toUpperCase();
  const lobby  = lobbies[code];

  if (!lobby)                          return res.json({ ok: false, error: 'Código inválido' });
  if (lobby.members >= lobby.max)      return res.json({ ok: false, error: 'Lobby lleno' });

  lobby.members++;
  console.log(`${req.socket.remoteAddress} se unió al lobby ${code} (${lobby.members}/${lobby.max})`);
  res.json({ ok: true, hostIp: lobby.hostIp, members: lobby.members, max: lobby.max });
});

// GET /lobby/:code  →  { members, max }
app.get('/lobby/:code', (req, res) => {
  const lobby = lobbies[req.params.code.toUpperCase()];
  if (!lobby) return res.json({ members: 0, max: MAX_PLAYERS });
  res.json({ members: lobby.members, max: lobby.max });
});

// DELETE /lobby/:code (host cierra la sala)
app.delete('/lobby/:code', (req, res) => {
  delete lobbies[req.params.code.toUpperCase()];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PCBSCoop relay corriendo en puerto ${PORT}`));
