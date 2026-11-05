import { getAuthParams } from '@/utils/authUrl';

describe('getAuthParams', () => {
  it('lê os tokens do fragmento (#) devolvido pelo Supabase', () => {
    const { errorCode, params } = getAuthParams(
      'rotafit://#access_token=abc&refresh_token=def&token_type=bearer',
    );
    expect(errorCode).toBeNull();
    expect(params.access_token).toBe('abc');
    expect(params.refresh_token).toBe('def');
  });

  it('funciona com a URL do Expo Go (exp://IP:porta/--/)', () => {
    const { params } = getAuthParams(
      'exp://192.168.0.10:8081/--/#access_token=a1&refresh_token=r1',
    );
    expect(params.access_token).toBe('a1');
    expect(params.refresh_token).toBe('r1');
  });

  it('trata "error" do Supabase como código de erro', () => {
    const { errorCode, params } = getAuthParams(
      'rotafit://?error=access_denied&error_description=Usu%C3%A1rio+cancelou',
    );
    expect(errorCode).toBe('access_denied');
    expect(params.error_description).toBe('Usuário cancelou');
  });
});
