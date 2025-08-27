// src/app/report-shelter/[id].tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getUserEmail } from '../../../utils/auth';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

// ---- ENDPOINTS (לא משנים בקאנד) ----
const API_SHELTERS_BY_CITY =
  'https://naxldowhfc.execute-api.us-east-1.amazonaws.com/get-il-shelters'; // ?city=<name>
const SIGN_URL =
  'https://bct0wzeaba.execute-api.us-east-1.amazonaws.com/sign-upload';     // POST
const REPORTS_URL =
  'https://66pv06z732.execute-api.us-east-1.amazonaws.com/add-report';      // POST

type PickerMode = 'city' | 'shelter';

const ShelterDetail: React.FC = () => {
  const router = useRouter();
  const { id, name, location, image } = useLocalSearchParams();

  // --- UI state ---
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // --- report state ---
  const [reportText, setReportText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedKeys, setUploadedKeys] = useState<string[]>([]);

  // --- shelter displayed on page ---
  const [shelter, setShelter] = useState<any>(null);

  // --- picker ---
  const [showComboBox, setShowComboBox] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('city');

  // עיר (שלב 1)
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // מקלטים בעיר (שלב 2)
  const [citySheltersFull, setCitySheltersFull] = useState<any[]>([]);
  const [citySheltersView, setCitySheltersView] = useState<any[]>([]);
  const [shelterSearch, setShelterSearch] = useState('');
  const [isLoadingShelters, setIsLoadingShelters] = useState(false);

  // pagination גנרי אם השרת תומך
  const [nextCursor, setNextCursor] = useState<{ name: string; value: any } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- helpers ----------
  const getStr = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      const cand = v.he || v.He || v['he-IL'] || v.name || v.en || v['en-US'];
      if (typeof cand === 'string') return cand;
    }
    return '';
  };

  const normalizeCity = (s: string) =>
    s.replace(/[־–—]/g, '-')       // דשים שונים
     .replace(/\s*-\s*/g, '-')     // רווחים סביב מקף
     .replace(/\s+/g, ' ')
     .trim();

  const getCityNameFromItem = (it: any): string =>
    getStr(it.city) ||
    getStr(it?.location?.city) ||
    getStr(it.location) ||
    getStr(it.town) ||
    getStr(it.settlement) ||
    getStr(it.municipality) ||
    '';

  const isShelterItem = (it: any): boolean =>
    !!(it?.id || it?.lat || it?.lon || it?.lng ||
       it?.location?.lat || it?.location?.lon || it?.coords || it?.geometry);

  const getAddress = (s: any): string => {
    const street = getStr(s.street) || getStr(s?.address?.street) || getStr(s.address);
    const num = getStr(s.number) || getStr(s?.address?.number) || '';
    return [street, num].filter(Boolean).join(' ');
  };

  const labelForShelter = (s: any) => {
    if (!s) return '';
    const nm = getStr(s.name) || getStr(s.shelterName) || getStr(s.title) || getStr(s.Name);
    const cityTxt = getCityNameFromItem(s);
    const addr = getAddress(s);
    return [nm || addr || 'מקלט', cityTxt].filter(Boolean).join(' • ');
  };

  const keyFromUrl = (u?: string | null) => {
    if (!u) return null;
    const marker = '.amazonaws.com/';
    const i = u.indexOf(marker);
    if (i === -1) return null;
    return decodeURIComponent(u.slice(i + marker.length));
  };

  const getSignedUploadUrl = async (type: 'shelter' | 'report') => {
    const response = await fetch(SIGN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Failed to get signed URL (${response.status})`);
    return JSON.parse(text);
  };

  const uploadImageToS3 = async (localUri: string, type: 'shelter' | 'report') => {
    const signed = await getSignedUploadUrl(type);
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const buffer = Buffer.from(base64, 'base64');
    await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: buffer });
    const key = signed.key || keyFromUrl(signed.imageUrl);
    return { url: signed.imageUrl, key };
  };

  // ---------- טוען את תצוגת המקלט הנוכחי ----------
  useEffect(() => {
    const fetchSheltersForPage = async () => {
      try {
        const city =
          (typeof location === 'string' && location) ||
          (typeof name === 'string' && name) || '';
        const url = city
          ? `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(city)}`
          : API_SHELTERS_BY_CITY;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load shelters (${res.status})`);
        const data = await res.json();
        const items: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items) ? data.items
          : Array.isArray(data?.Items) ? data.Items
          : [];

        const found = items.find((s: any) => String(s.id) === String(id));
        if (found) {
          setShelter(found);
          setReportText(found.reportText || '');
          setUploadedImages(found.images || []);
        } else {
          setShelter({
            id: id ?? '',
            name: name ?? '',
            location: location ?? '',
            image: image ?? '',
          });
        }
      } catch (e) {
        console.error('Error fetching shelters for page:', e);
        setShelter({
          id: id ?? '',
          name: name ?? '',
          location: location ?? '',
          image: image ?? '',
        });
      }
    };
    fetchSheltersForPage();
  }, [id, name, location, image]);

  // ---------- שלב 1: חיפוש ערים ----------
  const searchCities = async (q: string) => {
    try {
      setIsSearchingCities(true);
      const url = `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`search cities ${res.status}`);
      const data = await res.json();
      const raw: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.Items) ? data.Items
        : [];

      const names = Array.from(
        new Set(raw.map(getCityNameFromItem).filter(Boolean))
      );
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

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ---------- שלב 2: טעינת מקלטים לעיר שנבחרה ----------
  const parseCursor = (data: any): { name: string; value: any } | null => {
    if (!data) return null;
    if (data.nextToken) return { name: 'nextToken', value: data.nextToken };
    if (data.lastKey) return { name: 'lastKey', value: data.lastKey };
    if (data.LastEvaluatedKey) return { name: 'lastKey', value: data.LastEvaluatedKey };
    if (data.lastEvaluatedKey) return { name: 'lastKey', value: data.lastEvaluatedKey };
    return null;
  };

  const urlWithCursor = (base: string, cursor: {name: string; value: any} | null) => {
    if (!cursor) return base;
    const v = typeof cursor.value === 'string' ? cursor.value : JSON.stringify(cursor.value);
    return `${base}&${cursor.name}=${encodeURIComponent(v)}`;
    // אם השם שונה בשרת, לא ישתמשו בכפתור „טען עוד”
  };

  const loadSheltersOfCity = async (cityName: string, cursor: {name: string; value: any} | null = null) => {
    const chosen = normalizeCity(cityName);
    const chosenLow = chosen.toLowerCase();

    setIsLoadingShelters(true);
    try {
      const base = `${API_SHELTERS_BY_CITY}?city=${encodeURIComponent(chosen)}`;
      const res = await fetch(urlWithCursor(base, cursor));
      if (!res.ok) throw new Error(`load city shelters ${res.status}`);
      const data = await res.json();

      const items: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.Items) ? data.Items
        : [];

      // מקלטים אמיתיים בלבד, ורק של העיר שנבחרה
      const sheltersOnly = items
        .filter(isShelterItem)
        .filter((s) => normalizeCity(getCityNameFromItem(s)).toLowerCase() === chosenLow);

      const next = parseCursor(data);

      // מיזוג לתוך ה־full
      setCitySheltersFull((prev) => {
        // מניעת כפילויות לפי id
        const byId = new Map<string, any>();
        [...prev, ...sheltersOnly].forEach((x) => byId.set(String(x.id ?? `${x.lat},${x.lon}`), x));
        return Array.from(byId.values());
      });

      setNextCursor(next);
    } catch (e) {
      console.error('loadSheltersOfCity error:', e);
      setCitySheltersFull([]);
      setNextCursor(null);
    } finally {
      setIsLoadingShelters(false);
    }
  };

  // בחירת עיר
  const handlePickCity = async (cityName: string) => {
    const chosen = normalizeCity(cityName);
    setSelectedCity(chosen);
    setPickerMode('shelter');
    setCities([]);
    setCitySheltersFull([]);
    setShelterSearch('');
    await loadSheltersOfCity(chosen); // עמוד ראשון
  };

  const loadMoreInCity = async () => {
    if (selectedCity && nextCursor) {
      await loadSheltersOfCity(selectedCity, nextCursor);
    }
  };

  // חזרה לבחירת עיר
  const backToCityMode = () => {
    setPickerMode('city');
    setSelectedCity(null);
    setCitySheltersFull([]);
    setCitySheltersView([]);
    setShelterSearch('');
    setNextCursor(null);
  };

  // סינון מקומי ברשימת מקלטי העיר
  useEffect(() => {
    const q = (shelterSearch || '').toLowerCase().trim();
    if (!q) { setCitySheltersView(citySheltersFull); return; }
    setCitySheltersView(
      citySheltersFull.filter((s) => labelForShelter(s).toLowerCase().includes(q))
    );
  }, [shelterSearch, citySheltersFull]);

  // ---------- ניווט למקלט שנבחר ----------
  const handleChangeShelter = (selectedId: string | number) => {
    setShowComboBox(false);
    setPickerMode('city');
    setSelectedCity(null);
    setCities([]);
    setCitySheltersFull([]);
    setCitySheltersView([]);
    setCitySearch('');
    setShelterSearch('');
    setNextCursor(null);
    router.push({ pathname: '/report-shelter/[id]', params: { id: String(selectedId) } });
  };

  // ---------- תמונה ----------
  const handleAddImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need permission to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled) return;

    try {
      setIsUploadingImage(true);
      const localUri = result.assets[0].uri;
      const uploaded = await uploadImageToS3(localUri, 'report');
      setUploadedImages((prev) => [...prev, uploaded.url]);
      if (uploaded.key) setUploadedKeys((prev) => [...prev, uploaded.key]);
      else Alert.alert('Warning', 'לא הצלחתי לחלץ מפתח תמונה; הדו״ח יישלח בלי קישור לתמונה.');
    } catch (e) {
      console.error('Image upload failed:', e);
      Alert.alert('Error', 'Image upload failed.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ---------- שליחת דיווח ----------
  const handleSubmitReport = async () => {
    try {
      setIsSubmitting(true);
      const userEmail = await getUserEmail();
      if (!userEmail) { Alert.alert('Error', 'User email not found.'); return; }

      const firstImageKey = uploadedKeys[0] || null;

      const res = await fetch(REPORTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          shelterId: shelter?.id,
          userEmail,
          description: reportText,
          imageKey: firstImageKey,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try { data = JSON.parse(raw); } catch {}
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}: ${raw}`);

      Alert.alert('Success',
        `Your report has been submitted${data?.reportId ? ` (ID: ${data.reportId})` : ''}.`
      );

      setUploadedImages([]); setUploadedKeys([]); setReportText('');
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

  const handleCancel = () => router.push('/home');

  // ---------- UI ----------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>דיווח על מקלט</Text>
      <Text style={styles.shelterName}>
        {shelter ? labelForShelter(shelter) : 'מקלט נבחר'}
      </Text>

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
            source={{ uri: shelter.image }}
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
                    <Text style={styles.noSheltersText}>
                      הקלידי לפחות 2 תווים כדי לחפש יישוב/עיר
                    </Text>
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
                <Text style={{ fontSize: 14, color: '#555' }}>
                  עיר נבחרת: {selectedCity}
                </Text>
                <TouchableOpacity onPress={backToCityMode}>
                  <Text style={{ color: '#007bff', fontWeight: '600' }}>חזרה לעיר</Text>
                </TouchableOpacity>
              </View>

              {/* שדה חיפוש מקומי בתוך העיר */}
              <TextInput
                style={[styles.comboBoxInput, { marginTop: 8 }]}
                placeholder="חפשי מקלט בעיר (שם/כתובת)"
                value={shelterSearch}
                onChangeText={setShelterSearch}
              />

              {isLoadingShelters ? (
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
                          onPress={() => handleChangeShelter(shelterItem.id)}
                        >
                          <Text style={styles.comboBoxItemText}>
                            {labelForShelter(shelterItem)}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>

                  {/* כפתור „טען עוד” אם השרת מחזיר עמודים */}
                  {nextCursor && citySheltersView.length > 0 && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreInCity}>
                      <Text style={styles.loadMoreText}>טען עוד מקלטים</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.addImageButton} onPress={handleAddImage} disabled={isUploadingImage}>
        {isUploadingImage ? <ActivityIndicator color="#fff" /> : <Text style={styles.addImageButtonText}>הוסף תמונה</Text>}
      </TouchableOpacity>

      {uploadedImages.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {uploadedImages.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.previewImage} />
          ))}
        </ScrollView>
      )}

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
  loadMoreBtn:{marginTop:10,backgroundColor:'#eee',padding:10,borderRadius:10,alignItems:'center'},
  loadMoreText:{color:'#333',fontWeight:'600'},
  addImageButton:{backgroundColor:'#007bff',padding:10,borderRadius:10,alignItems:'center',marginBottom:20},
  addImageButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  imageScroll:{flexDirection:'row',marginBottom:10},
  previewImage:{width:100,height:100,marginRight:10,borderRadius:10},
  textInput:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:10,height:100,textAlignVertical:'top',marginBottom:20,textAlign:'right'},
  buttonContainer:{flexDirection:'row',justifyContent:'space-between',marginTop:20},
  submitButton:{backgroundColor:'#4CAF50',padding:15,borderRadius:10,alignItems:'center',flex:1,marginRight:10},
  cancelButton:{backgroundColor:'#FF5722',padding:15,borderRadius:10,alignItems:'center',flex:1},
  submitButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  cancelButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  imageWrapper:{position:'relative',width:'100%',height:200,marginBottom:10,borderRadius:10,overflow:'hidden'},
  imageLoaderOverlay:{position:'absolute',top:'50%',left:'50%',marginTop:-12,marginLeft:-12},
});

export default ShelterDetail;
