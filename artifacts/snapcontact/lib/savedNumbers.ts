import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Numbers this app has already sent to the contact editor, keyed by E.164 (+919876543210).
 * The phone's address book is not read (by design), so this only prevents the app from saving
 * the same number twice; a contact added some other way is not known here.
 */
const KEY = 'snapcontact.savedNumbers.v1';

async function read(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function savedNumberSet(): Promise<Set<string>> {
  return new Set(Object.keys(await read()));
}

export async function rememberSavedNumbers(e164: string[]): Promise<void> {
  const map = await read();
  const now = new Date().toISOString();
  for (const number of e164) map[number] = now;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Not remembering is safe: the worst case is a duplicate the user can delete.
  }
}
