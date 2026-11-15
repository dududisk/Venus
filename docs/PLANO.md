# Plano de execução — Venus

Assistente pessoal baseada no J.A.R.V.I.S., construída sobre o fork `dududisk/Venus` (upstream `adewaskar/jarvis`).
Objetivo: pedir tarefas por voz ou texto; marcar reuniões no calendário; abrir pastas e rodar projetos do computador.
Depois: pedidos por WhatsApp e reconhecimento de vídeo.

## Regras do plano

- **Portão:** só se avança para a etapa seguinte quando todos os critérios de pronto da etapa atual estiverem cumpridos. Exceção: quando a conclusão depende de algo que só existe na etapa seguinte; nesse caso, o item fica registrado explicitamente como dependência.
- **Branch:** `etapa-N/descricao`. **Commits:** Conventional Commits.
- **Prova:** nada está pronto sem lint, test e build rodados, com o resultado mostrado.
- **Aprovação do dono:** migrations, deploy, dinheiro, permissões e segredos. Também tudo que envia mensagem ou altera o calendário em nome do usuário.
- **Revisão:** @leonardo revisa o diff antes de cada commit que vai para o `origin`.
- **Segurança:** o bridge continua somente leitura por padrão. Cada capacidade de escrita entra por tool estreita, com política em `bridge/policy.mjs`. Nunca por `Bash` geral.
- **`npm audit fix --force`:** proibido sem o dono olhar. Cada vulnerabilidade é triada (direta ou transitiva, dev ou runtime).

## Responsáveis

| Agente | Papel no plano |
|---|---|
| @pattinson | Organiza o plano, controla portões e prazos, mantém este arquivo |
| @tom | Bridge, tools, políticas, integrações (dono técnico das etapas 0, 2, 3, 5, 6) |
| @brad | Frontend em `src/` (texto, wake word, estados do HUD) |
| @zendaya | Design do HUD: estados, contraste, tipografia |
| @thimote | Pesquisa antes de cada etapa (OAuth, APIs, pt-BR, riscos) |
| @hathaway | QA: testes por etapa, regressão (base: 21 passando, 1 pulado) |
| @leonardo | Revisão de código e segurança antes de cada commit |
| @robertdowney | Escopo, trade-offs e riscos; aprova os portões |

Os agentes são subagentes do Claude Code em `.claude/agents/`, gerados a partir da equipe da Forky (o @leonardo, que veio sem prompt, foi escrito a partir deste plano). Cada um tem a lista de ferramentas explícita no cabeçalho.

## Etapa 0 — Base rodando e plano no GitHub

**Objetivo:** ter o ponto de partida verificado e este plano versionado.

Passos:
1. Dono aprova `npm install` (rodar dentro de `Venus`, sem `--prefix`). — @tom
2. Rodar lint, test, build e `npm audit`; registrar a linha de base desta máquina. — @tom, @hathaway
3. Triar as vulnerabilidades do audit, sem `--force`. — @tom, revisão do @robertdowney
4. Adicionar `upstream` (`adewaskar/jarvis`) se o dono quiser. — @tom
5. Revisar o diff antes do commit. — @leonardo
6. Commitar `docs/PLANO.md` em `etapa-0/plano` e dar push. — @pattinson prepara, dono aprova o push

**Pronto quando:** `git log origin/main` (ou PR mergeado) mostra o plano; a linha de base está registrada neste arquivo.

**Linha de base registrada** (Windows, Node 24.15, npm 11.12, commit `9ae5ec8`, Claude CLI 2.1.319): `npm install` ok (260 pacotes); lint com 2 avisos (`bridge/chrome.mjs:276`, `bridge/server.mjs:29`); test com 21 passando e 1 pulado (22 no total); build ok; `npm audit` com 16 vulnerabilidades (2 críticas, 10 altas, 4 moderadas). Diretas: `dompurify` (crítica), `vite`, `zod` e `kokoro-js` (sem correção).

**Triagem do audit (passo 3, concluído; revisada e aprovada com ressalvas pelo @robertdowney em 15/11/2026):** `npm audit fix` sem `--force` mudou só o `package-lock.json` e levou de 16 para 3 vulnerabilidades, com 0 críticas. O @leonardo revisou o lockfile em 15/11/2026: nenhuma versão maior, todo `resolved` no registry.npmjs.org e nenhum script de instalação novo.

| Pacote | Origem | Uso | Resultado |
|---|---|---|---|
| `dompurify` (crítica) | direta | runtime, sanitiza os painéis do HUD | 3.4.18 |
| `zod` (alta) | direta | runtime | 4.6.7 |
| `vite` (alta, launch-editor no Windows), `nanoid`, `source-map-js` | direta e via vite/postcss | dev | vite 8.3.8 |
| `@modelcontextprotocol/sdk`, `hono`, `@hono/node-server`, `proxy-addr` (crítica), `body-parser`, `qs`, `ip-address`, `fast-uri` | via `@anthropic-ai/claude-agent-sdk` | runtime do bridge | corrigidos no lockfile; provavelmente não alcançáveis, pois o bridge usa `node:http` + `ws` e MCP em processo, sem express nem hono |
| `kokoro-js` → `@huggingface/transformers` → `sharp` (3 altas) | direta | TTS opcional (`VITE_TTS_ENGINE=kokoro`) | sem correção; risco aceito: o `sharp` é Node e não vai para o navegador (o kokoro carrega sob demanda e o padrão é `system`). Decidir na Etapa 1, passo 1: adotar o kokoro ou remover o `kokoro-js`, o que zera o audit |

**Teste no Chrome (15/11/2026):** com o `dompurify` 3.4.18, o sanitizador bloqueou 5 ataques (script, `onerror`, `javascript:`, SVG e `style` de tela cheia) e nenhum disparou. Ele manteve as classes `hud-*`, mandou a imagem pelo proxy do bridge e removeu o iframe de host desconhecido. De ponta a ponta, um pedido ao bridge gerou um painel via `display` que apareceu no HUD.

**Etapa 0 pronta** (aprovada pelo @robertdowney).

Depois da correção: lint com os mesmos 2 avisos; test com 21 passando e 1 pulado; build ok.

**Upstream (passo 4, concluído):** remoto `upstream` = `adewaskar/jarvis`, só para consulta; em 15/11/2026 não tinha commits à frente do `main`.

## Etapa 1 — Identidade e entrada (Venus, pt-BR, texto)

**Objetivo:** falar com "Venus" em português, por voz ou digitando.

Passos:
1. Pesquisar cobertura de pt-BR no reconhecimento de voz do navegador e nas vozes (ElevenLabs, Kokoro). — @thimote
2. Mapear todos os pontos do nome "Jarvis" e as variáveis `JARVIS_*`. Recomendação: manter `JARVIS_*` e `VITE_*` por compatibilidade e renomear só o que o usuário vê; o dono confirma. — @tom
3. Trocar a wake word para "Venus" no motor `speech` (SpeechRecognition do navegador) e configurar pt-BR (hoje o `src/config.ts` não define idioma). Ajustar o `NAME` em `App.tsx` com variantes de "Venus", calibradas com a voz do dono. O Porcupine foi descartado: a Picovoice informa que não há plano para uso pessoal. Custo: o áudio da escuta contínua vai para o Google (aceite do dono pendente). — @brad
4. Criar a caixa de texto (não existe hoje): componente novo montado no `Hud.tsx`, reaproveitando o envio da voz. — @brad, desenho do @zendaya
5. Estados do HUD (ouvindo, pensando, falando, erro) sem depender só de cor; contraste mínimo 4.5:1. Marca do HUD: só "VENUS", sem acrônimo. Ciano mantido nesta etapa (identidade própria na Etapa 4). O texto `OFFLINE` usa `#0d4a4a` (contraste 2.03): corrigir se for texto. — @zendaya
6. Testes e regressão. — @hathaway

**Pronto quando:** dá para pedir algo por voz e por texto em pt-BR, a wake word é "Venus", e lint, test e build passam.

## Etapa 2 — Calendário (primeiro leitura, depois escrita)

**Objetivo:** ver a agenda e marcar reuniões com confirmação do dono.

Passos:
1. Validar o servidor MCP oficial do Google Calendar (Developer Preview, `https://calendarmcp.googleapis.com/mcp/v1`): se conta pessoal entra no Preview, qual escopo OAuth autoriza criar evento e se o CLI do bridge conecta num MCP remoto com OAuth. Plano B: tool própria e estreita (listar e criar) sobre a API do Google. — @thimote
2. Agenda definida pelo dono: Google Calendar.
3. Decisão de abordagem e escopo mínimo de permissão. — @robertdowney, aprovação do dono
4. Tool de **leitura** da agenda. — @tom
5. Tool de **criar evento**, sempre com confirmação explícita antes de gravar. Entra na política como ação com efeito: isentar só `create_event`, sem abrir `Bash` nem as demais escritas. Texto de evento é entrada não confiável (injeção de prompt). — @tom
6. Revisão de segurança (tokens, escopos, onde o segredo fica). — @leonardo
7. Testes, incluindo o caso de recusa. — @hathaway

**Pronto quando:** a Venus lista a agenda do dia e cria uma reunião só depois do "sim" do dono; nenhum segredo no repositório.

## Etapa 3 — Pastas e projetos do computador

**Objetivo:** abrir pastas e executar projetos do computador.

Passos:
1. Pastas permitidas (definidas pelo dono): `C:\Users\Administrador\Desktop\Projetos`, `C:\Users\Administrador\Desktop\aurius-projetos` e `C:\Users\Administrador\Documents\Pos_UNIPDS_ERICK_WENDEL`. Falta o dono listar projetos e comandos permitidos.
2. Tool estreita com lista de pastas permitidas e comandos permitidos por projeto; sem liberar o `Bash` geral. — @tom
3. Política em `bridge/policy.mjs` com confirmação para execução. — @tom
4. A política nega escrita em `Venus/bridge`, `Venus/.git` e `.env*`, comparando o caminho já resolvido (`..\`, junctions, links simbólicos, nomes 8.3, maiúsculas). Preferência: mover o `Venus` para fora das pastas liberadas ou liberar subpastas. — @tom
5. Tool de git (`clone`, `pull`, `push`) com lista fixa de argumentos, sem texto livre; sem `--force`; `core.hooksPath` vazio; clone só dentro das pastas liberadas e só de `github.com/dududisk`; push só em branch que não seja `main`, com o "sim" do dono a cada vez. — @tom
6. Credencial do GitHub: token fine-grained restrito aos repositórios necessários, só permissão de conteúdo, guardado no gerenciador de credenciais e nunca legível pelo modelo. Aprovação do dono. — @tom, dono
7. Revisão de segurança, com foco em escapar da lista (caminhos relativos, links simbólicos, junctions). — @leonardo
8. Testes, incluindo tentativa de acessar pasta fora da lista e de escrever em `Venus/bridge`. — @hathaway

**Pronto quando:** a Venus abre uma pasta permitida e roda um projeto permitido; pedir algo fora da lista é recusado.

## Etapa 4 — Consolidação e decisão de hospedagem (portão antes das etapas extras)

**Objetivo:** estabilizar o que foi pedido no início antes de abrir novas superfícies.

Passos:
1. Rodada completa de testes ponta a ponta das etapas 1 a 3. — @hathaway
2. Revisão geral de segurança e do `npm audit`. — @leonardo, @tom
3. Decidir onde roda o bridge: no PC, numa VPS ou híbrido. Abrir pastas, rodar projetos e git só funcionam com o bridge no PC. O Cloudflare Pages não roda o bridge (Node de longa duração, WebSocket e CLI do Claude); serviria só ao frontend. Hipótese a validar: relay público mínimo que recebe o webhook, valida a assinatura da Meta e checa o número do dono, com o bridge no PC puxando as mensagens por conexão de saída. — @robertdowney, @tom, @thimote (pesquisa de túnel e relay), decisão do dono
4. Se houver VPS, definir a autenticação do Claude: a página legal da Anthropic manda usar chave de API em serviços construídos com o Agent SDK, e um bot 24h por WhatsApp numa VPS com assinatura é zona cinzenta. O custo por token entra na conta. — dono, @robertdowney
5. Atualizar README e este plano. — @pattinson

**Pronto quando:** o dono usa a Venus no dia a dia e confirma que o que foi pedido no início funciona.

## Etapa 5 — WhatsApp (só depois da Etapa 4)

**Objetivo:** dar ordens à Venus pelo WhatsApp.

Passos:
1. API oficial (WhatsApp Business Cloud API) escolhida; bibliotecas não oficiais (Baileys, whatsapp-web.js) têm risco de bloqueio da conta. Pendente: se um número já usado no WhatsApp comum pode ser registrado, e o custo de mensagens iniciadas pela Venus fora da janela de 24h (resposta dentro da janela é gratuita, segundo a Meta). — @thimote
2. Número próprio da Venus (decidido pelo dono). Pendente: o número já existe e já foi usado em algum WhatsApp?
3. Desenho de segurança: só o número do dono é obedecido; mensagem recebida é entrada não confiável. A regra "só o dono" é checada no servidor, não no prompt, e a assinatura da Meta é validada em cada chamada. O webhook precisa de endereço público e o bridge hoje só escuta em `127.0.0.1` (ver decisão da Etapa 4). — @tom, @leonardo, @robertdowney
4. Implementação, com ações de escrita pedindo confirmação. — @tom
5. Testes, incluindo mensagem de número desconhecido. — @hathaway

**Pronto quando:** ordem vinda do número do dono é executada; de qualquer outro número é ignorada. Se a etapa crescer, avaliar um agente de segurança dedicado (decisão do dono).

## Etapa 6 — Reconhecimento de vídeo (só depois da Etapa 5)

**Objetivo:** ir além do que existe hoje. A base já tem `look` e `watch`, que descrevem imagens, sem identificar rosto e sem guardar frame.

Passos:
1. Definir o que "reconhecimento" significa: descrever cena, detectar eventos ou identificar pessoas. — dono, com @robertdowney
2. Pesquisar opções e implicações de privacidade. — @thimote
3. Implementar o escopo definido. — @tom, @brad (interface)
4. Revisão de privacidade e segurança. — @leonardo
5. Testes. — @hathaway

**Pronto quando:** o escopo definido pelo dono funciona e a política de dados (o que é guardado e por quanto tempo) está documentada.

## Pontos em aberto (dono)

1. Agenda: Google Calendar (respondido).
2. Pastas: respondido (ver Etapa 3). Falta listar os projetos e comandos permitidos.
3. WhatsApp: número próprio da Venus (respondido). Falta saber se o número já existe e se já foi usado em algum WhatsApp.
4. Variáveis `JARVIS_*` e `VITE_*`: a recomendação é manter e renomear só o que o usuário vê. Aguarda confirmação do dono.
5. O áudio da wake word (motor `speech`) passa pelo Google. O dono aceita?
