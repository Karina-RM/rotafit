import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tint?: string; // cor de destaque do vidro (ex.: cor do time, do status)
  intensity?: number;
  opacity?: number; // 0 a 1: quanto mais alto, mais sólida a cor (menos "vidro")
  highlight?: string; // cor do brilho no topo (padrão: theme.glassHighlight)
}

// A peça-base do estilo Liquid Glass: um vidro fosco (BlurView) com um brilho
// diagonal no topo (LinearGradient) e uma borda clara fina, imitando reflexo.
// Android não desfoca de verdade como o iOS, então ali o BlurView já cai para
// uma cor semitransparente sólida — ainda assim o brilho e a borda vendem o efeito.
export function GlassSurface({
  children,
  style,
  radius = 24,
  tint,
  intensity = 40,
  opacity,
  highlight,
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const glassTint = tint ?? theme.glass;

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint={theme.mode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glassTint,
            opacity: opacity ?? (theme.mode === 'dark' ? 0.55 : 0.5),
          },
        ]}
      />
      <LinearGradient
        // Termina em BRANCO com opacidade 0, não em 'transparent': no iOS,
        // 'transparent' é preto com opacidade 0, e o degradê passava por um
        // cinza no meio (faixa acinzentada visível no tema claro).
        colors={[highlight ?? theme.glassHighlight, 'rgba(255, 255, 255, 0)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 1, borderColor: theme.glassBorder },
        ]}
      />
      <View style={{ borderRadius: radius }}>{children}</View>
    </View>
  );
}

// Sombra colorida por baixo do vidro — o "glow" que dá profundidade ao efeito.
export function glassShadow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {
      shadowColor: color,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
  }) as ViewStyle;
}
