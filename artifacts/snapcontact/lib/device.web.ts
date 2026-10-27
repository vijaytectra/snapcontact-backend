import { recognizeBrowserImage } from './browserOcr';
import { R } from './runtimeStrings';
import type { SaveResult } from './device';

// Web OCR is independent of native contact creation, share extensions, and overlay capture.
export const nativeAvailable = false;
export const ocrAvailable = true;
export const quickCaptureAvailable = false;
export const recognize = recognizeBrowserImage;

export async function pendingImage(): Promise<string | null> {
  return null;
}

export async function createContact(_name: string, _number: string): Promise<SaveResult> {
  throw new Error(R.contactsNativeOnly);
}

export async function deleteTemporaryImage(_uri: string | null) {}

export async function clearNativeImages() {}

export function hasOverlayPermission(): boolean {
  return false;
}

export async function requestOverlayPermission(): Promise<boolean> {
  return false;
}

export function isQuickCaptureRunning(): boolean {
  return false;
}

export async function startQuickCapture(): Promise<boolean> {
  return false;
}

export function stopQuickCapture(): boolean {
  return false;
}

export async function requestScreenCapture(): Promise<string> {
  throw new Error('Quick Capture is only available on Android.');
}

export function getPendingCaptureResult(): string | null {
  return null;
}

export function clearPendingCaptureResult(): boolean {
  return false;
}

export function addQuickCaptureListener(
  _event: 'onQuickCaptureStarted' | 'onScreenCaptured' | 'onQuickCaptureError' | 'onQuickCaptureStopped',
  _callback: (data: any) => void,
): () => void {
  return () => {};
}
