// Lê os parâmetros da URL de retorno do login (rotafit://...#access_token=...).
// Substitui o `expo-auth-session/build/QueryParams` usado pelo guia: a partir
// do SDK 58 o pacote tem um mapa de "exports" que não expõe mais esse arquivo,
// e o import quebra. A lógica é a mesma do original (query + fragmento "#"),
// com um ajuste: o Supabase devolve falhas como "?error=...&error_description=...",
// então "error" também conta como código de erro.
export function getAuthParams(input: string): {
  errorCode: string | null;
  params: Record<string, string>;
} {
  const url = new URL(input, 'https://phony.example');
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }
  const errorCode = params.errorCode ?? params.error ?? null;
  delete params.errorCode;
  return { errorCode, params };
}
