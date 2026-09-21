import { Redirect } from 'expo-router';
import { useAppSelector } from '../src/store';

/** First launch goes to onboarding, everything after that to the tabs. */
export default function Index() {
  const done = useAppSelector((s) => s.settings.values.onboarding_done);
  return <Redirect href={done ? '/(tabs)/memorizations' : '/onboarding'} />;
}
