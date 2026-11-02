import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContactRequest } from './contactQueue';

const KEY = 'snapcontact.offlineQueue.v1';

export async function getOfflineQueue(): Promise<ContactRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addToOfflineQueue(requests: ContactRequest[]): Promise<void> {
  const existing = await getOfflineQueue();
  const merged = [...existing];
  for (const r of requests) {
    if (!merged.find(m => m.id === r.id)) merged.push(r);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function removeFromOfflineQueue(id: string): Promise<void> {
  const existing = await getOfflineQueue();
  await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter(r => r.id !== id)));
}
