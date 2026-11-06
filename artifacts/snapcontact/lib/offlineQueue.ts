import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContactRequest } from './contactQueue';

const KEY = 'snapcontact.offlineQueue.v1';
const CORRUPT_KEY = `${KEY}.corrupt`;

// Every read-modify-write runs one after another, so two calls in flight cannot overwrite each
// other's changes (e.g. a save adding entries while a resume-time run removes one).
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

async function readQueue(): Promise<ContactRequest[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Keep the unreadable data aside rather than letting the next write silently replace it.
    await AsyncStorage.setItem(CORRUPT_KEY, raw);
    await AsyncStorage.removeItem(KEY);
    return [];
  }
}

export function getOfflineQueue(): Promise<ContactRequest[]> {
  return serialized(async () => {
    try {
      return await readQueue();
    } catch {
      return [];
    }
  });
}

export function addToOfflineQueue(requests: ContactRequest[]): Promise<void> {
  return serialized(async () => {
    const merged = await readQueue();
    for (const r of requests) {
      if (!merged.find(m => m.id === r.id)) merged.push(r);
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  });
}

export function clearOfflineQueue(): Promise<void> {
  return serialized(() => AsyncStorage.removeItem(KEY));
}

export function removeFromOfflineQueue(id: string): Promise<void> {
  return removeManyFromOfflineQueue([id]);
}

export function removeManyFromOfflineQueue(ids: string[]): Promise<void> {
  return serialized(async () => {
    const existing = await readQueue();
    const drop = new Set(ids);
    await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter(r => !drop.has(r.id))));
  });
}
