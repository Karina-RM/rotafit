# RotaFit

App de corrida com GPS: registra a rota, a distância, o tempo e o ritmo de cada
corrida, com tema claro e escuro e um player do Spotify para tocar música
durante o treino.

Projeto 3 de 5 da disciplina **Programação para Dispositivos Móveis** (IESB),
construído a partir do guia do Prof. Me. Bruno Assunção Dias.

## Funcionalidades

- Login com **Google** (Supabase Auth, sem senha própria)
- Corrida com GPS: distância, tempo, ritmo e traçado da rota em tempo real
- Pausar, retomar, finalizar e descartar uma corrida
- Histórico de corridas e resumo de cada uma (com o traçado)
- Estatísticas da semana (distância, tempo, número de corridas)
- **Spotify**: login OAuth (PKCE), tocando agora, tocar/pausar, próxima/anterior
- **Tema claro e escuro**, com persistência: claro em Milano Red + Lemon
  Chiffon, escuro inspirado no Flamengo
- Interface em **Liquid Glass**: superfícies translúcidas com blur, brilho e
  borda, no app inteiro

## Tecnologias

React Native · Expo (SDK 58) · Expo Router · TypeScript · Supabase (Auth com
Google, Postgres, RLS) · TanStack Query · expo-location · expo-auth-session
(Spotify) · expo-blur / expo-linear-gradient (Liquid Glass) · react-native-svg
(traçado da rota) · Jest · PGlite (testes do banco)

## Como executar (Supabase local)

O projeto roda com o **Supabase local em Docker** (o plano gratuito na nuvem não
estava disponível). Como o Google não aceita endereços de rede local no retorno
do login, um túnel HTTPS gratuito da Cloudflare expõe **apenas** o callback do
OAuth, através de um pequeno proxy (`scripts/tunnel-proxy.mjs`).

1. Instale as dependências: `npm install`
2. Inicie o Supabase local: `npx supabase start` (portas próprias, 54331–54339,
   para conviver com outros projetos). Execute `supabase/schema.sql` no SQL
   Editor do Studio (`http://127.0.0.1:54333`).
3. Em duas abas do Terminal, suba o proxy e o túnel:
   - `npm run tunnel:proxy`
   - `cloudflared tunnel --url http://127.0.0.1:54341`
4. No Google Cloud (Google Auth Platform), crie um cliente OAuth do tipo
   **Aplicativo da Web** com a URI de redirecionamento
   `https://<seu-túnel>.trycloudflare.com/auth/v1/callback`.
5. Crie `supabase/.env` (fora do Git) com `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`,
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` e `SUPABASE_AUTH_EXTERNAL_GOOGLE_REDIRECT_URI`,
   e reinicie o Supabase (`npx supabase stop && npx supabase start`).
6. Copie `.env.example` para `.env` com o IP do computador na rede
   (`http://IP:54331`), a chave **Publishable** de `npx supabase status` e,
   se tiver, o Client ID do Spotify.
7. Inicie o app com `npm run start:go` e abra no Expo Go (iOS ou Android).
   Esse comando anuncia o **nome** do computador na rede (`.local`) em vez do
   IP: o Supabase Auth recusa endereços de retorno com IP fora do loopback.

## Sem custo, de ponta a ponta

Nenhuma etapa exige cartão de crédito: login pelo Google, Supabase local,
túnel da Cloudflare e o traçado da rota (desenhado à mão em SVG, sem mapa pago).
O Spotify, porém, passou a exigir conta **Premium** do desenvolvedor para criar
um app em modo de desenvolvimento (desde fevereiro de 2026); sem Client ID, o
app avisa e segue funcionando sem o player.

## Testes

| Comando            | O que testa                                              |
| ------------------ | -------------------------------------------------------- |
| `npm test`         | Tudo: app (Jest) e banco (PGlite)                        |
| `npm run test:app` | 45 testes: rota/ritmo, máquina de estados, filtro de GPS |
| `npm run test:db`  | 12 testes: RLS, permissões e a função `weekly_stats`     |

Os testes do banco reproduzem as **permissões padrão do Supabase real** (que
liberam tudo para `anon` e `authenticated`, inclusive `TRUNCATE`); o
`schema.sql` revoga essas permissões e concede só o necessário.

## Diferenças em relação ao guia

Correções feitas durante a execução no iPhone, todas documentadas no relatório:

- Segurança: `revoke` de privilégios padrão (um usuário logado conseguia
  esvaziar a tabela com `TRUNCATE`) e túnel restrito ao callback do OAuth.
- SDK 58: `expo-auth-session/build/QueryParams` deixou de ser exportado →
  `src/utils/authUrl.ts`.
- GPS: leituras imprecisas e oscilação dentro da margem de erro não contam
  distância (uma corrida "parada" era salva com alguns metros).
- Interface: tema da navegação, área segura e componente `Screen` nas abas,
  brilho do vidro sem faixa cinza e botões de ação sólidos no tema claro,
  foto do Google no Perfil.

## Arquitetura

```
app/            rotas (Expo Router)
src/
  components/   interface, incluindo os componentes "glass/" (Liquid Glass)
  context/      sessão (Google), tema e Spotify
  hooks/        corridas, player do Spotify e o rastreador de GPS
  lib/          Supabase, login Google e Spotify
  services/     acesso ao Supabase
  theme/        tokens de cor (claro/escuro) e o ThemeProvider
  utils/        geolocalização e máquina de estados da corrida, cobertas por testes
scripts/        proxy do túnel (só o callback do OAuth passa)
supabase/
  config.toml   Supabase local (portas, Google, serviços desligados)
  schema.sql    banco, RLS e a função weekly_stats
  tests/        testes do banco
```

## Autora

**Karina Ribeiro Modesto**

- GitHub: https://github.com/Karina-RM
