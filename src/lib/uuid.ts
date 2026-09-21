import { randomUUID } from 'expo-crypto';

export function newId(): string {
  return randomUUID();
}
