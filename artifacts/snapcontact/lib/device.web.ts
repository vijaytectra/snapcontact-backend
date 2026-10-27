import { recognizeBrowserImage } from './browserOcr';
import { R } from './runtimeStrings';
import type { SaveResult } from './device';

// Web OCR is independent of native contact creation and share extensions.
export const nativeAvailable = false;
export const ocrAvailable = true;
export const recognize = recognizeBrowserImage;
export async function pendingImage(): Promise<string | null> { return null; }
export async function createContact(_name: string, _number: string): Promise<SaveResult> {
  throw new Error(R.contactsNativeOnly);
}
export async function deleteTemporaryImage(_uri: string | null) {}
export async function clearNativeImages() {}
