# Teste de GPS (Fase 0)

Página de diagnóstico, **isolada da app EVOLVE** (pasta `gps-teste/`). Serve para descobrir, em telemóveis reais, o que acontece ao GPS de uma página web quando ela passa para segundo plano ou o ecrã bloqueia. Ainda não é a funcionalidade de corrida.

## O que é e o que não é
- Pede a localização **só** depois de carregares em «Iniciar teste» e só a lê enquanto o teste estiver ativo. «Parar teste» desliga o GPS.
- **Não envia nada** para lado nenhum. A página tem uma política de segurança que bloqueia todos os pedidos de rede (`connect-src 'none'`), não usa Supabase, não tem chaves e não guarda coordenadas no telemóvel. As coordenadas só saem no ficheiro que tu exportares.
- Os dados do telemóvel (modelo, sistema, navegador, modo, permissão, cenário) **escreves tu**. A única coisa que a página deteta sozinha, e mostra no ecrã, é se foi aberta como app instalada ou no navegador.
- Não toca na app: não altera `index.html`, `app.js`, o service worker, as tabelas nem o Supabase.

## Como abrir
- **Já publicada com a app (GitHub Pages, HTTPS):** `https://tiagojvlourenco.github.io/plano-evolve/gps-teste/`
- **Sem publicar, a partir do teu Mac** (HTTPS temporário, para o iPhone):
  1. No Terminal: `cd` para a pasta do projeto e `python3 -m http.server 8080 --directory gps-teste`
  2. Noutro Terminal: `brew install cloudflared` (uma vez) e depois `cloudflared tunnel --url http://localhost:8080`
  3. Abre no telemóvel o endereço `https://….trycloudflare.com` que aparece. É um endereço temporário: fecha o túnel (Ctrl+C) quando acabares.
  - O GPS só funciona em HTTPS ou `localhost`. Um endereço `http://192.168…` na tua rede **não** serve.
- **Android com cabo USB:** liga o telemóvel com depuração USB e usa `chrome://inspect` → *Port forwarding* `8080 → localhost:8080`; abre `http://localhost:8080` no Chrome do telemóvel (localhost conta como seguro).

Num endereço diferente do da app (túnel) o service worker da EVOLVE não interfere. No endereço do GitHub Pages ele está no mesmo âmbito: **não recarregues a página sem internet** (a app de produção responderia «Sem ligação e sem cópia guardada»). Para o teste sem rede, abre a página com internet, inicia o teste e só depois liga o modo avião.

## Instalar como app (para testar o modo «PWA instalada»)
- **iPhone (Safari):** botão Partilhar → «Adicionar ao Ecrã Principal» → abrir pelo ícone «GPS teste».
- **Android (Chrome):** menu ⋮ → «Instalar app» ou «Adicionar ao ecrã principal».

Repete o protocolo **no navegador** e **na app instalada**: o comportamento pode ser diferente.

## Protocolo (em cada telemóvel e em cada modo)
Antes: preenche modelo, sistema e versão, navegador, modo e permissão. Escolhe o cenário. Deixa o «Wake Lock» **desligado** (liga-o só numa repetição extra, para comparar).

1. **5 min, ecrã ligado, página aberta.** «Iniciar teste», caminha ou corre. «Parar teste».
2. **10 min, em segundo plano ou ecrã bloqueado.** «Iniciar teste»; espera pelo estado «sinal recebido»; bloqueia o ecrã (ou muda para outra app) e caminha 10 min. Desbloqueia, volta à página e vê se as posições continuam a chegar. «Parar teste».
3. **Sem internet.** Com a página já aberta e o teste iniciado, liga o modo avião e caminha uns 5 min. O GPS não precisa de internet. «Parar teste».
4. *(Opcional)* Repetir o 2 com «Poupança de energia» ligada.
5. **Exportar diagnóstico** depois de cada teste.

Dicas: leva o telemóvel num bolso ou numa braçadeira, não na mão com o ecrã ligado; o cenário 2 tem de ser mesmo com o ecrã bloqueado. Sai para a rua: dentro de casa o GPS é fraco.

## Exportar e enviar
1. «Exportar diagnóstico» → «Guardar JSON» e «Guardar CSV». No iPhone, se o ficheiro não aparecer, usa «Partilhar…» (AirDrop, Mail, Guardar em Ficheiros) ou «Copiar JSON» e cola o texto numa mensagem.
2. Envia-me os ficheiros por aqui (anexo na conversa ou texto colado), um por teste, com o cenário no nome ou nas notas.
3. Se fechares a página sem exportar, os dados perdem-se: é de propósito (nada fica guardado no telemóvel).

## Como ler o que a página mostra
- **Posições com a página oculta:** quantas posições chegaram enquanto a página estava em segundo plano ou com o ecrã bloqueado.
- **Atrasos do relógio da página:** o relógio da própria página (1 batimento por segundo) parou ou atrasou. Isto indica que o navegador **suspendeu a execução da página** nesses momentos.
- **Lacunas de GPS:** mais de 15 s entre duas posições.
- **Precisão pior:** a precisão passou a ser mais de 30 m e mais do dobro da recente.
- O cronómetro «Duração do teste» continuar a avançar **não prova** que o GPS continuou: vê sempre as posições.
- Um registo incompleto **não prova sozinho** qual foi a causa (sistema operativo, página suspensa, falta de sinal). A conclusão faz-se comparando os cenários.

## O que o teste automático garante e o que não garante
Aprovado em Chromium com GPS simulado (`tests/gps-teste.test.js`): isolamento e privacidade (sem rede, sem armazenamento, só pede localização depois do clique), um só `watchPosition` libertado ao parar, registo de posições, visibilidade (simulada), perda de rede (simulada), lacunas e atrasos do relógio (relógio simulado), permissão recusada, exportação JSON e CSV.
**Não garante** nada sobre o iPhone ou o Android reais: o comportamento com o ecrã bloqueado só se vê nos testes físicos acima.
