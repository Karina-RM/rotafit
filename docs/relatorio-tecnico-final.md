# RotaFit: relatório técnico consolidado

Karina Ribeiro Modesto · IESB · Análise e Desenvolvimento de Sistemas  
Disciplina: Programação para Dispositivos Móveis  
Professor: Prof. Me. Bruno Assunção Dias  
Projeto 3 de 5 · referência: guia de outubro de 2026  
Data de fechamento documental: 6 de novembro de 2026

Este arquivo é a versão de acompanhamento no GitHub. O relatório acadêmico completo foi preparado separadamente em PDF de 19 páginas, com capturas de tela, arquitetura, histórias de usuário, casos de teste, ocorrências E1–E20, auditoria de segurança e conclusão. A versão ilustrada não é automaticamente substituída por este resumo.

## 1. Objetivos e implementação

O RotaFit é um aplicativo de corridas em React Native, Expo SDK 58 e TypeScript, com autenticação Google pelo Supabase Auth, banco PostgreSQL local em Docker, políticas RLS, rastreamento pelo expo-location, traçado SVG, distância, tempo, ritmo, histórico, estatísticas semanais e temas claro/escuro/Sistema com apresentação Liquid Glass. A integração Spotify foi implementada em código, mas não foi validada ponta a ponta devido à ausência das condições de conta e credenciais necessárias.

O desenvolvimento seguiu as 16 etapas do guia do professor. As principais adaptações decorreram das diferenças entre as versões de bibliotecas, da infraestrutura local, dos testes no iPhone e de achados de segurança.

O uso de IA auxiliou geração e revisão de código, investigação de erros, desenho de testes e documentação, sem substituir as verificações executadas. O relatório final registra diagnósticos, soluções e resultados; não reproduz conversas ou prompts de assistentes.

## 2. Arquitetura

- `app/`: Expo Router, login, abas, corrida, histórico, resumo e perfil.
- `src/components/`: interface, SVG e elementos de vidro.
- `src/context/`: autenticação, tema e Spotify.
- `src/hooks/useRunTracker.ts`: interface com o GPS real e instrumentação E19.
- `src/utils/tracker.ts`: reducer puro com estados idle, active, paused e finished.
- `src/utils/geo.ts`: distância, filtros e ritmo.
- `src/services/`: persistência e serviços remotos.
- `supabase/schema.sql`: tabela runs, índices, RLS, concessões e weekly_stats.
- `scripts/tunnel-proxy.mjs`: proxy local de callback OAuth.
- `__tests__/` e `supabase/tests/`: testes Jest e PGlite.

O banco Supabase foi executado localmente por indisponibilidade de outro projeto no plano gratuito em nuvem. As portas da API, banco e Studio são 54331, 54332 e 54333, respectivamente. A autenticação Google usa um túnel HTTPS que só encaminha o callback OAuth, e o Expo Go divulga o nome mDNS do Mac em vez de um IP literal para evitar rejeição do endereço de retorno.

## 3. Verificação automatizada

A execução anterior documentada apresentou:

| Verificação | Resultado |
|---|---|
| Jest | 45 testes aprovados, 5 suítes |
| PGlite | 12 testes aprovados, 3 suítes |
| Total | 57 aprovações, 0 falhas |
| TypeScript | `npm run typecheck` sem erros |

Esses resultados não provam automaticamente o funcionamento de sensores físicos ou provedores externos. Após alterações locais mais recentes, houve informação de typecheck aprovado, porém dois erros e três avisos preexistentes de lint. O estado final da suíte completa precisa ser conferido antes da publicação definitiva.

## 4. Testes manuais (roteiro do guia)

| Cenário | Funcionalidade | Situação documentada |
|---:|---|---|
| 1 | Entrar com Google | Aprovado |
| 2 | Persistência de sessão | Aprovado |
| 3 | Troca entre tema claro e escuro | Aprovado |
| 4 | Tema Sistema acompanha iPhone | Aprovado |
| 5 | Localização negada | Aprovado |
| 6 | Pausar corrida | Aprovado |
| 7 | Retomar corrida | Aprovado |
| 8 | Finalizar e salvar resumo | Aprovado: 190 m em 05:33 |
| 9 | Finalizar sem deslocamento | Intermitente; E19 aberta |
| 10 | Descartar corrida | Aprovado |
| 11 | Abrir corrida do Histórico | Aprovado |
| 12 | Excluir corrida | Aprovado |
| 13 | Conectar Spotify | Parcial; credenciais indisponíveis |
| 14 | Reprodução Spotify Premium | Não testado |
| 15 | Tratar indisponibilidade Spotify | Aprovado: mensagem clara |
| 16 | Faixa Spotify no resumo | Não testado |
| 17 | Sair, entrar em outra conta e verificar isolamento | Aprovado |

Contagem: 13 cenários aprovados, um intermitente, um parcial, dois não testados. Essa classificação se refere às evidências disponíveis, e não equivale a 17/17 aprovados.

## 5. Segurança

### E2: privilégios de tabela além de RLS

Testes adicionais demonstraram que os privilégios padrão do Supabase podem conceder TRUNCATE em tabelas novas. Como TRUNCATE não está sujeito a RLS, foram aplicados `REVOKE ALL` e concessões mínimas (`SELECT`, `INSERT` e `DELETE`) para `authenticated`. A execução de `weekly_stats()` foi retirada de `public` e `anon`. O controle foi validado em testes PGlite e no Supabase local.

### E13: exposição de API administrativa pelo túnel

Um túnel inicial expôs a API Supabase completa, inclusive `/pg/schemas`. A exposição foi observada durante o desenvolvimento. A solução foi interpor o proxy que aceita apenas GET `/auth/v1/callback`; os caminhos administrativos e demais métodos avaliados passaram a receber 404. Essa solução é específica da demonstração local e não representa uma certificação de produção.

### E14: callback OAuth

O Supabase Auth não aceitou a URL de retorno `exp://` quando ela continha IP da LAN. O `npm run start:go` define um hostname `.local`, permitindo retornar do login Google ao aplicativo no iPhone.

## 6. E19: GPS parado (ocorrência aberta)

Linha de evidências:

1. Teste estacionário inicial: 8 m em 1 s, 10 m salvos em 4 s.
2. Reteste com filtro inicial de precisão: 0 m, sem salvamento, mas insuficiente para concluir que o filtro resolveu o problema.
3. Reteste a frio: 5 m salvos em 30 s.
4. Reteste em 06/11/2026: 14 m salvos em 33 s.
5. Último teste estacionário informado: 0 m, sem nova corrida no Histórico.

O algoritmo já descarta leituras com precisão horizontal superior a 20 m e deslocamentos menores que a incerteza informada, além de rejeitar saltos de velocidade implausível. Mesmo assim, a deriva pode superar esses critérios e gerar corrida fictícia. Testes sintéticos do reducer não garantem ausência de falsos positivos em aparelho real.

A instrumentação de desenvolvimento passou a usar `GPS_RAW` e `GPS_ACEITO`, sem imprimir coordenadas geográficas. A tentativa de coleta automática pelo inspetor encontrou WebSocket HTTP 401; os registros reais e o autoteste do coletor não foram recuperados até a última informação disponível. O diagnóstico local detalhado encontra-se em `docs/E19-diagnostico.md` no diretório da aluna, caso ainda não esteja publicado.

Conclusão: E19 não pode ser declarada resolvida. A validação de precisão continua pendente, especialmente para execuções estacionárias repetidas e movimentação real.

## 7. E20: Spotify

Sem Client ID válido, o aplicativo antes chegava a uma mensagem técnica de erro. Foi adicionada a mensagem “Spotify não configurado”, verificada no iPhone. O tratamento de erro é considerado implementado; conexão real, controle da reprodução e faixa no resumo não foram comprovados.

## 8. Registro E1–E20

| ID | Resumo do problema | Ação |
|---|---|---|
| E1 | Instalação de pacotes bloqueada no ambiente inicial | Resolução offline de versões |
| E2 | Privilégios Supabase excessivos | Revogações e testes |
| E3 | Jest capturando testes ESM de banco | Ajuste de exclusão |
| E4 | Simulação de salto não provocava falha | Correção da experiência de teste |
| E5 | Dependências utilitárias ausentes no guia | Reposição dos módulos |
| E6 | Import profundo não disponível no SDK 58 | Utilitário de parâmetros OAuth |
| E7 | Assinatura RefreshControl incompatível | Ajuste em onRefresh |
| E8 | Tipo de cor do ícone incompatível | Normalização |
| E9 | Avatar Google não renderizado | Exibição com fallback |
| E10 | Ambiente reiniciado e túnel alterado | Reconfiguração |
| E11 | Supabase iniciado na pasta errada | Diretório e portas corretos |
| E12 | Docker sem memória suficiente | 6 GB e serviços essenciais |
| E13 | Túnel público expôs API | Proxy de callback restrito |
| E14 | OAuth recusava retorno com IP | Hostname mDNS |
| E15 | Fundo e texto ilegíveis no escuro | Tema de navegação e Screen |
| E16 | Faixa acinzentada no vidro | Transparência branca |
| E17 | Botões vermelhos lavados | Destaque de vidro reduzido |
| E18 | Área insegura e botões apagados na corrida | SafeAreaView e botões sólidos |
| E19 | Deriva GPS registra distância em repouso | Filtros e instrumentação; pendente |
| E20 | Spotify sem configuração exibia erro técnico | Mensagem orientativa |

## 9. Índice de evidências

Os arquivos foram disponibilizados no conjunto de capturas da execução. Antes de enviar imagens para repositório público, revisar informações pessoais.

- Login: `etapa11-login-escuro.png` e `cenario02-reaberto-logado-semana-190m.png`.
- Temas: `etapa12-inicio-escuro-DEPOIS.png`, `etapa12-inicio-claro-DEPOIS.png` e `cenario04-sistema-volta-escuro.png`.
- Corrida: `cenario06-pausada-89m.png`, `cenario08b-resumo-190m.png`.
- Histórico: `cenario11a-historico-190m.png` e `cenario11b-resumo-pelo-historico.png`.
- E19: `cenario09-FALHA-corrida-fantasma-10m-salva.png`, `cenario09-reteste-frio-FALHA-5m-salvo.png` e captura de 14 m de 06/11.
- Segurança: `etapa15-permissoes-no-supabase.png`, `tunel-exposto-pg-schemas.txt`.
- Spotify: `cenario15-spotify-nao-configurado.png`.
- Troca de usuário: `cenario17b-conta2-inicio-zerado.png` e `cenario17c-conta2-historico-vazio.png`.

## 10. Pendências de entrega e conclusão

O conjunto principal de funcionalidades foi implementado e submetido a testes reais no iPhone. Os testes automatizados registrados oferecem evidência de correção das regras isoladas; as verificações de segurança reforçaram os privilégios do banco e reduziram a exposição do túnel. Não se deve considerar o projeto totalmente validado: o GPS estacionário segue intermitente e as operações dependentes do Spotify ainda carecem de ensaio real.

Antes da entrega definitiva, conferir os últimos arquivos locais do Codex, o relatório `docs/E19-diagnostico.md`, o resultado do lint, o `git status` e a execução final dos comandos `npm run typecheck` e `npm test`. Não publicar segredos, arquivos `.env`, JSON de credenciais, logs sensíveis ou coordenadas pessoais. Uma publicação segura exige diff revisado e branch própria.

### Referências

- Bruno Assunção Dias. RotaFit: guia de construção passo a passo. IESB, outubro de 2026, 91 páginas.
- Karina Ribeiro Modesto. Relatório do Projeto MarketGo. IESB, outubro de 2026.
- Registro técnico `registro-erros.md` do RotaFit (E1–E20).
- Repositório: https://github.com/Karina-RM/rotafit.
