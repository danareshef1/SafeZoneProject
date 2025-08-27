// =============================
// src/app/report-shelter/[id].tsx (Upgraded)
// =============================
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getUserEmail } from '../../../utils/auth';
import * as FileSystem from 'expo-file-system';

// ---- ENDPOINTS ----
const API_SHELTERS_BY_CITY =
  'https://naxldowhfc.execute-api.us-east-1.amazonaws.com/get-il-shelters'; // ?city=<name>
const SIGN_URL =
  'https://bct0wzeaba.execute-api.us-east-1.amazonaws.com/sign-upload';
const REPORTS_URL =
  'https://66pv06z732.execute-api.us-east-1.amazonaws.com/add-report';

type PickerMode = 'city' | 'shelter';
const PAGE_LIMIT = 500;
const LOAD_ALL_HARD_CAP = 25;

type Cursor = { name: string; value: any } | null;

type Severity = 'low' | 'medium' | 'high';
// Lighting scale kept simple; can be a slider later
type Lighting = 'none' | 'dim' | 'ok';

const ISSUE_OPTIONS: { id: string; label: string }[] = [
  { id: 'no_light', label: 'אין תאורה' },
  { id: 'locked_door', label: 'דלת נעולה' },
  { id: 'broken_equipment', label: 'ציוד פגום' },
  { id: 'dirty', label: 'לא נקי' },
  { id: 'flooding', label: 'הצפה' },
  { id: 'no_signage', label: 'אין שילוט' },
  { id: 'no_signal', label: 'אין קליטה' },
  { id: 'no_accessibility', label: 'נגישות חלקית/חסרה' },
];

const ShelterDetail: React.FC = () => {
  const router = useRouter();
  const { id, name, location, image } = useLocalSearchParams();

  // ---- normalize router params (מונע [object Object]) ----
  const safeParam = (v: any): string =>
    Array.isArray(v) ? String(v[0] ?? '') :
    (typeof v === 'string' || typeof v === 'number') ? String(v) : '';

  const _id       = safeParam(id);
  const _name     = safeParam(name);
  const _location = safeParam(location);
  const _image    = safeParam(image);

  // --- UI / report ---
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [reportText, setReportText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedKeys, setUploadedKeys] = useState<string[]>([]);
  const [shelter, setShelter] = useState<any>(null);

  // New structured fields
  const [issues, setIssues] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity>('low');
  const [lighting, setLighting] = useState<Lighting>('ok');
  const [capacity, setCapacity] = useState<string>(''); // numeric input as string
  const [occupancy, setOccupancy] = useState<string>('');
  const [accessibleWheelchair, setAccessibleWheelchair] = useState<boolean>(false);
  const [accessibleStroller, setAccessibleStroller] = useState<boolean>(false);

  // --- picker state ---
  const [showComboBox, setShowComboBox] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('city');

  // ערים (שלב 1)
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // מקלטים בעיר (שלב 2)
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [citySheltersFull, setCitySheltersFull] = useState<any[]>([]);
  const [citySheltersView, setCitySheltersView] = useState<any[]>([]);
  const [shelterSearch, setShelterSearch] = useState('');
  const [isLoadingShelters, setIsLoadingShelters] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [nextCursor, setNextCursor] = useState<Cursor>(null);

  // ---------- helpers ----------
  const parseResponse = async (res: Response) => {
  const text = await res.text();
  let raw: any = {};
  try { raw = JSON.parse(text); } catch { raw = text; }
  // פותחים body אם הוא מחרוזת JSON
  const data = (typeof raw?.body === 'string')
    ? (() => { try { return JSON.parse(raw.body); } catch { return raw.body; } })()
    : (raw?.body ?? raw);
  return data;
};
  const getStr = (v: any): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map(getStr).filter(Boolean).join(' ').trim();
    if (typeof v === 'object') {
      const o: any = v;
      const langCand = o.he ?? o.He ?? o['he-IL'] ?? o.en ?? o['en-US'] ?? o.name ?? o.title ?? o.label ?? '';
      if (typeof langCand === 'string' || typeof langCand === 'number') return String(langCand);
      const fullCand = o.full ?? o.text ?? o.freeform ?? o.freeformAddress ?? o.display ?? o.line1 ?? '';
      if (typeof fullCand === 'string' || typeof fullCand === 'number') return String(fullCand);
      const street = getStr(o.street) || getStr(o.address?.street) || '';
      const number = getStr(o.number) || getStr(o.address?.number) || '';
      const combined = [street, number].filter(Boolean).join(' ');
      if (combined) return combined;
      return '';
    }
    return '';
  };

  const normalizeCity = (s: string) =>
    s.replace(/[־–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();

  const getCityNameFromItem = (it: any): string =>
    getStr(it?.city) ||
    getStr(it?.location?.city) ||
    getStr(it?.town) ||
    getStr(it?.settlement) ||
    getStr(it?.municipality) ||
    '';

  const isShelterItem = (it: any): boolean =>
    !!(it?.id || it?.lat || it?.lon || it?.lng || it?.location?.lat || it?.location?.lon || it?.coords || it?.geometry);

  const getAddress = (s: any): string => {
    if (!s) return '';
    const addrObj = s.address ?? s.location ?? s.addr ?? null;
    const full = getStr(s.full) || getStr(s.text) || getStr(s.freeform) || getStr(s.freeformAddress) || getStr(s.display) || getStr(s.line1) || getStr(addrObj);
    if (full) return full;
    const street = getStr(s.street) || getStr(s?.address?.street) || getStr(s?.location?.street) || '';
    const num = getStr(s.number) || getStr(s?.address?.number) || getStr(s?.location?.number) || '';
    return [street, num].filter(Boolean).join(' ');
  };
const labelForShelter = (s: any) => {
  if (!s) return 'מקלט';
  const addr = getAddress(s);
  const nm   = getStr(s?.name) || getStr(s?.shelterName) || getStr(s?.title) || getStr(s?.Name);
  const cityTxt = getCityNameFromItem(s);

  // תמיד להעדיף כתובת, ואז שם, ואז fallback
  const main = addr || nm || 'מקלט';
  const txt = [main, cityTxt].filter(Boolean).join(' • ');
  return String(txt).replace(/\[object Object\]/g, '').trim();
};


  const keyFromUrl = (u?: string | null) => {
    if (!u) return null;
    const marker = '.amazonaws.com/';
    const i = u.indexOf(marker);
    if (i === -1) return null;
    return decodeURIComponent(u.slice(i + marker.length));
  };

  // -------- signed upload --------
  const getSignedUploadUrl = async (type: 'shelter' | 'report', contentType = 'image/jpeg') => {
    const response = await fetch(SIGN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type, contentType }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Failed to get signed URL (${response.status})`);
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (!data?.uploadUrl) throw new Error('sign response missing uploadUrl');
    return data as { uploadUrl: string; key?: string; imageUrl?: string };
  };

  const uploadImageToS3 = async (localUri: string, type: 'shelter' | 'report') => {
    const contentType = 'image/jpeg';
    const signed = await getSignedUploadUrl(type, contentType);
    const res = await FileSystem.uploadAsync(signed.uploadUrl, localUri, {
      httpMethod: 'PUT',
      headers: { 'Content-Type': contentType },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (res.status !== 200) throw new Error(`S3 upload failed (${res.status})`);
    return { key: signed.key ?? null, publicUrl: signed.imageUrl ?? null };
  };

  // ---------- הצגת המקלט בעמוד ----------
  useEffect(() => {
    const fetchSheltersForPage = async () => {
      try {
        const city = _location || _name || '';
        const url = city
          ? `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(city)}&limit=${PAGE_LIMIT}`
          : `${API_SHELTERS_BY_CITY}?limit=${PAGE_LIMIT}`;
        const res = await fetch(url);
if (!res.ok) throw new Error(`Failed to load shelters (${res.status})`);
const data = await parseResponse(res);   // ← במקום res.json()

        const items: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items) ? data.items
          : Array.isArray(data?.Items) ? data.Items
          : [];
        const found = items.find((s: any) => String(s.id) === String(_id));
        setShelter(found || {
          id: _id,
          name: _name,
          location: _location,
          image: _image,
        });
      } catch (e) {
        console.error('Error fetching shelters for page:', e);
        setShelter({ id: _id, name: _name, location: _location, image: _image });
      }
    };
    fetchSheltersForPage();
  }, [_id, _name, _location, _image]);

  // ---------- ערים ----------
  const searchCities = async (q: string) => {
    try {
      setIsSearchingCities(true);
      const url = `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(q)}&limit=${PAGE_LIMIT}`;
      const res = await fetch(url);
if (!res.ok) throw new Error(`search cities ${res.status}`);
const data = await parseResponse(res);   // ← במקום res.json()

      const raw: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.Items) ? data.Items
        : [];
      const names = Array.from(new Set(raw.map(getCityNameFromItem).filter(Boolean)));
      setCities(names);
    } catch (e) {
      console.error('searchCities error:', e);
      setCities([]);
    } finally {
      setIsSearchingCities(false);
    }
  };

  const handleCitySearchChange = (text: string) => {
    setCitySearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.trim().length < 2) { setCities([]); return; }
    debounceRef.current = setTimeout(() => searchCities(text.trim()), 350);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ---------- פאג'ינציה: איתור Items + Cursor ----------
const extractItemsAndCursor = (dataRaw: any) => {
  // dataRaw כבר אחרי parseResponse ברוב המקומות, אבל אם יגיע גולמי נפתח שוב
  const data = (typeof dataRaw?.body === 'string')
    ? (() => { try { return JSON.parse(dataRaw.body); } catch { return dataRaw; } })()
    : (dataRaw?.body ?? dataRaw);

  const items: any[] =
    Array.isArray(data) ? data :
    Array.isArray(data?.items) ? data.items :
    Array.isArray(data?.Items) ? data.Items :
    Array.isArray(data?.results) ? data.results :
    Array.isArray(data?.data) ? data.data : [];

  const CANDIDATES: Array<[string, any]> = [
    ['nextToken', data?.nextToken], ['NextToken', data?.NextToken],
    ['lastKey', data?.lastKey], ['LastKey', data?.LastKey],
    ['lastEvaluatedKey', data?.lastEvaluatedKey], ['LastEvaluatedKey', data?.LastEvaluatedKey],
    ['cursor', data?.cursor], ['next', data?.next],
    ['paginationToken', data?.paginationToken], ['continuationToken', data?.continuationToken],
    ['ExclusiveStartKey', data?.ExclusiveStartKey],
    // nested
    ['nextToken', data?.meta?.nextToken], ['next', data?.meta?.next], ['cursor', data?.meta?.cursor],
    ['next', data?.page?.next], ['cursor', data?.page?.cursor],
    ['token', data?.pagination?.token],
  ];

  let cursor: Cursor = null;
  for (const [name, val] of CANDIDATES) {
    if (val !== undefined && val !== null && val !== '') {
      cursor = { name, value: val };
      break;
    }
  }
  return { items, cursor };
};


const urlWithCursor = (base: string, cursor: Cursor) => {
  if (!cursor) return base;
  // הערך חייב להיות אותו JSON שהשרת החזיר, כמחרוזת מוצפנת
  const v = typeof cursor.value === 'string' ? cursor.value : JSON.stringify(cursor.value);
  return `${base}&startKey=${encodeURIComponent(v)}`;
};



  // ---------- טעינת מקלטי עיר ----------
  const loadSheltersOfCity = async (cityName: string, cursor: Cursor = null): Promise<Cursor> => {
    const chosen = normalizeCity(cityName);
    const chosenLow = chosen.toLowerCase();
    setIsLoadingShelters(true);
    try {
      const base = `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(chosen)}&limit=${PAGE_LIMIT}`;
     const res = await fetch(urlWithCursor(base, cursor));
if (!res.ok) throw new Error(`load city shelters ${res.status}`);
const data = await parseResponse(res);   // ← במקום res.json()

const { items, cursor: next } = extractItemsAndCursor(data);

      const sheltersOnly = items
        .filter(isShelterItem)
        .filter((s) => normalizeCity(getCityNameFromItem(s)).toLowerCase() === chosenLow);

      setCitySheltersFull((prev) => {
        const byId = new Map<string, any>();
        [...prev, ...sheltersOnly].forEach((x) => byId.set(String(x.id ?? `${x.lat},${x.lon}`), x));
        return Array.from(byId.values());
      });
      setNextCursor(next || null);
      return next || null;
    } catch (e) {
      console.error('loadSheltersOfCity error:', e);
      setNextCursor(null);
      return null;
    } finally {
      setIsLoadingShelters(false);
    }
  };

const handlePickCity = async (cityName: string) => {
  const chosen = normalizeCity(cityName);
  setSelectedCity(chosen);
  setPickerMode('shelter');
  setCities([]); setCitySheltersFull([]); setShelterSearch('');
  const first = await loadSheltersOfCity(chosen);
  // לטעון את כל העמודים באופן אוטומטי (עד LOAD_ALL_HARD_CAP):
  let guard = 0, cur = first;
  while (cur && guard < LOAD_ALL_HARD_CAP) {
    cur = await loadSheltersOfCity(chosen, cur);
    guard += 1;
  }
};

  const loadMoreInCity = async () => {
    if (selectedCity && nextCursor) await loadSheltersOfCity(selectedCity, nextCursor);
  };

  const loadAllInCity = async () => {
    if (!selectedCity) return;
    setIsLoadingAll(true);
    try {
      let guard = 0;
      let localCursor: Cursor = nextCursor;
      while (localCursor && guard < LOAD_ALL_HARD_CAP) {
        localCursor = await loadSheltersOfCity(selectedCity, localCursor);
        guard += 1;
      }
    } finally {
      setIsLoadingAll(false);
    }
  };

  const backToCityMode = () => {
    setPickerMode('city');
    setSelectedCity(null);
    setCitySheltersFull([]);
    setCitySheltersView([]);
    setShelterSearch('');
    setNextCursor(null);
  };

  // סינון מקומי בתוך העיר
  useEffect(() => {
    const q = (shelterSearch || '').toLowerCase().trim();
    if (!q) { setCitySheltersView(citySheltersFull); return; }
    setCitySheltersView(
      citySheltersFull.filter((s) => labelForShelter(s).toLowerCase().includes(q))
    );
  }, [shelterSearch, citySheltersFull]);

  const handleChangeShelter = (selectedId: string | number, item?: any) => {
    setShowComboBox(false);
    setPickerMode('city');
    setSelectedCity(null);
    setCities([]);
    setCitySheltersFull([]);
    setCitySheltersView([]);
    setCitySearch('');
    setShelterSearch('');
    setNextCursor(null);

    router.push({
      pathname: '/report-shelter/[id]',
      params: {
        id: String(selectedId),
        name: getStr(item?.name) || '',
        location: getCityNameFromItem(item) || '',
        image: getStr(item?.image) || '',
      }
    });
  };

  const handleAddImage = async () => {
    try {
      setShowComboBox(false);
      await new Promise(r => setTimeout(r, 50));

      const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        base64: false,
      });
      if (result.canceled) return;

      const localUri = result.assets?.[0]?.uri;
      if (!localUri) return;

      // הצג מקומי
      setUploadedImages(prev => [...prev, localUri]);

      // העלאה ל-S3 ושמירת ה-key
      setIsUploadingImage(true);
      const uploaded = await uploadImageToS3(localUri, 'report');
      if (uploaded?.key) {
        setUploadedKeys(prev => [...prev, uploaded.key]);
      } else {
        Alert.alert('אזהרה', 'ההעלאה הצליחה אך לא התקבל key; הדו״ח יישלח ללא קישור לתמונה.');
      }
    } catch (e: any) {
      console.error('open picker / upload image error:', e);
      Alert.alert('שגיאה', e?.message || 'כשלון בהעלאת תמונה');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImageAt = (idx: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
    setUploadedKeys(prev => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    (async () => {
      const p = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!p.granted) await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  // ---------- שליחת דיווח ----------
  const handleSubmitReport = async () => {
    try {
      setIsSubmitting(true);

      if (!reportText.trim() && issues.length === 0) {
        Alert.alert('שגיאה', 'נא להזין תיאור קצר או לבחור סוג בעיה.');
        return;
      }

      const userEmail = await getUserEmail();
      if (!userEmail) { Alert.alert('Error', 'User email not found.'); return; }

      const capacityNum = capacity ? Number(capacity) : undefined;
      const occupancyNum = occupancy ? Number(occupancy) : undefined;

      const body = {
        shelterId: shelter?.id,
        userEmail,
        description: reportText,
        imageKeys: uploadedKeys,
        issues,
        severity,
        lighting,
        capacity: Number.isFinite(capacityNum as number) ? capacityNum : undefined,
        occupancy: Number.isFinite(occupancyNum as number) ? occupancyNum : undefined,
        accessibility: {
          wheelchair: accessibleWheelchair,
          stroller: accessibleStroller,
        },
        status: 'open',
      };

      const res = await fetch(REPORTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      let data: any = {};
      try { data = JSON.parse(raw); } catch {}
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}: ${raw}`);

      Alert.alert('Success', `הדיווח נשלח${data?.reportId ? ` (מס׳: ${data.reportId})` : ''}.`);

      // reset
      setUploadedImages([]); setUploadedKeys([]); setReportText('');
      setIssues([]); setSeverity('low'); setLighting('ok'); setCapacity(''); setOccupancy('');
      setAccessibleWheelchair(false); setAccessibleStroller(false);
      setShowComboBox(false); setPickerMode('city'); setSelectedCity(null);
      setCities([]); setCitySheltersFull([]); setCitySheltersView([]);
      setCitySearch(''); setShelterSearch(''); setNextCursor(null);
      router.push('/home');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', `Error submitting report: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleIssue = (id: string) => {
    setIssues(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCancel = () => router.push('/home');

  // ---------- UI ----------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>דיווח על מקלט</Text>
      <Text style={styles.shelterName}>{shelter ? String(labelForShelter(shelter)) : 'מקלט נבחר'}</Text>

      <TouchableOpacity
        style={styles.changeShelterButton}
        onPress={() => {
          const next = !showComboBox;
          setShowComboBox(next);
          if (next) { setPickerMode('city'); setSelectedCity(null); }
        }}
      >
        <Text style={styles.changeShelterButtonText}>שינוי מקלט</Text>
      </TouchableOpacity>

      {shelter?.image && (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: String(shelter.image) }}
            style={styles.shelterImage}
            onLoadStart={() => setIsImageLoading(true)}
            onLoadEnd={() => setIsImageLoading(false)}
            blurRadius={isImageLoading ? 5 : 0}
          />
          {isImageLoading && (
            <ActivityIndicator size="large" color="#0000ff" style={styles.imageLoaderOverlay} />
          )}
        </View>
      )}

      {showComboBox && (
        <View style={styles.comboBox}>
          {pickerMode === 'city' ? (
            <>
              <TextInput
                style={styles.comboBoxInput}
                placeholder="חפשי עיר/יישוב"
                value={citySearch}
                onChangeText={handleCitySearchChange}
              />
              {isSearchingCities ? (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: '#666' }}>מחפש ערים…</Text>
                </View>
              ) : (
                <ScrollView style={styles.comboBoxList}>
                  {cities.length === 0 ? (
                    <Text style={styles.noSheltersText}>הקלידי לפחות 2 תווים כדי לחפש יישוב/עיר</Text>
                  ) : (
                    cities.map((cityName, idx) => (
                      <TouchableOpacity
                        key={cityName + idx}
                        style={styles.comboBoxItem}
                        onPress={() => handlePickCity(cityName)}
                      >
                        <Text style={styles.comboBoxItemText}>{cityName}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#555' }}>עיר נבחרת: {selectedCity}</Text>
                <TouchableOpacity disabled={isLoadingShelters || isLoadingAll} onPress={backToCityMode}>
                  <Text style={{ color: '#007bff', fontWeight: '600' }}>חזרה לעיר</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.comboBoxInput, { marginTop: 8 }]}
                placeholder="חפשי מקלט בעיר (שם/כתובת)"
                value={shelterSearch}
                onChangeText={setShelterSearch}
              />

              {isLoadingShelters && citySheltersFull.length === 0 ? (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: '#666' }}>טוען מקלטים…</Text>
                </View>
              ) : (
                <>
                  <ScrollView style={styles.comboBoxList}>
                    {citySheltersView.length === 0 ? (
                      <Text style={styles.noSheltersText}>לא נמצאו מקלטים בעיר זו</Text>
                    ) : (
                      citySheltersView.map((shelterItem) => (
                        <TouchableOpacity
                          key={shelterItem.id}
                          style={styles.comboBoxItem}
                          onPress={() => handleChangeShelter(shelterItem.id, shelterItem)}
                        >
                          <Text style={styles.comboBoxItemText}>{labelForShelter(shelterItem)}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>

                  {(nextCursor || (citySheltersFull.length && citySheltersFull.length % PAGE_LIMIT === 0)) && (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreInCity} disabled={!nextCursor || isLoadingShelters}>
                        <Text style={styles.loadMoreText}>{isLoadingShelters ? 'טוען…' : 'טען עוד מקלטים'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadAllInCity} disabled={isLoadingAll}>
                        <Text style={styles.loadMoreText}>{isLoadingAll ? 'טוען את כל המקלטים…' : 'טען את כל המקלטים בעיר'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* Structured quick options */}
      <Text style={styles.sectionTitle}>מה הבעיה?</Text>
      <View style={styles.chipsWrap}>
        {ISSUE_OPTIONS.map(opt => {
          const on = issues.includes(opt.id);
          return (
            <TouchableOpacity key={opt.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleIssue(opt.id)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Lighting */}
      <Text style={styles.sectionTitle}>תאורה</Text>
      <View style={styles.rowJustifyBetween}>
        {(['none','dim','ok'] as Lighting[]).map(l => (
          <TouchableOpacity key={l} style={[styles.lightBtn, lighting===l && styles.lightBtnOn]} onPress={() => setLighting(l)}>
            <Text style={[styles.lightText, lighting===l && styles.lightTextOn]}>
              {l==='none'?'אין': l==='dim'?'חלשה':'תקינה'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Capacity/Occupancy */}
      <Text style={styles.sectionTitle}>קיבולת ותפוסה</Text>
      <View style={styles.row}>
        <View style={[styles.numInputWrap, { marginRight: 8 }]}>
          <Text style={styles.numLabel}>קיבולת (משוער)</Text>
          <TextInput
            style={styles.numInput}
            keyboardType='numeric'
            value={capacity}
            onChangeText={setCapacity}
            placeholder='לדוגמה 120'
          />
        </View>
        <View style={styles.numInputWrap}>
          <Text style={styles.numLabel}>תפוסה (משוער)</Text>
          <TextInput
            style={styles.numInput}
            keyboardType='numeric'
            value={occupancy}
            onChangeText={setOccupancy}
            placeholder='לדוגמה 40'
          />
        </View>
      </View>

      {/* Accessibility */}
      <Text style={styles.sectionTitle}>נגישות</Text>
      <View style={styles.rowBetweenCenter}>
                <Switch value={accessibleWheelchair} onValueChange={setAccessibleWheelchair} />
        <Text style={styles.accLabel}>כיסא גלגלים</Text>
      </View>
      <View style={styles.rowBetweenCenter}>
                <Switch value={accessibleStroller} onValueChange={setAccessibleStroller} />
        <Text style={styles.accLabel}>עגלות</Text>
      </View>

      {/* Images */}
      <TouchableOpacity style={styles.addImageButton} onPress={handleAddImage} disabled={isUploadingImage}>
        {isUploadingImage ? <ActivityIndicator color="#fff" /> : <Text style={styles.addImageButtonText}>הוסף תמונה</Text>}
      </TouchableOpacity>

      {uploadedImages.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll} showsHorizontalScrollIndicator={false}>
          {uploadedImages.map((uri, index) => (
            <View key={index} style={styles.previewWrap}>
              <Image source={{ uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImageAt(index)}>
                <Text style={styles.removeImgTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Free text */}
      <TextInput
        style={styles.textInput}
        placeholder="דווח על בעיה במקלט"
        value={reportText}
        onChangeText={setReportText}
        multiline
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>שלח דיווח</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>ביטול</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:{flexGrow:1,padding:20,backgroundColor:'#fff'},
  title:{fontSize:24,fontWeight:'bold',marginBottom:10,textAlign:'center'},
  shelterName:{fontSize:18,color:'#333',marginBottom:10,textAlign:'center'},
  changeShelterButton:{backgroundColor:'#4CAF50',padding:10,borderRadius:10,alignItems:'center',marginBottom:10},
  changeShelterButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  shelterImage:{width:'100%',height:200,borderRadius:10,marginBottom:10},
  comboBox:{backgroundColor:'#f9f9f9',borderRadius:10,borderWidth:1,borderColor:'#ddd',padding:10,marginVertical:10},
  comboBoxInput:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:10,marginTop:8,marginBottom:10,fontSize:16,textAlign:'right'},
  comboBoxList:{maxHeight:260},
  comboBoxItem:{padding:10,borderBottomWidth:1,borderBottomColor:'#eee'},
  comboBoxItemText:{fontSize:16,color:'#333'},
  noSheltersText:{textAlign:'center',padding:10,color:'#666'},
  loadMoreBtn:{backgroundColor:'#eee',padding:10,borderRadius:10,alignItems:'center'},
  loadMoreText:{color:'#333',fontWeight:'600'},

  sectionTitle:{fontSize:16,fontWeight:'700',marginTop:8,marginBottom:6,textAlign:'right',color:'#222'},
chipsWrap:{
  flexDirection:'row-reverse',
  flexWrap:'wrap',
  justifyContent:'flex-start',   // עם row-reverse זה מדביק לימין
  alignContent:'flex-start',      // עטיפת שורות תתחיל גם היא מימין
  alignItems:'flex-start',
  gap:8,
  marginBottom:6,
}, chip:{
  paddingVertical:6,paddingHorizontal:12,borderRadius:18,
  backgroundColor:'#eef2f7',borderWidth:1,borderColor:'#cbd5e1',
  marginLeft:8,                   // עובד טוב עם row-reverse
  marginBottom:8,                 // ריווח בין שורות
},
  chipOn:{backgroundColor:'#0ea5e9',borderColor:'#0ea5e9'},
chipText:{
  color:'#334155',
  fontWeight:'600',
  textAlign:'right',              // טקסט בתוך הצ’יפ מיושר לימין
},  chipTextOn:{color:'#fff'},

  rowJustifyBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},
  sevBtn:{flex:1,marginHorizontal:4,backgroundColor:'#eef2f7',borderRadius:10,paddingVertical:10,alignItems:'center',borderWidth:1,borderColor:'#cbd5e1'},
  sevBtnOn:{backgroundColor:'#f59e0b',borderColor:'#f59e0b'},
  sevText:{color:'#334155',fontWeight:'700'},
  sevTextOn:{color:'#fff'},

  lightBtn:{flex:1,marginHorizontal:4,backgroundColor:'#eef2f7',borderRadius:10,paddingVertical:10,alignItems:'center',borderWidth:1,borderColor:'#cbd5e1'},
  lightBtnOn:{backgroundColor:'#22c55e',borderColor:'#22c55e'},
  lightText:{color:'#334155',fontWeight:'700'},
  lightTextOn:{color:'#fff'},

  row:{flexDirection:'row'},
  numInputWrap:{flex:1},
  numLabel:{fontSize:12,color:'#555',marginBottom:4,textAlign:'right'},
  numInput:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:10,fontSize:16,textAlign:'right'},

  rowBetweenCenter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:4},
  accLabel:{fontSize:14,color:'#333'},

  addImageButton:{backgroundColor:'#007bff',padding:10,borderRadius:10,alignItems:'center',marginTop:10,marginBottom:10},
  addImageButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  imageScroll:{flexDirection:'row',marginBottom:10},
  previewWrap:{position:'relative',marginRight:10},
  previewImage:{width:100,height:100,borderRadius:10,borderWidth:1,borderColor:'#ddd'},
  removeImgBtn:{position:'absolute',top:-6,right:-6,backgroundColor:'#ef4444',width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:0.2,shadowRadius:2},
  removeImgTxt:{color:'#fff',fontSize:12,fontWeight:'bold'},

  textInput:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:10,minHeight:100,textAlignVertical:'top',marginBottom:20,textAlign:'right'},
  buttonContainer:{flexDirection:'row',justifyContent:'space-between',marginTop:10},
  submitButton:{backgroundColor:'#4CAF50',padding:15,borderRadius:10,alignItems:'center',flex:1,marginRight:10},
  cancelButton:{backgroundColor:'#FF5722',padding:15,borderRadius:10,alignItems:'center',flex:1},
  submitButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  cancelButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  imageWrapper:{position:'relative',width:'100%',height:200,marginBottom:10,borderRadius:10,overflow:'hidden'},
  imageLoaderOverlay:{position:'absolute',top:'50%',left:'50%',marginTop:-12,marginLeft:-12},
});

export default ShelterDetail;

