import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { getLocales } from 'expo-localization';
import { getCountries, type CountryCode } from 'libphonenumber-js/max';
import { contextCountries, countryOptions, extractCandidates, prepareNumberCopy, validateInContext, type Candidate, type CountryOption } from '@/lib/phone';
import * as device from '@/lib/device';
import { runContactQueue } from '@/lib/contactQueue';
import { addToOfflineQueue, getOfflineQueue, removeFromOfflineQueue, removeManyFromOfflineQueue } from '@/lib/offlineQueue';
import { R } from '@/lib/runtimeStrings';
import { isProper } from '@/lib/contactSummary';
import { sanitizeName } from '@/lib/nameRules';
import { rememberSavedNumbers, savedNumberSet } from '@/lib/savedNumbers';

export type { Candidate, CountryOption };
type Phase = 'idle' | 'processing' | 'review' | 'saving';
type Outcome = { id: string; name: string; status: 'saved' | 'cancelled' | 'error'; message?: string };
const preferencesKey = 'snapcontact.preferences.v1';
const locale = getLocales()[0];
const isCountry = (code: unknown): code is CountryCode => getCountries().includes(code as CountryCode);
// Numbers follow the SIM's country first, then the phone's region setting.
const simRegion = device.simCountry();
const inferredCountry: CountryCode = isCountry(simRegion) ? simRegion
  : isCountry(locale?.regionCode) ? locale.regionCode as CountryCode : 'US';

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
  // True while the review shows a screen capture, so a declined capture can clear that result.
  const captureFromScreen = useRef(false);
  const countryRef = useRef(country);
  // Only a country the user picked overrides automatic detection on later launches.
  const countryChosen = useRef(false);
  const imageRef = useRef<string | null>(null);
  const countries = useMemo(() => countryOptions(locale?.languageTag ?? 'en'), []);
  const persist = useCallback(async (nextCountry: CountryCode, nextOnboarded: boolean) => {
    try { await AsyncStorage.setItem(preferencesKey, JSON.stringify({ country: nextCountry, onboarded: nextOnboarded, countryChosen: countryChosen.current })); }
    catch { setError(R.preferenceWrite); }
  }, []);

  // With no country chosen by the user, the country code printed on the image (e.g. +1) is the default,
  // rather than the SIM or language setting.
  const adoptImageCountry = (text: string) => {
    if (countryChosen.current) return;
    const hint = contextCountries(text)[0];
    if (hint && hint !== countryRef.current) {
      countryRef.current = hint;
      setCountryState(hint);
    }
  };

  const processImage = useCallback(async (uri: string) => {
    captureFromScreen.current = false;
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
        // The timeout is cleared once recognition settles, so no stray 30s timer is left behind.
        let ocrTimer: ReturnType<typeof setTimeout> | undefined;
        let recognized: string;
        try {
          recognized = await Promise.race([
            device.recognize(uri, value => {
              if (ticket === generation.current) setOcrProgress(value);
            }),
            new Promise<string>((_, reject) => {
              ocrTimer = setTimeout(() => reject(new Error('OCR timed out. Please try a clearer image.')), 30000);
            }),
          ]);
        } finally {
          clearTimeout(ocrTimer);
        }
        if (ticket !== generation.current) return;
        setText(recognized);
        adoptImageCountry(recognized);
        setCandidates(extractCandidates(recognized, countryRef.current));
        setPhase('review');
        if (!recognized.trim()) setNotice(R.noReadableText);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (ticket !== generation.current) return;
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
      if (saved.countryChosen === true && isCountry(saved.country)) {
        countryChosen.current = true;
        setCountryState(saved.country); countryRef.current = saved.country;
      }
      // Always show Get Started screen on startup/refresh
      setOnboarded(false);
    }).catch(() => { if (live) setError(R.preferenceRead); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; generation.current++; };
  }, []);

  /** Returns false when a save is running and the capture was not shown (the caller keeps it). */
  const handleCapturedText = useCallback((capturedText: string): boolean => {
    if (!capturedText) return true;
    // A save is still running: replacing the screen now would pull the rows out from under it.
    if (busy.current) {
      setNotice('Finish saving first. The new capture will appear once the save is done.');
      return false;
    }
    generation.current++;
    imageRef.current = null;
    setImageUri(null);
    setText(capturedText);
    captureFromScreen.current = true;
    adoptImageCountry(capturedText);
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
    return true;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const receive = async () => {
      if (busy.current) return;
      try {
        // Check for persistent pending Quick Capture result
        const pendingCapturedText = device.getPendingCaptureResult();
        if (pendingCapturedText) {
          // Cleared once shown; otherwise every return to the app would reset the review screen.
          if (handleCapturedText(pendingCapturedText)) device.clearPendingCaptureResult();
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

  // Android can kill the app while the camera is open (low memory). The photo then arrives
  // after the restart instead of from launchCameraAsync, so pick it up here.
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    ImagePicker.getPendingResultAsync().then(result => {
      if (!result || !('assets' in result) || result.canceled || !result.assets?.[0]) return;
      if (busy.current) return;
      void processImage(result.assets[0].uri);
    }).catch(() => { /* nothing pending */ });
  }, [ready, processImage]);

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
      // A declined or failed capture produced nothing: drop the earlier screen capture and its
      // "captured" message so the review does not show stale contacts as if they were new.
      setNotice(null);
      if (captureFromScreen.current) {
        captureFromScreen.current = false;
        generation.current++;
        imageRef.current = null;
        setImageUri(null);
        setText('');
        setCandidates([]);
        setOutcomes([]);
        setPhase('idle');
      }
      setError(data?.error || R.quickCaptureFailed);
    });

    const unsubCaptured = device.addQuickCaptureListener('onScreenCaptured', (data: { text: string }) => {
      // If a save is running, the capture stays stored and is shown when the save finishes.
      if (handleCapturedText(data?.text ?? '')) device.clearPendingCaptureResult();
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
    countryRef.current = code; setCountryState(code); countryChosen.current = true;
    // Preserve user edits and selections. An invalidated row cannot remain selected.
    setCandidates(rows => rows.map(row => {
      const check = validateInContext(row.number, code, row.countryHints);
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
    captureFromScreen.current = false;
    adoptImageCountry(value);
    setText(value); setCandidates(extractCandidates(value, countryRef.current));
    setPhase('review'); setError(null); setNotice(null); setOutcomes([]);
  };
  const updateCandidate = (id: string, patch: { number?: string; name?: string; email?: string; website?: string; selected?: boolean }) => {
    if (busy.current) return;
    setCandidates(rows => rows.map(row => {
      if (row.id !== id) return row;
      // Names only ever hold letters, spaces and the punctuation allowed in names (see nameRules.ts).
      const safePatch = patch.name !== undefined ? { ...patch, name: sanitizeName(patch.name) } : patch;
      const merged = { ...row, ...safePatch };
      const check = merged.number
        ? validateInContext(merged.number, countryRef.current, merged.countryHints)
        : { valid: Boolean(merged.email || merged.website), formatted: merged.email || merged.website || '', message: '', extension: undefined, countryLabel: '', country: undefined, callingCode: undefined, countryName: '', international: false };
      const updated = { ...merged, valid: check.valid, formatted: check.formatted, message: check.message,
        extension: check.extension, countryLabel: check.countryLabel, country: check.country,
        callingCode: check.callingCode, countryName: check.countryName, international: check.international };
      // A row that becomes savable (a name or number was just added) is selected, unless the user said otherwise.
      const becameProper = !isProper(row) && isProper(updated);
      const wanted = patch.selected ?? (becameProper || merged.selected === true);
      return { ...updated, selected: wanted && isProper(updated) };
    }));
  };
  const selectAll = (selected: boolean) => {
    if (!busy.current) setCandidates(rows => rows.map(row => ({ ...row, selected: selected && isProper(row) })));
  };
  const saveSelected = async () => {
    if (busy.current) return;
    const chosen = candidates.filter(row => row.selected && isProper(row));
    if (!chosen.length) { setError(R.selectNumber); return; }
    busy.current = true; setPhase('saving'); setError(null); setOutcomes([]); setNotice(null);
    // Never drop a selection silently: say how many were left out and why.
    const left = candidates.filter(row => row.selected && !isProper(row)).length;
    if (left) setNotice(`${left} selected ${left === 1 ? 'entry was' : 'entries were'} not saved: each needs a name and a valid number.`);
    const built = chosen.flatMap(row => {
      const checked = validateInContext(row.number, countryRef.current, row.countryHints);
      return checked.valid ? [{
        id: row.id, name: row.name.trim(),
        number: checked.e164 + (checked.extension ? `;ext=${checked.extension}` : ''),
      }] : [];
    });
    // Numbers this app already saved are not opened again: that is what made duplicates.
    const alreadySaved = await savedNumberSet().catch(() => new Set<string>());
    const requests = built.filter(r => !alreadySaved.has(r.number.split(';')[0]));
    const duplicates = built.length - requests.length;
    if (duplicates > 0) {
      const names = built.filter(r => alreadySaved.has(r.number.split(';')[0])).map(r => r.name || r.number);
      setNotice(`${duplicates} ${duplicates === 1 ? 'contact was' : 'contacts were'} already saved and skipped: ${names.join(', ')}.`);
    }
    if (requests.length === 0) {
      busy.current = false;
      setPhase('review');
      return;
    }
    // Persist the selection before any editor opens: if the app is killed mid-save, the
    // unfinished contacts are retried on the next launch instead of being lost.
    await addToOfflineQueue(requests).catch(() => undefined);
    // Entries left by an unfinished earlier save go out with this one, but only now that the user
    // has tapped Save. They are not reopened on their own (no editors on launch or resume).
    const onScreen = new Set(requests.map(r => r.id));
    const leftovers = (await getOfflineQueue().catch(() => [])).filter(r => !onScreen.has(r.id));
    try {
      await runContactQueue([...leftovers, ...requests], device.createContact, result => {
        setOutcomes(old => [...old, result]);
        if (result.status === 'saved') {
          const done = [...leftovers, ...requests].find(r => r.id === result.id);
          if (done) void rememberSavedNumbers([done.number.split(';')[0]]);
          void removeFromOfflineQueue(result.id).catch(() => undefined);
          setCandidates(old => old.map(c => c.id === result.id ? { ...c, selected: false } : c));
        }
        if (result.status === 'cancelled') {
          setNotice(R.saveUnconfirmed);
        }
        if (result.status === 'error') setError(result.message ?? R.editorUnavailable);
      });
    } finally {
      // Rows still on screen belong to the screen again, so their persisted copies go. Leftovers
      // that were not saved stay queued for the next Save.
      await removeManyFromOfflineQueue(requests.map(r => r.id)).catch(() => undefined);
      busy.current = false; setPhase('review');
      // A Quick Capture that arrived during the save was held back; show it now.
      const held = device.getPendingCaptureResult();
      if (held && handleCapturedText(held)) device.clearPendingCaptureResult();
    }
  };

  // Tell the user about unfinished contacts from an earlier session, without opening anything.
  useEffect(() => {
    getOfflineQueue().then(pending => {
      if (pending.length) {
        setNotice(`${pending.length} contact${pending.length === 1 ? '' : 's'} from an unfinished save will be included the next time you tap Save.`);
      }
    }).catch(() => undefined);
  }, []);

  /** Removes entries from the review list entirely (not just unticks them). */
  const removeCandidates = (ids: string[]) => {
    if (busy.current || ids.length === 0) return;
    const drop = new Set(ids);
    setCandidates(rows => rows.filter(row => !drop.has(row.id)));
  };

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
    const checked = row.number ? validateInContext(row.number, countryRef.current, row.countryHints) : { valid: false, e164: '', extension: undefined };
    if (kind !== 'copy' && !checked.valid) { setError(R.correctNumber); return; }
    try {
      if (kind === 'copy') {
        const copyText = row.number
          ? prepareNumberCopy(row.number, countryRef.current, row.countryHints).text
          : (row.email || row.website || '');
        if (!copyText) { setError(R.correctNumber); return; }
        await Clipboard.setStringAsync(copyText);
        setNotice(row.number ? (prepareNumberCopy(row.number, countryRef.current, row.countryHints).valid ? R.copied : R.copiedUnvalidated) : R.copied);
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
    setText, updateCandidate, selectAll, saveSelected, removeCandidates, clear, action, openSettings,
    retry: async () => { if (imageRef.current && !busy.current) await processImage(imageRef.current); },
    dismissError: () => { setError(null); },
  };
}
