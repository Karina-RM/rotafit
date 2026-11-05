import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { getAuthParams } from '@/utils/authUrl';

WebBrowser.maybeCompleteAuthSession();

// Link de volta para o app depois do login (esquema "rotafit://").
export const authRedirectUri = AuthSession.makeRedirectUri({ scheme: 'rotafit' });

// Login com Google, delegado ao próprio Supabase: o app nunca vê um client
// secret do Google. O Supabase (configurado em Authentication → Providers →
// Google, com as chaves do Google Cloud) devolve uma URL de login; abrimos
// essa URL numa aba controlada (WebBrowser) e, ao voltar para o app pelo
// esquema "rotafit://", extraímos os tokens da própria URL de retorno.
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUri, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Não foi possível iniciar o login com o Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUri);
  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') return; // usuário cancelou
    throw new Error('O login com o Google não foi concluído.');
  }

  const { params, errorCode } = getAuthParams(result.url);
  if (errorCode) throw new Error(params.error_description ?? errorCode);

  const { access_token: accessToken, refresh_token: refreshToken } = params;
  if (!accessToken || !refreshToken)
    throw new Error('O Google não devolveu uma sessão válida.');

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}
