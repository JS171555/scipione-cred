# Scipione Cred

Plataforma interna da Scipione Affare para cadastro de devedores, dívidas e pagamentos. Documentação em `docs/`.

```
npm install
cp .env.example .env             # preencha URL e chave pública (anon/publishable)
# aplique as migrations e crie o administrador: docs/supabase-setup.md
npm run verificar:supabase       # confere o projeto real (somente leitura)
npm run dev
```
Testes: `npm test` · `npm run test:sql` · `npm run test:integracao`.
