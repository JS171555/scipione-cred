// Faz o papel do gateway do Supabase: /rest/v1/* → PostgREST local (para testar o supabase-js de verdade).
import http from 'node:http';
const ALVO = { host: '127.0.0.1', port: Number(process.env.PGRST_PORT ?? 3000) };
http.createServer((req, res) => {
  const caminho = req.url.replace(/^\/rest\/v1/, '') || '/';
  const proxy = http.request({ ...ALVO, path: caminho, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  proxy.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(proxy);
}).listen(Number(process.env.PROXY_PORT ?? 3100), '127.0.0.1');
