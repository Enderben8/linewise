import { Alert } from 'react-native';

/** Shows a message with an OK button. */
export function notify(title: string, message?: string): void {
  Alert.alert(title, message);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

/** Asks the user to confirm. Resolves true when they pick the confirm button. */
export function confirmAction(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      o.title,
      o.message,
      [
        { text: o.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: o.confirmLabel,
          style: o.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
