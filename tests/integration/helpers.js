import { createHmac } from 'node:crypto';

export const ADMIN = 'a0000000-0000-0000-0000-000000000001';
export const OUTRO = 'b0000000-0000-0000-0000-000000000002';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** JWT HS256 no formato do Supabase Auth (role authenticated + sub). */
export function jwt(sub, segredo = process.env.IT_JWT_SECRET, role = 'authenticated') {
  const corpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, aud: role, ...(sub ? { sub } : {}), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${corpo}.${createHmac('sha256', segredo).update(corpo).digest('base64url')}`;
}

/** Storage em memória que imita a política real: só o bucket de fotos permite apagar. */
export const arquivos = new Map();
export const storageFalso = {
  from: (bucket) => ({
    upload: async (path, file, opts) => {
      const k = `${bucket}/${path}`;
      if (arquivos.has(k)) return { data: null, error: { message: 'The resource already exists' } };
      arquivos.set(k, { opts, size: file.size });
      return { data: { path }, error: null };
    },
    createSignedUrls: async (paths, s) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://storage.fake/${bucket}/${p}?expira=${s}`, error: null })), error: null }),
    createSignedUrl: async (path, s) => ({ data: { signedUrl: `https://storage.fake/${bucket}/${path}?expira=${s}` }, error: null }),
    remove: async (paths) => {
      if (bucket !== 'fotos-devedores') return { data: null, error: { message: 'new row violates row-level security policy' } };
      paths.forEach((p) => arquivos.delete(`${bucket}/${p}`));
      return { data: [], error: null };
    },
  }),
};
