// Porteiro do túnel (cloudflared) para o Supabase LOCAL.
//
// Por quê: o login com Google precisa de UM endereço público em HTTPS — o
// callback do Supabase Auth, para onde o Google devolve o navegador. Um túnel
// apontado direto para a porta 54331 publicaria o Supabase inteiro na
// internet, inclusive /pg/* (pgMeta: executa SQL sem senha) e /mcp.
// Este proxy escuta só em 127.0.0.1:54341 e repassa ao Supabase apenas o
// callback do OAuth; qualquer outro caminho recebe 404.
//
// Uso (duas abas do Terminal):
//   npm run tunnel:proxy
//   cloudflared tunnel --url http://127.0.0.1:54341
import http from 'node:http';

const LISTEN_PORT = 54341;
const TARGET = { host: '127.0.0.1', port: 54331 }; // API do Supabase local
const ALLOWED = [/^\/auth\/v1\/callback(\?|$)/];

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  const allowed = req.method === 'GET' && ALLOWED.some((rule) => rule.test(url));
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`${stamp} ${allowed ? 'OK ' : '404'} ${req.method} ${url.split('?')[0]}`);

  if (!allowed) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado.\n');
    return;
  }

  const upstream = http.request(
    { ...TARGET, method: req.method, path: url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Supabase local fora do ar. Rode: npx supabase start\n');
  });
  req.pipe(upstream);
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(
    `Porteiro do túnel em http://127.0.0.1:${LISTEN_PORT} → Supabase em ` +
      `http://${TARGET.host}:${TARGET.port} (só /auth/v1/callback passa)`,
  );
});
