# Evolve Nutrition — Operações (Fase 9)

Este documento cobre o que é preciso saber e fazer para operar a app com alunos reais: como criar contas, arquivar dados de demonstração, recuperar de um erro, e o que confirmar antes de convidar o primeiro aluno real.

Nada aqui substitui os ficheiros de migração em `supabase/migrations/` — este documento explica **quando e porquê** os usar, não repete o SQL.

## 1. Criar o primeiro aluno real

1. Aplica `0010_demo_flag.sql` (ver secção 6) — sem isto, o novo aluno ainda aparece misturado com os de demonstração.
2. No dashboard do profissional → **"+ Convidar aluno"** → preenche o questionário com o **email real** do aluno.
3. Copia o link da app (botão "Copiar" no modal de convite) e envia-o ao aluno, junto com a instrução: "cria conta com este mesmo email".
4. O aluno cria conta, confirma o email (link que a Supabase lhe envia), volta à app e entra — a app associa a conta automaticamente (`claim_student_row`, já validado com contas reais).
5. Confirma no dashboard: o aluno aparece na lista principal, sem a etiqueta "demonstração", sem precisares de ativar "Mostrar contas de demonstração".

## 2. Gerir profissionais

Ver `supabase/manage_professionals.sql` — é o único sítio onde isto se faz (a tabela `professionals` não tem nenhuma política de escrita via app, por desenho). Resumo:

- **Adicionar**: a pessoa faz login uma vez na app com o email dela; depois corres o `insert` do ficheiro no SQL Editor.
- **Remover**: `delete` do mesmo ficheiro. Não apaga a conta de autenticação, só o acesso de profissional.

## 3. Dados de demonstração — arquivar sem apagar

Depois de aplicar `0010_demo_flag.sql`, Maria/Rui/Sofia/Tiago ficam marcados `is_demo = true` e desaparecem da lista principal do dashboard, sem serem apagados. Para os veres outra vez, usa o botão **"Mostrar contas de demonstração"** no dashboard.

Isto é reversível a qualquer momento:

```sql
-- Voltar a mostrar um aluno de demonstração por omissão
update students set is_demo = false where id = 'maria';

-- Marcar um aluno real como demonstração (ex.: uma conta de teste tua)
update students set is_demo = true where id = '<id>';
```

Nunca apagues estas linhas só porque são de demonstração — mantém-nas para referência e para voltares a testar fluxos sem criar dados novos.

## 4. Fotografias — privacidade e remoção

- O bucket `progress-photos` é privado; as imagens só são acessíveis por URLs assinados de 6h, recalculados a cada sessão — nunca gravados como permanentes (corrigido na Fase 9: um bug fazia com que esse URL temporário pudesse ser gravado por engano na base de dados; ver commit correspondente).
- Um aluno remove a própria fotografia diretamente na app (separador Evolução → "✕" sobre a foto). O profissional tem o mesmo botão na vista do aluno, para quando o pedido chega por outro canal.
- Exige `0011_photo_deletion.sql` aplicada (políticas de `delete` no Storage — não existiam antes desta fase).
- Em último recurso (sem depender destas políticas), qualquer fotografia pode ser apagada manualmente em **Storage → progress-photos** no dashboard — nesse caso, apaga também a entrada correspondente em `students.photos` para não ficar um caminho morto.

## 5. Cópias de segurança e recuperação

- **Base de dados**: a Supabase faz backups automáticos cuja frequência/retenção depende do plano do projeto (Free vs. Pro+) — confirma no dashboard em **Settings → Add-ons/Backups** qual se aplica ao teu projeto antes de assumires qualquer garantia. Para uma cópia manual pontual (antes de uma alteração arriscada, por exemplo): **Database → Backups → Download** no dashboard, ou `pg_dump` com a connection string do projeto (Settings → Database), nunca com a chave publicável.
- **Storage** (`progress-photos`): não tem backup automático separado da base de dados nas configurações por omissão — para uma cópia pontual, usa o dashboard (Storage → progress-photos → selecionar tudo → download) ou um script com a service-role key **corrido fora do browser** (nunca no cliente da app).
- **Recuperação de erro de dados**: se uma gravação incorreta afetar um aluno específico, o histórico de `substitution_history`/`adaptation_history` é *append-only* (nunca é possível perder eventos já registados por reescrita, só por restauro de um backup anterior). Para reverter uma linha inteira, usa um backup da base de dados (dashboard) — não há "undo" dentro da app.
- **Nunca**: nenhuma service-role key deve alguma vez ser colada no código do cliente (`evolve-nutrition.html`) nem em nenhum ficheiro servido ao browser. Todas as ações que precisam dela (restauro, exports em massa, gestão de utilizadores de auth) fazem-se **só no dashboard do Supabase**.

## 6. Ações manuais necessárias no Supabase (antes do primeiro aluno real)

Nenhuma destas pode ser feita por uma migração SQL nem pela app — confirma cada uma no dashboard:

- [ ] **Authentication → URL Configuration**: `Site URL` e `Redirect URLs` apontam para `https://tiagojvlourenco.github.io/plano-evolve/` (não `localhost`). Sem isto, os links de confirmação de email e de recuperação de password de um aluno real vão parar ao sítio errado.
- [ ] **Authentication → Email Templates**: confirmar que os templates de "Confirm signup" e "Reset password" estão em português (ou pelo menos claros) — por omissão vêm em inglês genérico da Supabase.
- [ ] **Authentication → Providers → Email**: confirmar que "Confirm email" está ativo (já parece estar, confirmado empiricamente nesta sessão) e decidir se queres manter a confirmação obrigatória para alunos reais.
- [ ] **Database → Backups**: confirmar o plano/retenção aplicável (ver secção 5).
- [x] Aplicar `0010_demo_flag.sql` e `0011_photo_deletion.sql` — aplicadas e validadas em produção em 2026-09-28.
- [ ] Correr `supabase/manage_professionals.sql` para qualquer profissional adicional além da tua conta.

## 7. Checklist operacional — migrações desta fase

- [x] Ler o resultado desta Fase 9 e confirmar que concordas com as alterações.
- [x] Aplicar `0010_demo_flag.sql` no SQL Editor — aplicada em 2026-09-28 (com `disable`/`enable trigger` em torno do UPDATE, ver nota abaixo).
- [x] Aplicar `0011_photo_deletion.sql` no SQL Editor — aplicada em 2026-09-28.
- [x] Correr as queries 11 e 12 de `verify_security.sql` — `is_demo` confirmado em maria/rui/sofia/tiago; as 2 políticas de delete confirmadas.
- [x] Correr o teste funcional H de `verify_security.sql` com uma conta de aluno real (Tiago) e uma fotografia sintética criada só para o teste — upload, listagem, remoção e limpeza final confirmados sem resíduos.
- [ ] Confirmar as 3 ações manuais de Auth da secção 6 no dashboard (ainda pendente da tua parte).
- [ ] Só depois disto, `git push` (nada foi publicado ainda nesta fase).

**Achado durante a aplicação de `0010`**: correr o `UPDATE` do backfill diretamente no SQL Editor falhou com "Só o profissional pode alterar estes dados do plano." — o trigger `enforce_student_column_permissions()` usa `auth.uid()`, que no contexto de uma ligação direta do SQL Editor (sem JWT de sessão) devolve `null`; sem isso ser reconhecido como profissional, o trigger tratou a alteração como se fosse um aluno a tentar mexer numa coluna fora da allowlist. Corrigido desligando o trigger só para esse UPDATE administrativo pontual e voltando a ligá-lo de imediato (ver o SQL final em `0010_demo_flag.sql`).

**Achado durante a validação do teste funcional H (mais importante que o da migração)**: `persistStudent()` usava `upsert()`, que falha sempre que é o PRÓPRIO ALUNO a gravar a sua linha (RLS rejeita o ramo `ON CONFLICT DO UPDATE` de um upsert por não haver política de `INSERT` para o aluno — e não deve haver, para impedir que crie linhas novas). **Isto impedia qualquer aluno real de gravar seja o que for** — concluir uma refeição, um check-in, uma fotografia — não só a funcionalidade desta fase. Corrigido: `persistStudent()` passou a usar `update().eq("id", s.id)`; a criação de um aluno novo (sempre pelo profissional) passou a usar uma função separada, `insertStudent()`. Validado ao vivo: um `update()` simples na linha do Tiago, que antes falhava com erro de RLS, passou a funcionar sem erro depois da correção.

## 8. Checklist de lançamento — antes do primeiro aluno real de verdade

- [ ] Profissional cria e gere um aluno (perfil, plano, alvos) sem erros.
- [ ] Aluno cria conta através de um convite real, confirma o email, e entra na app.
- [ ] Aluno só vê os seus próprios dados (já validado por RLS com contas reais nas Fases 7-9; repetir visualmente com a conta real do primeiro aluno).
- [ ] Aluno consulta o plano, adapta uma refeição, envia um check-in, e envia um pedido de ajuda.
- [ ] Profissional vê as alterações do aluno, o pedido de ajuda, e os indicadores da Leitura profissional.
- [ ] Aluno recupera o acesso: pede recuperação de password, recebe o email, define password nova, entra.
- [ ] Fotografias: aluno envia, vê, e remove uma fotografia; profissional só vê o que o aluno autorizou.
- [ ] App testada num telemóvel real (não só emulação) — ecrã de login, refeição, modais, check-in.
- [ ] `npm test` passa (ver resultado no relatório desta fase).

## 9. Riscos e limitações que ficam por resolver nesta fase

- **Dependência de CDN sem versão fixa**: `supabase-js@2` carrega sempre a última versão da major 2 via jsdelivr — uma alteração de comportamento nessa biblioteca pode afetar a app sem aviso. Recomenda-se fixar uma versão exata numa fase futura.
- **Sem backup automatizado fora do Supabase**: dependemos inteiramente das garantias do plano Supabase; não há uma cópia externa agendada.
- **Sem monitorização de erros em produção**: erros no browser de um aluno real só chegam ao profissional se o aluno os reportar — não há nenhum serviço de monitorização (deliberadamente, por instrução desta fase).
- **Teste em telemóvel físico**: a validação desta fase foi feita por emulação de viewport (375×812); recomenda-se um teste round-trip num telemóvel Android e iOS reais antes do lançamento.
- **Plano de backup do Supabase não confirmado**: este documento assume que vais confirmar o plano/retenção atual (ver secção 6) — as garantias reais dependem disso.
