import type { ReactNode } from 'react';

export interface SharedText {
  text: string;
  title: string;
}

/** Browsers cannot receive text shared from other apps, so on the web this is a pass-through. */
export function ShareProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

const none = { shared: null, clear: () => {} };

export function useSharedText(): { shared: SharedText | null; clear: () => void } {
  return none;
}
