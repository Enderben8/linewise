import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import type { ReactNode } from 'react';

export interface SharedText {
  text: string;
  title: string;
}

/** Wraps the app so Android can hand Linewise text shared from other apps. */
export function ShareProvider({ children }: { children: ReactNode }) {
  return <ShareIntentProvider>{children}</ShareIntentProvider>;
}

/** Text shared to Linewise from another app, if any, and a function to clear it once handled. */
export function useSharedText(): { shared: SharedText | null; clear: () => void } {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const text = hasShareIntent ? (shareIntent.text ?? '') : '';
  return {
    shared: text ? { text, title: shareIntent.meta?.title ?? '' } : null,
    clear: resetShareIntent,
  };
}
