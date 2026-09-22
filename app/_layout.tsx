import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AppText, Screen } from '../src/components/ui';
import { useTheme } from '../src/components/theme';
import { db, initDatabase, isDatabaseBusy } from '../src/db/client';
import { migrations } from '../src/db/migrations';
import { syncReminders } from '../src/features/notifications/reminders';
import { ShareProvider, useSharedText } from '../src/features/share/ShareBridge';
import { checkForUpdate, UPDATE_CHECK_SUPPORTED } from '../src/features/updates/check';
import { currentVersion, offerUpdate } from '../src/features/updates/offer';
import i18n, { applyLocale } from '../src/i18n';
import { registerServiceWorker } from '../src/lib/serviceWorker';
import { store, useAppDispatch, useAppSelector } from '../src/store';
import { draftActions } from '../src/store/draftSlice';
import { reloadMemorizations } from '../src/store/memorizationsSlice';
import { loadSettings, updateSettings } from '../src/store/settingsSlice';

SplashScreen.preventAutoHideAsync().catch(() => {});

const WEB_COLUMN = { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' } as const;

function Bootstrap() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { palette } = useTheme();
  const { success, error } = useMigrations(db, migrations);
  const hydrated = useAppSelector((s) => s.settings.hydrated);
  const settings = useAppSelector((s) => s.settings.values);
  const items = useAppSelector((s) => s.memorizations.items);
  const loaded = useAppSelector((s) => s.memorizations.loaded);
  const { shared, clear: clearShared } = useSharedText();

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

  // Each launch, ask GitHub whether a newer release is out (Android; the web app updates itself).
  // Development builds skip it: their version is not stamped from a release tag.
  useEffect(() => {
    if (__DEV__ || !hydrated || !UPDATE_CHECK_SUPPORTED) return;
    if (!settings.update_check_enabled || !settings.onboarding_done) return;
    checkForUpdate(currentVersion())
      .then(async (update) => {
        if (!update || update.version === settings.update_dismissed_version) return;
        if (!(await offerUpdate(update))) {
          dispatch(updateSettings({ update_dismissed_version: update.version }));
        }
      })
      // Offline, or GitHub could not be reached: the next launch tries again.
      .catch(() => {});
    // Once per launch, when the settings have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!shared || !hydrated) return;
    dispatch(draftActions.setDraft({ body: shared.text, title: shared.title }));
    router.push('/add/edit-text');
    clearShared();
  }, [shared, hydrated, dispatch, router, clearShared]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
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
    // On a wide browser window the app sits in a centred, phone-to-tablet sized column.
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={Platform.OS === 'web' ? WEB_COLUMN : { flex: 1 }}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}
        >
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  // The web build opens its database asynchronously first (see src/db/client.web.ts).
  const [dbReady, setDbReady] = useState(Platform.OS !== 'web');
  const [dbError, setDbError] = useState<{ message: string; busy: boolean } | null>(null);
  useEffect(() => {
    if (dbReady) return;
    initDatabase()
      .then(() => {
        // Ask the browser not to clear Linewise's storage when disk space runs low.
        navigator.storage?.persist?.().catch(() => {});
        registerServiceWorker();
        setDbReady(true);
      })
      .catch((e: unknown) =>
        setDbError({
          message: e instanceof Error ? e.message : String(e),
          busy: isDatabaseBusy(e),
        }),
      );
  }, [dbReady]);

  if (dbError) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        {/* Plain Text: the Redux store that AppText reads is not mounted yet. */}
        <Text style={{ fontSize: 22, fontWeight: '700' }}>
          {dbError.busy ? i18n.t('errors.databaseBusyTitle') : i18n.t('errors.databaseTitle')}
        </Text>
        <Text style={{ marginTop: 8 }}>
          {dbError.busy ? i18n.t('errors.databaseBusyBody') : dbError.message}
        </Text>
        {Platform.OS === 'web' ? (
          <Text
            accessibilityRole="button"
            onPress={() => window.location.reload()}
            style={{ marginTop: 20, fontSize: 18, fontWeight: '700', color: '#0F3D3E' }}
          >
            {i18n.t('updates.reload')}
          </Text>
        ) : null}
      </View>
    );
  }
  if (!dbReady) return <View style={{ flex: 1, backgroundColor: '#0F3D3E' }} />;

  return (
    <ShareProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <Bootstrap />
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareProvider>
  );
}
