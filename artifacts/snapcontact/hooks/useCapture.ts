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
    try {
      const recognized = await device.recognize(uri, value => {
        if (ticket === generation.current) setOcrProgress(value);
      });
      if (ticket !== generation.current) return;
      setText(recognized);
      setCandidates(extractCandidates(recognized, countryRef.current));
      setPhase('review');
      if (!recognized.trim()) setNotice(R.noReadableText);
    } catch (err) {
      if (ticket !== generation.current) return;
      setError(err instanceof Error ? err.message : R.imageUnreadable);
      setPhase('review');
    } finally { if (ticket === generation.current) busy.current = false; }
  }, []);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(preferencesKey).then(value => {
      if (!live || !value) return;
      const saved = JSON.parse(value);
      if (getCountries().includes(saved.country)) { setCountryState(saved.country); countryRef.current = saved.country; }
      setOnboarded(saved.onboarded === true);
    }).catch(() => { if (live) setError(R.preferenceRead); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; generation.current++; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const receive = async () => {
      if (busy.current || imageRef.current) return;
      try {
        const pending = await device.pendingImage();
        if (pending) await processImage(pending);
      } catch (err) { setError(err instanceof Error ? err.message : R.shareUnreadable); }
    };
    void receive();
    const appSub = AppState.addEventListener('change', state => { if (state === 'active') void receive(); });
    const urlSub = Linking.addEventListener('url', () => { void receive(); });
    return () => { appSub.remove(); urlSub.remove(); };
  }, [ready, imageUri, processImage]);

  const setCountry = (code: CountryCode) => {
    if (busy.current || !getCountries().includes(code)) return;
    countryRef.current = code; setCountryState(code);
    // Preserve user edits and selections. An invalidated row cannot remain selected.
    setCandidates(rows => rows.map(row => {
      const check = validateNumber(row.number, code);
      return { ...row, valid: check.valid, formatted: check.formatted, message: check.message,
        extension: check.extension, countryLabel: check.countryLabel, selected: check.valid && row.selected };
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
  const updateCandidate = (id: string, patch: { number?: string; name?: string; selected?: boolean }) => {
    if (busy.current) return;
    setCandidates(rows => rows.map(row => {
      if (row.id !== id) return row;
      const merged = { ...row, ...patch };
      const check = validateNumber(merged.number, countryRef.current);
      return { ...merged, valid: check.valid, formatted: check.formatted, message: check.message,
        extension: check.extension, countryLabel: check.countryLabel, selected: check.valid && merged.selected };
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
    try {
      const requests = chosen.flatMap(row => {
        const checked = validateNumber(row.number, countryRef.current);
        return checked.valid ? [{
          id: row.id, name: row.name.trim(),
          number: checked.e164 + (checked.extension ? `;ext=${checked.extension}` : ''),
        }] : [];
      });
      await runContactQueue(requests, device.createContact, result => {
        setOutcomes(old => [...old, result]);
        if (result.status === 'saved') setCandidates(old => old.map(c => c.id === result.id ? { ...c, selected: false } : c));
        if (result.status === 'cancelled') {
          setNotice(R.saveUnconfirmed);
        }
        if (result.status === 'error') setError(result.message ?? R.editorUnavailable);
      });
    } finally { busy.current = false; setPhase('review'); }
  };
  const clear = () => {
    if (busy.current && phase === 'saving') return;
    generation.current++; busy.current = false;
    void device.deleteTemporaryImage(imageRef.current);
    void device.clearNativeImages().catch(() => setError(R.cleanupFailed));
    imageRef.current = null; setImageUri(null); setText(''); setCandidates([]);
    setOutcomes([]); setPhase('idle'); setNotice(null); setError(null);
  };
  const action = async (id: string, kind: 'copy' | 'call' | 'whatsapp') => {
    const row = candidates.find(c => c.id === id);
    if (!row) return;
    const checked = validateNumber(row.number, countryRef.current);
    if (kind !== 'copy' && !checked.valid) { setError(R.correctNumber); return; }
    try {
      if (kind === 'copy') {
        const copy = prepareNumberCopy(row.number, countryRef.current);
        if (!copy.text) { setError(R.correctNumber); return; }
        await Clipboard.setStringAsync(copy.text);
        setNotice(copy.valid ? R.copied : R.copiedUnvalidated);
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
  const openSettings = async () => {
    try {
      if (Platform.OS === 'web') { setNotice(R.browserSettings); return; }
      await Linking.openSettings();
    } catch { setError(R.settingsFailed); }
  };
  return {
    ready, onboarded, country, countries, imageUri, text, candidates, phase, error, notice, outcomes,
    nativeAvailable: device.nativeAvailable, ocrAvailable: device.ocrAvailable, ocrProgress, completeOnboarding, setCountry, importImage, processText,
    setText, updateCandidate, selectAll, saveSelected, clear, action, openSettings,
    retry: async () => { if (imageRef.current && !busy.current) await processImage(imageRef.current); },
    dismissError: () => { setError(null); },
  };
}
