import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/components/theme';
import { AppText, Card, Row, Screen } from '../../../src/components/ui';
import { FAQ_ITEMS } from '../../../src/features/settings/faqItems';

export default function FaqScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      {FAQ_ITEMS.map((key) => {
        const isOpen = open === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => setOpen(isOpen ? null : key)}
          >
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="label" style={{ flex: 1 }}>
                  {t(`faq.items.${key}.q`)}
                </AppText>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.muted}
                />
              </Row>
              {isOpen ? <AppText>{t(`faq.items.${key}.a`)}</AppText> : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
