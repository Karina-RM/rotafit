import * as AuthSession from 'expo-auth-session';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secureStore';
import { SPOTIFY_SCOPES, spotifyClientId, spotifyDiscovery } from '@/lib/spotify';
import type { SpotifyTokens } from '@/types';

const STORE_KEY = 'rotafit.spotify.tokens';

interface SpotifyContextValue {
  tokens: SpotifyTokens | null;
  connecting: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
}

const SpotifyContext = createContext<SpotifyContextValue | undefined>(undefined);

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'rotafit',
  path: 'spotify-auth',
});

async function saveTokens(tokens: SpotifyTokens) {
  await setSecureItem(STORE_KEY, JSON.stringify(tokens));
}

async function loadTokens(): Promise<SpotifyTokens | null> {
  const raw = await getSecureItem(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotifyTokens;
  } catch {
    return null;
  }
}

// Login e controle de sessão do Spotify. Usa PKCE (sem client secret) e guarda
// os tokens no SecureStore do aparelho — são credenciais de terceiro, mais
// sensíveis que uma preferência qualquer, por isso não vão no AsyncStorage.
export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [connecting, setConnecting] = useState(false);
  const refreshing = useRef<Promise<string | null> | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    { clientId: spotifyClientId, scopes: SPOTIFY_SCOPES, redirectUri, usePKCE: true },
    spotifyDiscovery,
  );

  useEffect(() => {
    loadTokens().then(setTokens);
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) {
      if (response?.type === 'error' || response?.type === 'cancel') setConnecting(false);
      return;
    }
    setConnecting(true);
    AuthSession.exchangeCodeAsync(
      {
        clientId: spotifyClientId,
        code: response.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      spotifyDiscovery,
    )
      .then(async (result) => {
        const next: SpotifyTokens = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? '',
          expiresAt: Date.now() + (result.expiresIn ?? 3600) * 1000,
        };
        await saveTokens(next);
        setTokens(next);
      })
      .finally(() => setConnecting(false));
  }, [response, request]);

  const connect = useCallback(() => {
    // Sem Client ID, o Spotify só falharia no fim do login, numa página técnica
    // ("client_id: Not present"). Melhor explicar antes de abrir o navegador.
    if (!spotifyClientId) {
      Alert.alert(
        'Spotify não configurado',
        'Falta o Client ID do Spotify (EXPO_PUBLIC_SPOTIFY_CLIENT_ID no .env). ' +
          'Desde fevereiro de 2026, o Spotify exige uma conta Premium para criar ' +
          'um app em modo de desenvolvimento.',
      );
      return;
    }
    setConnecting(true);
    promptAsync().catch(() => setConnecting(false));
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    await deleteSecureItem(STORE_KEY);
    setTokens(null);
  }, []);

  // Renova o token de acesso quando falta menos de um minuto para expirar, e
  // devolve um token pronto para uso (ou null, se não há conta conectada).
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;
    if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
    if (!refreshing.current) {
      refreshing.current = AuthSession.refreshAsync(
        { clientId: spotifyClientId, refreshToken: tokens.refreshToken },
        spotifyDiscovery,
      )
        .then(async (result) => {
          const next: SpotifyTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken ?? tokens.refreshToken,
            expiresAt: Date.now() + (result.expiresIn ?? 3600) * 1000,
          };
          await saveTokens(next);
          setTokens(next);
          return next.accessToken;
        })
        .catch(async () => {
          // Refresh token revogado ou expirado: peça para conectar de novo.
          await disconnect();
          return null;
        })
        .finally(() => {
          refreshing.current = null;
        });
    }
    return refreshing.current;
  }, [tokens, disconnect]);

  const value = useMemo(
    () => ({ tokens, connecting, connect, disconnect, getValidAccessToken }),
    [tokens, connecting, connect, disconnect, getValidAccessToken],
  );

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify(): SpotifyContextValue {
  const context = useContext(SpotifyContext);
  if (!context) throw new Error('useSpotify deve ser usado dentro de <SpotifyProvider>');
  return context;
}
