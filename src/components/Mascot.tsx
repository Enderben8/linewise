import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

export type MascotMood = 'happy' | 'cheer' | 'think' | 'sad';

/**
 * Wren, the Linewise mascot: a round little bird holding a pencil-shaped feather.
 * Drawn from scratch for this app.
 */
export function Mascot({ mood = 'happy', size = 120 }: { mood?: MascotMood; size?: number }) {
  const body = '#E9A93A';
  const belly = '#FFF1CF';
  const dark = '#1D2B2B';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel={`Wren, ${mood}`}>
      {/* wings, raised when cheering */}
      <G>
        <Ellipse
          cx={mood === 'cheer' ? 18 : 22}
          cy={mood === 'cheer' ? 50 : 72}
          rx="11"
          ry="20"
          fill={body}
          rotation={mood === 'cheer' ? -25 : 15}
          origin="20, 60"
        />
        <Ellipse
          cx={mood === 'cheer' ? 102 : 98}
          cy={mood === 'cheer' ? 50 : 72}
          rx="11"
          ry="20"
          fill={body}
          rotation={mood === 'cheer' ? 25 : -15}
          origin="100, 60"
        />
      </G>
      {/* body */}
      <Circle cx="60" cy="64" r="40" fill={body} />
      <Ellipse cx="60" cy="78" rx="26" ry="22" fill={belly} />
      {/* head tuft */}
      <Path d="M52 26 C54 14 60 12 62 22 C64 12 72 14 68 27 Z" fill={body} />
      {/* eyes */}
      {mood === 'sad' ? (
        <>
          <Path
            d="M40 56 Q46 50 52 56"
            stroke={dark}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M68 56 Q74 50 80 56"
            stroke={dark}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : mood === 'cheer' ? (
        <>
          <Path
            d="M40 58 Q46 48 52 58"
            stroke={dark}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M68 58 Q74 48 80 58"
            stroke={dark}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Circle cx="46" cy="55" r="6" fill="#FFFFFF" />
          <Circle cx="74" cy="55" r="6" fill="#FFFFFF" />
          <Circle
            cx={mood === 'think' ? 48 : 46}
            cy={mood === 'think' ? 52 : 56}
            r="3.2"
            fill={dark}
          />
          <Circle
            cx={mood === 'think' ? 76 : 74}
            cy={mood === 'think' ? 52 : 56}
            r="3.2"
            fill={dark}
          />
        </>
      )}
      {/* beak */}
      <Path d="M54 66 L66 66 L60 76 Z" fill="#E4572E" />
      {mood === 'sad' ? (
        <Path
          d="M52 88 Q60 82 68 88"
          stroke={dark}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
      {/* feet */}
      <Path
        d="M48 104 L48 112 M44 112 L52 112 M72 104 L72 112 M68 112 L76 112"
        stroke="#E4572E"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}
