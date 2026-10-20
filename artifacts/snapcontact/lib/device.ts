import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { R } from './runtimeStrings';

export type SaveResult = { status: 'saved' | 'cancelled' };
type NativeCapture = {
  recognize(uri: string): Promise<string>;
  pendingImage(): Promise<string | null>;
  createContact(name: string, number: string): Promise<SaveResult>;
  clearImages(): Promise<void>;
};
// Optional lookup keeps Expo Go and web usable without pretending they have OCR.
const native = Platform.OS === 'web' ? null :
  requireOptionalNativeModule<NativeCapture>('SnapCapture');
export const nativeAvailable = !!native;

export async function recognize(uri: string) {
  if (!native) throw new Error(R.ocrNativeOnly);
  return native.recognize(uri);
}
export async function pendingImage() { return native?.pendingImage() ?? null; }
export async function createContact(name: string, number: string) {
  if (!native) throw new Error(R.contactsNativeOnly);
  return native.createContact(name, number);
}
export async function deleteTemporaryImage(uri: string | null) {
  // Only delete our own cached copies, never content:// or users' photo-library files.
  if (!uri || !uri.startsWith('file://') || !/\/(cache|Caches)\//.test(uri)) return;
  try { new File(uri).delete(); } catch { /* An OS cache eviction already removed it. */ }
}
export async function clearNativeImages() { await native?.clearImages(); }
