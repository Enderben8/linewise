import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, EmptyState, Row, Screen } from '../../../../src/components/ui';
import { listSessions } from '../../../../src/db/repo';
import { monthStats } from '../../../../src/scheduler';
import { useAppSelector } from '../../../../src/store';

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<number | null>(today.getDate());
  // Measured rather than taken from the window: on the web the app sits in a narrower column.
  const [chartW, setChartW] = useState(0);

  // A cheap local query; reading it on each render keeps the chart current after a new session.
  const sessions = id ? listSessions(id) : [];
  const days = monthStats(sessions, cursor.year, cursor.month);
  if (!mem) return <EmptyState title={t('detail.notFound')} />;

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });
  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  };

  const chartH = 140;
  const barGap = 2;
  const barW = Math.max(3, chartW / days.length - barGap);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const dayDetail = selected ? days[selected - 1] : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('detail.stats') }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Button variant="ghost" label="‹" onPress={() => shift(-1)} />
        <AppText variant="heading">{monthLabel}</AppText>
        <Button variant="ghost" label="›" onPress={() => shift(1)} />
      </Row>
      <Card>
        <AppText muted>{t('stats.total', { count: total })}</AppText>
        <View
          style={{ height: chartH + 20 }}
          onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
        >
          <Svg width={chartW} height={chartH + 20}>
            {days.map((d, i) => {
              const h = d.count === 0 ? 2 : Math.max(8, (d.count / maxCount) * chartH);
              const x = i * (barW + barGap);
              const isSel = selected === d.day;
              return (
                <G key={d.day}>
                  <Rect
                    x={x}
                    y={chartH - h}
                    width={barW}
                    height={h}
                    rx={2}
                    fill={
                      d.count === 0 ? palette.surfaceAlt : isSel ? palette.accent : palette.primary
                    }
                  />
                  <Rect
                    x={x - barGap / 2}
                    y={0}
                    width={barW + barGap}
                    height={chartH + 20}
                    fill="transparent"
                    onPress={() => setSelected(d.day)}
                  />
                  {d.day === 1 || d.day % 5 === 0 ? (
                    <SvgText
                      x={x + barW / 2}
                      y={chartH + 14}
                      fontSize={10}
                      fill={palette.muted}
                      textAnchor="middle"
                    >
                      {d.day}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
        </View>
        <AppText variant="caption" muted>
          {t('stats.tapHint')}
        </AppText>
      </Card>

      {dayDetail ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">
            {new Date(cursor.year, cursor.month, dayDetail.day).toLocaleDateString(i18n.language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </AppText>
          {dayDetail.sessions.length === 0 ? (
            <AppText muted>{t('stats.noSessions')}</AppText>
          ) : null}
          {dayDetail.sessions.map((s) => (
            <Card key={s.createdAt + s.game}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="label">{t(`games.${s.game}.name`)}</AppText>
                <AppText variant="label" color={palette.primary}>
                  {Math.round(s.weightedScore * 100)}%
                </AppText>
              </Row>
              <AppText variant="caption" muted>
                {new Date(s.createdAt).toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </AppText>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
