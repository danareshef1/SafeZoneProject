// src/app/contactsButton.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity, Modal, FlatList, Text, View, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import Checkbox from 'expo-checkbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserEmail } from '../../utils/auth';

interface ContactItem {
  id: string;
  name: string;
  phoneNumbers?: { number: string }[];
}

const USER_DETAILS_URL = 'https://p0l8kgq8gk.execute-api.us-east-1.amazonaws.com/getUserDetails';

// ← החליפי ל-Invoke URL הנוכחי של המעבדה שלך
const GET_REGISTERED_URL =
  'https://rudac13hpb.execute-api.us-east-1.amazonaws.com/GetRegisteredContacts';

async function refreshRegisteredContactsNow(): Promise<string[]> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return [];

    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const phones = data
      .flatMap((c) => c.phoneNumbers || [])
      .map((p) => normPhone(p.number || ''))
      .filter(Boolean);

      log('refreshRegisteredContactsNow: sending phones count =', phones.length);
      log('refreshRegisteredContactsNow: sample phones =', phones.slice(0, 5));

const me = await getMyIdentity(); // כפי שהוספנו בצד לקוח
const res = await fetch(GET_REGISTERED_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phones,                // רשימת הטלפונים מהמכשיר
    ownerEmail: me.email,  // כדי שהשרת ישלוף את המספר שלך ויסנן
    excludePhones: me.phone ? [me.phone] : [] // חגורת בטיחות
  }),
});

    const txt = await res.text();
    log('refreshRegisteredContactsNow: status', res.status, 'ok', res.ok);
    log('refreshRegisteredContactsNow: raw', txt.slice(0, 400)); // 👈 חשוב לראות את ה-debug 
    let json: any = {};
    try { json = JSON.parse(txt); } catch {}
    const result: string[] = json.registeredPhones ?? json.registeredNumbers ?? [];
    log('refreshRegisteredContactsNow: fetched', result.length, 'registered phones');
    await AsyncStorage.setItem('registeredContacts', JSON.stringify(result));
    
    return result;
  } catch (e) {
    warn('refreshRegisteredContactsNow error:', e);
    await AsyncStorage.setItem('registeredContacts', JSON.stringify([]));
    return [];
  }
}


// ---------- logging helper ----------
const LOG_PREFIX = '[ContactsButton]';
const log = (...args: any[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: any[]) => console.warn(LOG_PREFIX, ...args);
const err = (...args: any[]) => console.error(LOG_PREFIX, ...args);

function normPhone(p: string) {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0') && d.length >= 9) return '+972' + d.slice(1);
  if (d.startsWith('972')) return '+' + d;
  if ((p || '').trim().startsWith('+')) return (p || '').trim();
  return '+' + d;
}
async function getMyIdentity() {
  const email = await getUserEmail();
  if (!email) return { email: null as string | null, phone: '', name: '' };

  try {
    const r = await fetch(`${USER_DETAILS_URL}?email=${encodeURIComponent(email)}`);
    const raw = await r.json();
    // 👇 חלק קריטי: אם הלמבדה מחזירה { body: "..." } נפענח את ה-body
    const j = typeof (raw as any)?.body === 'string' ? JSON.parse((raw as any).body) : ((raw as any)?.body ?? raw);

    const phone = normPhone(j?.phone_number || j?.phoneNumber || j?.phone || '');
    const name  = (j?.displayName || j?.name || '').toLowerCase().trim();

    return { email, phone, name };
  } catch {
    return { email, phone: '', name: '' };
  }
}

const ContactsButton = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      log('Requesting contacts permission...');
      const { status } = await Contacts.requestPermissionsAsync();
      log('Contacts permission status =', status);
      if (status !== 'granted') {
        Alert.alert('אין הרשאה', 'לא אושרה גישה לאנשי קשר');
        return;
      }

      log('Loading device contacts (with phone numbers)...');
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      log('Total contacts received from device =', data.length);

      // registeredContacts – מה שאצלך נשמר ב‑AsyncStorage (מספרים גולמיים/ברקמות)
// אחרי הטעינה מ-AsyncStorage:
let registeredNumbers: string[] = [];
try {
  const stored = await AsyncStorage.getItem('registeredContacts');
  registeredNumbers = stored ? JSON.parse(stored) : [];
  log('registeredContacts from AsyncStorage count =', registeredNumbers.length);
} catch (e) {
  warn('Failed to parse registeredContacts from AsyncStorage:', e);
}

// 👇 אם ריק – נרענן עכשיו מהשרת
if (registeredNumbers.length === 0) {
  log('registeredContacts empty → refreshing from Lambda now…');
  registeredNumbers = await refreshRegisteredContactsNow();
  log('registeredContacts after refresh =', registeredNumbers.length);
}

// --- מי המשתמש הנוכחי? מה המספר והשם שלו?
const me = await getMyIdentity();
const myPhone = me.phone;
const myName  = me.name;
log('[me] phone =', myPhone, 'name =', myName);
log('[me] local =', myPhone.startsWith('+972') ? ('0' + myPhone.slice(4)) : '');
// אל תתני לעצמך להופיע בהתאמות מהשרת
if (myPhone) {
  registeredNumbers = registeredNumbers.filter(p => normPhone(p) !== myPhone);
}

// עכשיו בונים את ה-Set אחרי הסינון
const registeredSet = new Set(registeredNumbers.map(normPhone));

// זיהוי "אני" לפי מספר – גם גרסת 0xxxx המקומית
const myPhoneLocal = myPhone.startsWith('+972') ? ('0' + myPhone.slice(4)) : '';
const isMeNumber = (n: string) => {
  const a = normPhone(n);
  return !!a && (a === myPhone || a === normPhone(myPhoneLocal));
};

// התאמת אנשי קשר שרשומים + סינון עצמי לפי מספר או לפי שם (כגיבוי)
const matchedContacts = data
  .filter(c =>
    c.phoneNumbers?.some(p => registeredSet.has(normPhone(p.number || '')))
  )
  .filter(c =>
    // לא להציג אם לאחד המספרים יש התאמה אליי
    !c.phoneNumbers?.some(p => isMeNumber(p.number || '')) &&
    // וגם לא אם השם שווה לשם שלי (best-effort)
    (!myName || (c.name || '').toLowerCase().trim() !== myName)
  );



log('Matched contacts count =', matchedContacts.length);
log('Sample registered (first 3):', registeredNumbers.slice(0,3));
if (data[0]?.phoneNumbers?.[0]?.number) {
  log('Sample device num normalized:', normPhone(data[0].phoneNumbers[0].number));
}

      setContacts(
        matchedContacts.map((contact) => ({
          id: contact.id || '',
          name: contact.name,
          phoneNumbers: contact.phoneNumbers?.map((phone) => ({
            number: phone.number || '',
          })),
        }))
      );

      try {
        const storedSelected = await AsyncStorage.getItem('selectedContacts');
        if (storedSelected) {
          const parsed = JSON.parse(storedSelected);
          setSelectedContacts(new Set(parsed));
          log('Loaded selectedContacts from AsyncStorage size =', Array.isArray(parsed) ? parsed.length : 0);
        } else {
          log('No selectedContacts in AsyncStorage');
        }
      } catch (e) {
        warn('Failed to parse selectedContacts:', e);
      }

      setModalVisible(true);
    } catch (e) {
      err('שגיאה בטעינת אנשי קשר:', e);
      Alert.alert('שגיאה', 'אירעה שגיאה בטעינת אנשי קשר');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('אין הרשאה', 'לא אושרה גישה לאנשי קשר');
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });

      let registeredNumbers = await refreshRegisteredContactsNow();

      // מי המשתמש? סינון עצמי
const me = await getMyIdentity();
const myPhone = me.phone;

      if (myPhone) {
        registeredNumbers = registeredNumbers.filter(p => normPhone(p) !== myPhone);
      }

      const registeredSet = new Set(registeredNumbers.map(normPhone));
      const myPhoneLocal = myPhone.startsWith('+972') ? ('0' + myPhone.slice(4)) : '';
      const isMeNumber = (n: string) => {
        const a = normPhone(n);
        return !!a && (a === myPhone || a === normPhone(myPhoneLocal));
      };

      const matchedContacts = data
        .filter(c => c.phoneNumbers?.some(p => registeredSet.has(normPhone(p.number || ''))))
        .filter(c => !c.phoneNumbers?.some(p => isMeNumber(p.number || '')));

      setContacts(
        matchedContacts.map(c => ({
          id: c.id || '',
          name: c.name,
          phoneNumbers: c.phoneNumbers?.map(p => ({ number: p.number || '' })),
        }))
      );
    } catch (e) {
      err('refresh error:', e);
      Alert.alert('שגיאה', 'הרענון נכשל');
    } finally {
      setRefreshing(false);
    }
  };

  // החזרת true/false להצלחת הקריאה, כולל הדפסות מלאות
  const doToggleAPICall = async (
    { id, phoneNumber, name, nextSelected }: { id: string; phoneNumber: string; name: string; nextSelected: boolean }
  ): Promise<boolean> => {
    setToggleLoading(true);
    try {
      const owner = await getUserEmail();
      log('Resolved owner from token =', owner);
      if (!owner) {
        Alert.alert('שגיאה', 'לא נמצא משתמש מחובר (owner).');
        return false;
      }

      const normalizedPhone = normPhone(phoneNumber);
      if (!normalizedPhone) {
        warn('Phone normalization returned empty for raw number =', phoneNumber);
        Alert.alert('שגיאה', 'מספר טלפון לא תקין');
        return false;
      }

      const url = nextSelected
        ? 'https://l983i479h4.execute-api.us-east-1.amazonaws.com/save-contact'
        : 'https://tjxpec1cnc.execute-api.us-east-1.amazonaws.com/remove-contact';

        const body = nextSelected
  ? { userId: owner, contactName: name, phoneNumber: normalizedPhone.replace(/\D/g,'') }
  : { userId: owner, phoneNumber: normalizedPhone.replace(/\D/g,'') };


      log(nextSelected ? 'Calling SAVE contact' : 'Calling REMOVE contact', { url, body });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // אם הוספת Authorization ל‑API, הכניסי כאן:
          // ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* לא JSON – נשמור טקסט גולמי */ }

      log('API response:', { status: res.status, ok: res.ok, body: parsed ?? text });

      if (!res.ok) {
        Alert.alert('שגיאה', `הקריאה לשרת נכשלה (status ${res.status})`);
        return false;
      }

      // וידוא מינימלי שהשרת החזיר ok או sent וכו'
      const okish = parsed?.ok === true || typeof parsed?.sent === 'number';
      if (!okish) {
        warn('Server response did not include an {ok:true}/{sent} shape');
      }

      return true;
    } catch (e) {
      err('Error in doToggleAPICall:', e);
      Alert.alert('שגיאה', 'אירעה שגיאה בהתקשרות לשרת');
      return false;
    } finally {
      setToggleLoading(false);
    }
  };

  const toggleSelect = async (id: string, phoneNumber: string, name: string) => {
    // קבענו מראש את המצב הבא
    const wasSelected = selectedContacts.has(id);
    const nextSelected = !wasSelected;
    log('toggleSelect ->', { id, name, phoneNumber, wasSelected, nextSelected });

    // עדכון אופטימי + שמירה ל‑AsyncStorage
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (nextSelected) newSet.add(id);
      else newSet.delete(id);
      AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]))
        .then(() => log('Persisted selectedContacts with size =', newSet.size))
        .catch((e) => warn('Failed to persist selectedContacts', e));
      return newSet;
    });

    // קריאה ל‑API
    const ok = await doToggleAPICall({ id, phoneNumber, name, nextSelected });

    // אם נכשל – רולבאק למצבים הקודמים
    if (!ok) {
      log('API failed – rolling back UI selection');
      setSelectedContacts((prev) => {
        const newSet = new Set(prev);
        if (wasSelected) newSet.add(id);
        else newSet.delete(id);
        AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]))
          .then(() => log('Rollback persisted selectedContacts with size =', newSet.size))
          .catch((e) => warn('Failed to persist selectedContacts (rollback)', e));
        return newSet;
      });
    }
  };

  return (
    <>
      <TouchableOpacity onPress={fetchContacts} style={styles.button}>
        {loadingContacts ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="phone" size={24} color="#fff" />
        )}
      </TouchableOpacity>
  
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
  
          {/* --- Header עם כפתור רענון --- */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>Select Contacts</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" />
              ) : (
                <MaterialIcons name="refresh" size={30} color="#11998e" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.titleUnderline} />
  
          {/* שכבת טעינה: גם בזמן רענון */}
          {(toggleLoading || refreshing) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#11998e" />
            </View>
          )}
  
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isChecked = selectedContacts.has(item.id);
              const firstNumber = item.phoneNumbers?.[0]?.number ?? '';
              return (
                <View style={styles.contactItem}>
                  <Checkbox
                    value={isChecked}
                    onValueChange={() => toggleSelect(item.id, firstNumber, item.name)}
                    style={styles.checkbox}
                  />
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {firstNumber ? <Text style={styles.contactPhone}>{firstNumber}</Text> : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: 'gray', marginTop: 20 }}>
                לא נמצאו אנשי קשר תואמים ל-registeredContacts
              </Text>
            }
          />
  
          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}  

export default ContactsButton;

const styles = StyleSheet.create({
  button: { marginRight: 15 },
  modalContainer: {
    flex: 1,
    marginTop: 50,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  titleWrapper: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  titleUnderline: {
    marginTop: 6,                  // “קצת יותר למעלה” — צמוד יותר לכותרת
    marginBottom: 16,
    width: '50%',                  // קו במרכז ברוחב נעים
    height: 4,
    backgroundColor: '#11998e',
    borderRadius: 2,
    alignSelf: 'center',
  }, 
  listContent: { paddingBottom: 80 },
  titleRow: {
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  refreshText: {
    marginLeft: 6,
    color: '#11998e',
    fontWeight: '700',
  },  
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  checkbox: { marginRight: 10 },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  contactPhone: { fontSize: 14, color: 'gray' },
  closeButton: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    backgroundColor: '#11998e', padding: 12, borderRadius: 10, width: '50%', alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: 'bold' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
});
