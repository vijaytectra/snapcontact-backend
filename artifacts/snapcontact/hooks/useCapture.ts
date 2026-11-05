import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { getLocales } from 'expo-localization';
import { getCountries, type CountryCode } from 'libphonenumber-js/max';
import { countryOptions, extractCandidates, prepareNumberCopy, validateNumber, type Candidate, type CountryOption } from '@/lib/phone';
import * as device from '@/lib/device';
import { runContactQueue } from '@/lib/contactQueue';
import { addToOfflineQueue, getOfflineQueue, clearOfflineQueue, removeFromOfflineQueue } from '@/lib/offlineQueue';
import { R } from '@/lib/runtimeStrings';

export type { Candidate, CountryOption };
type Phase = 'idle' | 'processing' | 'review' | 'saving';
type Outcome = { id: string; name: string; status: 'saved' | 'cancelled' | 'error'; message?: string };
const preferencesKey = 'snapcontact.preferences.v1';
const locale = getLocales()[0];
const inferredCountry = getCountries().includes(locale?.regionCode as CountryCode)
  ? locale.regionCode as CountryCode : 'US';

export function useCapture() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [country, setCountryState] = useState<CountryCode>(inferredCountry);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [quickCaptureActive, setQuickCaptureActive] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const countryRef = useRef(country);
  const imageRef = useRef<string | null>(null);
  const countries = useMemo(() => countryOptions(locale?.languageTag ?? 'en'), []);
  const persist = useCallback(async (nextCountry: CountryCode, nextOnboarded: boolean) => {
    try { await AsyncStorage.setItem(preferencesKey, JSON.stringify({ country: nextCountry, onboarded: nextOnboarded })); }
    catch { setError(R.preferenceWrite); }
  }, []);

  const processImage = useCallback(async (uri: string) => {
    const ticket = ++generation.current;
    busy.current = true;
    const previous = imageRef.current;
    imageRef.current = uri;
    setImageUri(uri);
    if (previous !== uri) void device.deleteTemporaryImage(previous);
    setPhase('processing'); setOcrProgress(0); setError(null); setNotice(null); setOutcomes([]); setCandidates([]); setText('');
    // Retrying cannot help when on-device reading is unavailable (e.g. Expo Go), so fail on the first try.
    const MAX_RETRIES = device.ocrAvailable ? 1 : 0;
    let lastErr: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (ticket !== generation.current) { busy.current = false; return; }
      try {
        if (attempt > 0) {
          setNotice(`Retrying recognition (attempt ${attempt + 1} of ${MAX_RETRIES + 1})…`);
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
        const recognized = await Promise.race([
          device.recognize(uri, value => {
            if (ticket === generation.current) setOcrProgress(value);
          }),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('OCR timed out. Please try a clearer image.')), 30000)),
        ]);
        if (ticket !== generation.current) { busy.current = false; return; }
        setText(recognized);
        setCandidates(extractCandidates(recognized, countryRef.current));
        setPhase('review');
        if (!recognized.trim()) setNotice(R.noReadableText);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (ticket !== generation.current) { busy.current = false; return; }
        // These native errors come out the same on every try, so show them now
        // instead of making the user sit through retries.
        const code = (err as { code?: string } | null)?.code;
        const final = attempt === MAX_RETRIES || code === 'INVALID_IMAGE' || code === 'IMAGE_TOO_LARGE';
        if (final) {
          setNotice(null);
          setError(err instanceof Error ? err.message : R.imageUnreadable);
          setPhase('review');
          break;
        }
      }
    }
    if (ticket === generation.current) busy.current = false;
  }, []);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(preferencesKey).then(value => {
      if (!live || !value) return;
      const saved = JSON.parse(value);
      if (getCountries().includes(saved.country)) { setCountryState(saved.country); countryRef.current = saved.country; }
      // Always show Get Started screen on startup/refresh
      setOnboarded(false);
    }).catch(() => { if (live) setError(R.preferenceRead); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; generation.current++; };
  }, []);

  const handleCapturedText = useCallback((capturedText: string) => {
    if (!capturedText) return;
    generation.current++;
    busy.current = false;
    imageRef.current = null;
    setImageUri(null);
    setText(capturedText);
    const extracted = extractCandidates(capturedText, countryRef.current);
    setCandidates(extracted);
    setPhase('review');
    setError(null);
    setOutcomes([]);
    if (!capturedText.trim()) {
      setNotice(R.noReadableText);
    } else {
      setNotice(R.screenCaptured);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const receive = async () => {
      if (busy.current) return;
      try {
        // Check for persistent pending Quick Capture result
        const pendingCapturedText = device.getPendingCaptureResult();
        if (pendingCapturedText) {
          handleCapturedText(pendingCapturedText);
          return;
        }
        if (imageRef.current) return;
        const pending = await device.pendingImage();
        if (pending) await processImage(pending);
      } catch (err) { setError(err instanceof Error ? err.message : R.shareUnreadable); }
    };
    void receive();
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void receive();
        if (device.quickCaptureAvailable) {
          setQuickCaptureActive(device.isQuickCaptureRunning());
        }
      }
    });
    const urlSub = Linking.addEventListener('url', () => { void receive(); });
    return () => { appSub.remove(); urlSub.remove(); };
  }, [ready, imageUri, processImage, handleCapturedText]);

  useEffect(() => {
    if (!device.quickCaptureAvailable) return;
    setQuickCaptureActive(device.isQuickCaptureRunning());

    const unsubStart = device.addQuickCaptureListener('onQuickCaptureStarted', () => {
      setQuickCaptureActive(true);
      setNotice(R.quickCaptureStarted);
    });

    const unsubStop = device.addQuickCaptureListener('onQuickCaptureStopped', () => {
      setQuickCaptureActive(false);
      setNotice(R.quickCaptureStopped);
    });

    const unsubError = device.addQuickCaptureListener('onQuickCaptureError', (data: { error?: string }) => {
      setError(data?.error || R.quickCaptureFailed);
    });

    const unsubCaptured = device.addQuickCaptureListener('onScreenCaptured', (data: { text: string }) => {
      device.clearPendingCaptureResult();
      handleCapturedText(data?.text ?? '');
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubError();
      unsubCaptured();
    };
  }, [handleCapturedText]);

  const setCountry = (code: CountryCode) => {
    if (busy.current || !getCountries().includes(code)) return;
    countryRef.current = code; setCountryState(code);
    // Preserve user edits and selections. An invalidated row cannot remain selected.
    setCandidates(rows => rows.map(row => {
      const check = validateNumber(row.number, code);
      return { ...row, valid: check.valid, formatted: check.formatted, message: check.message,
        extension: check.extension, countryLabel: check.countryLabel, country: check.country,
        callingCode: check.callingCode, countryName: check.countryName, international: check.international,
        selected: check.valid && row.selected };
    }));
    void persist(code, onboarded);
  };
  const completeOnboarding = async () => {
    setOnboarded(true);
    await persist(countryRef.current, true);
  };
  const importImage = async (source: 'library' | 'camera') => {
    if (busy.current) return;
    setError(null); setNotice(null);
    busy.current = true;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(permission.canAskAgain
            ? R.cameraDeclined
            : R.cameraBlocked);
          return;
        }
      }
      // System photo picker grants access to only the selected image; no broad library permission.
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if ((asset.fileSize ?? 0) > 25 * 1024 * 1024) throw new Error(R.imageTooLarge);
        await processImage(asset.uri);
      }
    } catch (err) { setError(err instanceof Error ? err.message : R.pickerFailed); }
    finally { busy.current = false; }
  };
  const processText = (value: string) => {
    if (busy.current) return;
    generation.current++;
    setText(value); setCandidates(extractCandidates(value, countryRef.current));
    setPhase('review'); setError(null); setNotice(null); setOutcomes([]);
  };
  const updateCandidate = (id: string, patch: { number?: string; name?: string; email?: string; website?: string; selected?: boolean }) => {
    if (busy.current) return;
    setCandidates(rows => rows.map(row => {
      if (row.id !== id) return row;
      const merged = { ...row, ...patch };
      const check = merged.number
        ? validateNumber(merged.number, countryRef.current)
        : { valid: Boolean(merged.email || merged.website), formatted: merged.email || merged.website || '', message: '', extension: undefined, countryLabel: '', country: undefined, callingCode: undefined, countryName: '', international: false };
      return { ...merged, valid: check.valid, formatted: check.formatted, message: check.message,
        extension: check.extension, countryLabel: check.countryLabel, country: check.country,
        callingCode: check.callingCode, countryName: check.countryName, international: check.international,
        selected: check.valid && (merged.selected ?? true) };
    }));
  };
  const selectAll = (selected: boolean) => {
    if (!busy.current) setCandidates(rows => rows.map(row => ({ ...row, selected: selected && row.valid })));
  };
  const saveSelected = async () => {
    if (busy.current) return;
    const chosen = candidates.filter(row => row.selected && row.valid);
    if (!chosen.length) { setError(R.selectNumber); return; }
    busy.current = true; setPhase('saving'); setError(null); setOutcomes([]); setNotice(null);
    const requests = chosen.flatMap(row => {
      const checked = validateNumber(row.number, countryRef.current);
      return checked.valid ? [{
        id: row.id, name: row.name.trim(),
        number: checked.e164 + (checked.extension ? `;ext=${checked.extension}` : ''),
      }] : [];
    });
    try {
      await runContactQueue(requests, device.createContact, result => {
        setOutcomes(old => [...old, result]);
        if (result.status === 'saved') setCandidates(old => old.map(c => c.id === result.id ? { ...c, selected: false } : c));
        if (result.status === 'cancelled') {
          setNotice(R.saveUnconfirmed);
        }
        if (result.status === 'error') setError(result.message ?? R.editorUnavailable);
      });
    } catch (err) {
      // Queue for later retry when the editor is unavailable / app interrupted
      await addToOfflineQueue(requests);
      setError(R.editorUnavailable);
    } finally { busy.current = false; setPhase('review'); }
  };
  const processOfflineQueue = useCallback(async () => {
    if (busy.current) return;
    const pending = await getOfflineQueue();
    if (!pending.length) return;
    busy.current = true;
    try {
      await runContactQueue(pending, device.createContact, result => {
        if (result.status === 'saved') void removeFromOfflineQueue(result.id);
        if (result.status === 'cancelled' || result.status === 'error') {
          // keep in queue for next attempt
        }
      });
      const remaining = await getOfflineQueue();
      if (remaining.length === 0) await clearOfflineQueue();
    } catch {
      // leave queue intact
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    processOfflineQueue();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') processOfflineQueue();
    });
    return () => sub.remove();
  }, [processOfflineQueue]);

  const clear = () => {
    if (busy.current && phase === 'saving') return;
    generation.current++; busy.current = false;
    void device.deleteTemporaryImage(imageRef.current);
    void device.clearNativeImages().catch(() => setError(R.cleanupFailed));
    imageRef.current = null; setImageUri(null); setText(''); setCandidates([]);
    setOutcomes([]); setPhase('idle'); setNotice(null); setError(null);
  };
  const action = async (id: string, kind: 'copy' | 'call' | 'whatsapp' | 'email' | 'website') => {
    const row = candidates.find(c => c.id === id);
    if (!row) return;
    if (kind === 'email') {
      if (!row.email) return;
      try {
        await Linking.openURL(`mailto:${encodeURIComponent(row.email.trim())}`);
        setNotice(R.emailOpened);
      } catch {
        setError(R.emailFailed);
      }
      return;
    }
    if (kind === 'website') {
      if (!row.website) return;
      const url = /^https?:\/\//i.test(row.website.trim())
        ? row.website.trim()
        : `https://${row.website.trim()}`;
      try {
        await Linking.openURL(url);
        setNotice(R.websiteOpened);
      } catch {
        setError(R.websiteFailed);
      }
      return;
    }
    const checked = row.number ? validateNumber(row.number, countryRef.current) : { valid: false, e164: '', extension: undefined };
    if (kind !== 'copy' && !checked.valid) { setError(R.correctNumber); return; }
    try {
      if (kind === 'copy') {
        const copyText = row.number
          ? prepareNumberCopy(row.number, countryRef.current).text
          : (row.email || row.website || '');
        if (!copyText) { setError(R.correctNumber); return; }
        await Clipboard.setStringAsync(copyText);
        setNotice(row.number ? (prepareNumberCopy(row.number, countryRef.current).valid ? R.copied : R.copiedUnvalidated) : R.copied);
      } else {
        const url = kind === 'call'
          ? `tel:${checked.e164}${checked.extension ? `,${checked.extension}` : ''}`
          : `whatsapp://send?phone=${checked.e164.replace('+', '')}`;
        await Linking.openURL(url);
        setNotice(kind === 'whatsapp' ? R.whatsappOpened : R.dialerOpened);
      }
    } catch {
      setError(kind === 'whatsapp' ? R.whatsappFailed
        : kind === 'call' ? R.dialerFailed
        : R.clipboardFailed);
    }
  };

  const toggleQuickCapture = async () => {
    if (busy.current) return;
    setError(null);
    setNotice(null);

    if (quickCaptureActive) {
      device.stopQuickCapture();
      setQuickCaptureActive(false);
      setNotice(R.quickCaptureStopped);
      return;
    }

    const hasPermission = device.hasOverlayPermission();
    if (!hasPermission) {
      setNotice(R.overlayPermissionNeeded);
      await device.requestOverlayPermission();
      return;
    }

    try {
      const started = await device.startQuickCapture();
      if (started) {
        setQuickCaptureActive(true);
        setNotice(R.quickCaptureStarted);
      } else {
        setError(R.quickCaptureFailed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : R.quickCaptureFailed);
    }
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === 'web') { setNotice(R.browserSettings); return; }
      await Linking.openSettings();
    } catch { setError(R.settingsFailed); }
  };
  const resetOnboarding = useCallback(() => {
    setOnboarded(false);
  }, []);

  return {
    ready, onboarded, country, countries, imageUri, text, candidates, phase, error, notice, outcomes,
    nativeAvailable: device.nativeAvailable, ocrAvailable: device.ocrAvailable, ocrProgress,
    quickCaptureAvailable: device.quickCaptureAvailable, quickCaptureActive, toggleQuickCapture,
    completeOnboarding, resetOnboarding, setCountry, importImage, processText,
    setText, updateCandidate, selectAll, saveSelected, clear, action, openSettings,
    retry: async () => { if (imageRef.current && !busy.current) await processImage(imageRef.current); },
    dismissError: () => { setError(null); },
  };
}
