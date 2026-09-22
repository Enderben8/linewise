import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from './ui';
import { useTheme } from './theme';

interface Props {
  /** Percent memorised, 0..1. */
  outer: number;
  /** Progress through the review plan, 0..1. */
  inner: number;
  size?: number;
}

function ring(radius: number, fraction: number) {
  const circumference = 2 * Math.PI * radius;
  const f = Math.min(1, Math.max(0, fraction));
  return { circumference, offset: circumference * (1 - f) };
}

export function ProgressRings({ outer, inner, size = 64 }: Props) {
  const { palette } = useTheme();
  const stroke = Math.max(4, size / 11);
  const rOuter = (size - stroke) / 2;
  const rInner = rOuter - stroke - 2;
  const o = ring(rOuter, outer);
  const i = ring(rInner, inner);
  const c = size / 2;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={`${Math.round(outer * 100)}%`}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={c}
          cy={c}
          r={rOuter}
          stroke={palette.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={c}
          cy={c}
          r={rOuter}
          stroke={palette.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${o.circumference} ${o.circumference}`}
          strokeDashoffset={o.offset}
        />
        <Circle
          cx={c}
          cy={c}
          r={rInner}
          stroke={palette.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={c}
          cy={c}
          r={rInner}
          stroke={palette.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${i.circumference} ${i.circumference}`}
          strokeDashoffset={i.offset}
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" scale={false} style={{ fontWeight: '700', fontSize: size / 5 }}>
          {Math.round(outer * 100)}%
        </AppText>
      </View>
    </View>
  );
}
