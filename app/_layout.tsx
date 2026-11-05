import { QueryClientProvider } from '@tanstack/react-query';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  Stack,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { SpotifyProvider } from '@/context/SpotifyContext';
import { ThemeProvider, useTheme } from '@/theme';
import { queryClient } from '@/lib/queryClient';

function Chrome({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  // A navegação (abas, pilha, transições) tem um tema próprio, que por padrão
  // é cinza-claro. Sem isto, no tema escuro o texto quase branco do RotaFit
  // ficava sobre o fundo cinza das abas, praticamente invisível.
  const navigationTheme = useMemo(() => {
    const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.background,
        text: theme.text,
        border: theme.border,
        notification: theme.primary,
      },
    };
  }, [theme]);
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.statusBar} />
      {children}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SpotifyProvider>
            <Chrome>
              <Stack screenOptions={{ headerShown: false }} />
            </Chrome>
          </SpotifyProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
