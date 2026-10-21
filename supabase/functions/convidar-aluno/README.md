# convidar-aluno

Gera um link de convite (ou de nova password) para um aluno, **sem enviar email**. Só o profissional autenticado o pode pedir, e só para um email que já tenha uma ficha de aluno com convite. A app transforma o resultado num link para si própria (`?convite=<token>&tipo=invite|recovery`); o aluno abre-o, define a password e a conta fica ativa.

- `core.mjs`: a lógica (testada em `tests/convidar-aluno.test.js`).
- `index.ts`: liga a lógica ao Supabase. Usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`, que o Supabase já fornece às funções. A chave de serviço nunca vai para a app.
- `ALLOWED_ORIGINS` (opcional, separadas por vírgula): origens autorizadas a chamar a função. Por omissão, o GitHub Pages da EVOLVE e `localhost`.

Publicar e validar: `docs/OPERACOES.md`, secção 8s.
