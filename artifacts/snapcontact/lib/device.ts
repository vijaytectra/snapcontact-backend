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
  simCountry?(): string | null;

  hasOverlayPermission?(): boolean;
  requestOverlayPermission?(): Promise<boolean>;
  isQuickCaptureRunning?(): boolean;
  startQuickCapture?(): Promise<boolean>;
  stopQuickCapture?(): boolean;
  requestScreenCapture?(): Promise<string>;
  getPendingCaptureResult?(): string | null;
  clearPendingCaptureResult?(): boolean;

  addListener?(eventName: string, listener: (event: any) => void): { remove: () => void };
  removeListener?(eventName: string, listener: (event: any) => void): void;
};

// Optional lookup keeps Expo Go and web usable without pretending they have native capabilities.
const native = Platform.OS === 'web' ? null :
  requireOptionalNativeModule<NativeCapture>('SnapCapture');

export const nativeAvailable = !!native;
export const ocrAvailable = !!native;
export const quickCaptureAvailable = Platform.OS === 'android' && !!native?.hasOverlayPermission;

export async function recognize(uri: string, _progress?: (value: number) => void) {
  if (!native) throw new Error(R.ocrNativeOnly);
  return native.recognize(uri);
}

/** ISO country of the SIM/network (Android), or null when unknown. */
export function simCountry(): string | null {
  try { return native?.simCountry?.() ?? null; } catch { return null; }
}

export async function pendingImage() {
  return native?.pendingImage() ?? null;
}

export async function createContact(name: string, number: string) {
  if (!native) throw new Error(R.contactsNativeOnly);
  return native.createContact(name, number);
}

export async function deleteTemporaryImage(uri: string | null) {
  if (!uri || !uri.startsWith('file://') || !/\/(cache|Caches)\//.test(uri)) return;
  try { new File(uri).delete(); } catch { /* OS cache eviction handled */ }
}

export async function clearNativeImages() {
  await native?.clearImages();
}

// Quick Capture APIs for Android
export function hasOverlayPermission(): boolean {
  if (Platform.OS !== 'android' || !native?.hasOverlayPermission) return false;
  return native.hasOverlayPermission();
}

export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native?.requestOverlayPermission) return false;
  return native.requestOverlayPermission();
}

export function isQuickCaptureRunning(): boolean {
  if (Platform.OS !== 'android' || !native?.isQuickCaptureRunning) return false;
  return native.isQuickCaptureRunning();
}

export async function startQuickCapture(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native?.startQuickCapture) return false;
  return native.startQuickCapture();
}

export function stopQuickCapture(): boolean {
  if (Platform.OS !== 'android' || !native?.stopQuickCapture) return false;
  return native.stopQuickCapture();
}

export async function requestScreenCapture(): Promise<string> {
  if (Platform.OS !== 'android' || !native?.requestScreenCapture) {
    throw new Error('Quick Capture is only available on Android.');
  }
  return native.requestScreenCapture();
}

export function getPendingCaptureResult(): string | null {
  if (Platform.OS !== 'android' || !native?.getPendingCaptureResult) return null;
  return native.getPendingCaptureResult();
}

export function clearPendingCaptureResult(): boolean {
  if (Platform.OS !== 'android' || !native?.clearPendingCaptureResult) return false;
  return native.clearPendingCaptureResult();
}

export function addQuickCaptureListener(
  event: 'onQuickCaptureStarted' | 'onScreenCaptured' | 'onQuickCaptureError' | 'onQuickCaptureStopped',
  callback: (data: any) => void,
): () => void {
  if (Platform.OS !== 'android' || !native?.addListener) return () => {};
  const subscription = native.addListener(event, callback);
  return () => {
    subscription.remove();
  };
}
