// react-native-web's Alert.alert does nothing, so the web uses the browser's own dialogs.

export function notify(title: string, message?: string): void {
  window.alert(message ? `${title}\n\n${message}` : title);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export function confirmAction(o: ConfirmOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
}
