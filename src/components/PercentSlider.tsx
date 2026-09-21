import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from './theme';

interface Props {
  value: number; // 0..100
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  testID?: string;
}

/** Drag or tap to set a value. Also adjustable from screen readers with the increment/decrement actions. */
export function PercentSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  testID,
}: Props) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(1);

  const setFromX = (x: number) => {
    const ratio = Math.min(1, Math.max(0, x / width));
    onChange(Math.round((min + ratio * (max - min)) / step) * step);
  };

  const ratio = (value - min) / (max - min);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(Math.min(max, Math.max(min, value + dir * Math.max(step, 5))));
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
      style={{ height: 44, justifyContent: 'center', direction: 'ltr' }}
    >
      <View
        pointerEvents="none"
        style={{ height: 8, borderRadius: 4, backgroundColor: palette.surfaceAlt }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.primary,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - 28, ratio * width - 14)),
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: palette.accent,
          borderWidth: 2,
          borderColor: palette.surface,
        }}
      />
    </View>
  );
}
