import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#E9A93A', '#0F5257', '#E4572E', '#5CC0C4', '#8E5BD8', '#2E7D4F'];

/** Deterministic scatter in 0..1, so a burst looks random without calling Math.random during render. */
function spread(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function Piece({
  x,
  delay,
  color,
  drift,
  height,
}: {
  x: number;
  delay: number;
  color: string;
  drift: number;
  height: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.9,
    transform: [
      { translateX: drift * t.value },
      { translateY: -40 + (height + 60) * t.value },
      { rotate: `${t.value * 540}deg` },
    ],
  }));
  return <Animated.View style={[styles.piece, { left: x, backgroundColor: color }, style]} />;
}

/** One-shot confetti burst that covers the screen. Ignores touches. */
export function Confetti({ count = 44 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        x: spread(i, 1) * width,
        delay: spread(i, 2) * 500,
        color: COLORS[i % COLORS.length],
        drift: (spread(i, 3) - 0.5) * 120,
      })),
    [count, width],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Piece
          key={p.key}
          x={p.x}
          delay={p.delay}
          color={p.color}
          drift={p.drift}
          height={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, width: 9, height: 14, borderRadius: 2 },
});
