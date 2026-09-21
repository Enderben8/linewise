import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AppText, Screen } from '../src/components/ui';
import { useTheme } from '../src/components/theme';
import { db } from '../src/db/client';
import { migrations } from '../src/db/migrations';
import { syncReminders } from '../src/features/notifications/reminders';
import i18n, { applyLocale } from '../src/i18n';
import { store, useAppDispatch, useAppSelector } from '../src/store';
import { draftActions } from '../src/store/draftSlice';
import { reloadMemorizations } from '../src/store/memorizationsSlice';
import { loadSettings } from '../src/store/settingsSlice';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Bootstrap() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { palette } = useTheme();
  const { success, error } = useMigrations(db, migrations);
  const hydrated = useAppSelector((s) => s.settings.hydrated);
  const settings = useAppSelector((s) => s.settings.values);
  const items = useAppSelector((s) => s.memorizations.items);
  const loaded = useAppSelector((s) => s.memorizations.loaded);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  // If the database cannot be opened, show the error screen instead of leaving the splash up.
  useEffect(() => {
    if (error) SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  useEffect(() => {
    if (!success) return;
    dispatch(loadSettings());
    dispatch(reloadMemorizations());
  }, [success, dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    applyLocale(settings.locale).finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, [hydrated, settings.locale]);

  // Reschedule every reminder on start: the phone may have restarted since they were set.
  useEffect(() => {
    if (!hydrated || !loaded) return;
    syncReminders(items, settings).catch(() => {});
    // Only on first load and when relevant settings change, not on every list edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, loaded, settings.notifications_enabled, settings.backup_reminder_enabled]);

  useEffect(() => {
    if (!hasShareIntent || !hydrated) return;
    const text = shareIntent.text ?? '';
    if (text) {
      dispatch(draftActions.setDraft({ body: text, title: shareIntent.meta?.title ?? '' }));
      router.push('/add/edit-text');
    }
    resetShareIntent();
  }, [hasShareIntent, hydrated, shareIntent, dispatch, router, resetShareIntent]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.content.data?.memorizationId;
      if (typeof id === 'string') router.push(`/memorizations/${id}`);
    });
    return () => sub.remove();
  }, [router]);

  if (error) {
    return (
      <Screen>
        <AppText variant="title">{i18n.t('errors.databaseTitle')}</AppText>
        <AppText muted>{error.message}</AppText>
      </Screen>
    );
  }
  if (!success || !hydrated) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <Bootstrap />
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
