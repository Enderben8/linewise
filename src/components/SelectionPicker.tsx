import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { clampSelection, type ChunkSelection, type SelectionMode } from '../games/setup';
import { spacing, useTheme } from './theme';
import { AppText, Chip, Row } from './ui';

function Stepper({
  label,
  value,
  min = 0,
  max,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  testID: string;
}) {
  const { palette } = useTheme();
  const btn = (name: 'remove' | 'add', delta: number, disabled: boolean) => (
    <Pressable
      testID={`${testID}-${name === 'add' ? 'next' : 'prev'}`}
      accessibilityRole="button"
      accessibilityLabel={name === 'add' ? '+' : '-'}
      disabled={disabled}
      onPress={() => onChange(value + delta)}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surfaceAlt,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={name} size={20} color={palette.text} />
    </Pressable>
  );
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <AppText>{label}</AppText>
      <Row>
        {btn('remove', -1, value <= min)}
        <AppText style={{ minWidth: 34, textAlign: 'center', fontWeight: '700' }}>
          {value + 1}
        </AppText>
        {btn('add', 1, value >= max)}
      </Row>
    </Row>
  );
}

interface Props {
  value: ChunkSelection;
  chunkCount: number;
  speakers: string[];
  onChange: (next: ChunkSelection) => void;
}

/** Chooses one chunk, a range of chunks or all of them, plus a focus speaker for scripts. */
export function SelectionPicker({ value, chunkCount, speakers, onChange }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<ChunkSelection>) =>
    onChange(clampSelection({ ...value, ...patch }, chunkCount));
  const modes: [SelectionMode, string][] = [
    ['all', t('selection.all')],
    ['one', t('selection.one')],
    ['range', t('selection.range')],
  ];
  const last = Math.max(0, chunkCount - 1);
  return (
    <View style={{ gap: spacing.md }}>
      <Row style={{ flexWrap: 'wrap' }}>
        {modes.map(([mode, label]) => (
          <Chip
            key={mode}
            testID={`selection-${mode}`}
            label={label}
            selected={value.mode === mode}
            onPress={() => set({ mode })}
          />
        ))}
      </Row>
      {value.mode === 'one' ? (
        <Stepper
          testID="chunk"
          label={t('selection.chunk')}
          value={value.from}
          max={last}
          onChange={(v) => set({ from: v, to: v })}
        />
      ) : null}
      {value.mode === 'range' ? (
        <>
          <Stepper
            testID="from"
            label={t('selection.from')}
            value={value.from}
            max={last}
            onChange={(v) => set({ from: v })}
          />
          <Stepper
            testID="to"
            label={t('selection.to')}
            value={value.to}
            min={value.from}
            max={last}
            onChange={(v) => set({ to: v })}
          />
        </>
      ) : null}
      {speakers.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label" muted>
            {t('selection.speaker')}
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip
              label={t('selection.everyone')}
              selected={!value.speaker}
              onPress={() => set({ speaker: undefined })}
            />
            {speakers.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={value.speaker === s}
                onPress={() => set({ speaker: s })}
              />
            ))}
          </Row>
        </View>
      ) : null}
    </View>
  );
}
