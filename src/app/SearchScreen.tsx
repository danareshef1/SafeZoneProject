import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { getUserEmail } from '../../utils/auth';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { findUserZone, AlertZone } from '../../utils/zoneUtils';

const GET_USER_LOCATION = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/get-user-location';
const GET_ALL_ZONES = 'https://4i7xc6hael.execute-api.us-east-1.amazonaws.com/GetAllAlertZones';
const GET_ALERT_LOGS = 'https://rvx1waqqmj.execute-api.us-east-1.amazonaws.com/get-alerts-logs';

function parseMaybeWrappedJSON(payload: any): any {
  // מחזיר payload "שטוח" גם אם השרת עוטף ב-body (או body מחרוזת)
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.body)) return payload.body;
  if (typeof payload?.body === 'string') {
    try {
      const j = JSON.parse(payload.body);
      return Array.isArray(j) || typeof j === 'object' ? j : payload;
    } catch {
      return payload;
    }
  }
  return payload;
}

function normalizeStr(s?: string | null) {
  return (s || '').replace(/[\"״]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseTsToMs(s: any): number {
  if (!s) return 0;
  if (typeof s !== 'string') return 0;

  // ISO?
  if (/[TZ]/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  // "YYYY-MM-DD HH:mm:ss"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, yy, mm, dd, hh, mi, ss] = m.map(Number);
    const d = new Date(yy, mm - 1, dd, hh, mi, ss); // זמן מקומי של המכשיר
    return d.getTime();
  }
  // fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function EmergencyStatusScreen() {
  const [userZone, setUserZone] = useState<AlertZone | null>(null);
  const [zones, setZones] = useState<AlertZone[]>([]);
  const [filteredZones, setFilteredZones] = useState<AlertZone[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<AlertZone | null>(null);
  const [alertsCount, setAlertsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // הבאה ראשונית של אזורים + אזור המשתמש
  useEffect(() => {
    (async () => {
      try {
        const email = await getUserEmail();
        if (!email) throw new Error('missing email');

        // מיקום משתמש
        const ures = await fetch(`${GET_USER_LOCATION}?email=${encodeURIComponent(email)}`);
        const ujson = parseMaybeWrappedJSON(await ures.json());
        const ulat = Number(ujson?.lat);
        const ulng = Number(ujson?.lng);
        const ucity = ujson?.city;

        // כל האזורים
        const zres = await fetch(GET_ALL_ZONES);
        const zjson = parseMaybeWrappedJSON(await zres.json());

        let zonesArray: AlertZone[] = [];
        if (Array.isArray(zjson)) zonesArray = zjson as AlertZone[];
        else if (Array.isArray(zjson?.zones)) zonesArray = zjson.zones as AlertZone[]; // למקרה שהשרת מחזיר { zones: [...] }

        if (!Array.isArray(zonesArray)) {
          throw new Error('המידע על האזורים אינו מערך');
        }

        setZones(zonesArray);

        if (!isNaN(ulat) && !isNaN(ulng)) {
          const closest = findUserZone(ulat, ulng, zonesArray, ucity);
          if (closest) {
            setUserZone(closest);
          }
        }
      } catch (e) {
        console.error('שגיאה בטעינת האזורים/מיקום:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // סינון חיפוש
  useEffect(() => {
    const q = normalizeStr(searchQuery);
    if (!q) return setFilteredZones([]);
    const out = zones
      .filter(
        (z) =>
          normalizeStr(z.name).includes(q) ||
          normalizeStr(z.zone).includes(q)
      )
      .slice(0, 100);
    setFilteredZones(out);
  }, [searchQuery, zones]);

  // טעינת מונה האזעקות עבור אזור נוכחי/נבחר
  useEffect(() => {
    (async () => {
      const z = selectedZone || userZone;
      if (!z) return;
      const count = await getAlertsForZone(z);
      setAlertsCount(count);
    })();
  }, [userZone, selectedZone]);

  const lastMonthMs = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }, []);

  async function getAlertsForZone(zone: AlertZone): Promise<number> {
    try {
      const res = await fetch(GET_ALERT_LOGS);
      const j = parseMaybeWrappedJSON(await res.json());
      const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];

      const targetA = normalizeStr(zone.name);
      const targetB = normalizeStr(zone.zone);

      const alertsInZone = arr.filter((alert: any) => {
        const cityStr = normalizeStr(alert?.city);
        const tsMs = parseTsToMs(alert?.timestamp || alert?.ts || alert?.createdAt);
        if (!cityStr || !tsMs) return false;

        // התאמה אם שם היישוב/שם האזור מופיע בעיר שב-לוג
        const matchCity =
          (targetA && cityStr.includes(targetA)) ||
          (targetB && cityStr.includes(targetB));

        return matchCity && tsMs >= lastMonthMs;
      });

      return alertsInZone.length;
    } catch (e) {
      console.error('שגיאה בטעינת האזעקות:', e);
      return 0;
    }
  }

  function handleZoneSelect(zone: AlertZone) {
    setSelectedZone(zone);
    setSearchQuery(zone.name || zone.zone || '');
    setFilteredZones([]);
    Keyboard.dismiss();
  }

  function renderZone(zone: AlertZone) {
    const countdown = (zone as any).countdown; // ייתכן שלא קיים בסכמה שלך
    const countdownText =
      countdown === 0 ? 'מיידי' :
      typeof countdown === 'number' ? `${countdown} שניות` :
      '—';

    return (
      <View key={String(zone.id ?? zone.zone)} style={styles.zoneBox}>
        <View style={styles.zoneHeader}>
          <Ionicons name="location-sharp" size={24} color="#11998e" />
          <Text style={styles.zoneName}>
            {zone.name || 'לא ידוע'} | {zone.zone || 'לא ידוע'}
          </Text>
        </View>

        <View style={styles.section}>
          <Ionicons name="timer" size={20} color="#11998e" />
          <Text style={styles.sectionLabel}>זמן כניסה למרחב מוגן:</Text>
          <Text style={styles.sectionValue}>{countdownText}</Text>
        </View>

        <View style={styles.section}>
          <Ionicons name="notifications" size={20} color="#11998e" />
          <Text style={styles.sectionLabel}>אזעקות בחודש האחרון:</Text>
          <Text style={styles.sectionValue}>
            {alertsCount !== null ? alertsCount : '—'}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#11998e" style={{ marginTop: 50 }} />;
  }

  return (
    <View style={styles.container}>
      {userZone && !selectedZone && (
        <View style={styles.currentZoneContainer}>
          <Text style={styles.currentZoneTitle}>האזור שלך כרגע:</Text>
          {renderZone(userZone)}
        </View>
      )}

      <Text style={styles.title}>חפש אזורים נוספים</Text>
      <View style={styles.searchWrapper}>
        <FontAwesome name="search" size={20} color="#11998e" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם או אזור"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      {filteredZones.length > 0 && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredZones}
          keyExtractor={(item) => String(item.id ?? item.zone)}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleZoneSelect(item)}>
              <View style={styles.searchItem}>
                <Ionicons name="search" size={18} color="#11998e" />
                <Text style={styles.searchText}>{item.name || item.zone || 'לא ידוע'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedZone && (
        <View style={styles.selectedZoneContainer}>
          <Text style={styles.selectedZoneTitle}>
            סטטוס נוכחי עבור {selectedZone.name || selectedZone.zone}
          </Text>
          {renderZone(selectedZone)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,                // חשוב כדי ש-FlatList יקרוס נכון בגובה
    padding: 20,
    backgroundColor: '#E6FAF5',
  },
  title: {
    fontSize: 20,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
    textAlign: 'right',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
  },
  searchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  zoneBox: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  zoneName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
    marginLeft: 8,
  },
  section: {
    marginBottom: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#888',
    marginRight: 8,
    marginLeft: 5,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  selectedZoneContainer: {
    marginTop: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  selectedZoneTitle: {
    fontSize: 18,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  currentZoneContainer: {
    marginBottom: 30,
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#d9f5f0',
    borderRadius: 10,
    borderColor: '#11998e',
    borderWidth: 1,
  },
  currentZoneTitle: {
    fontSize: 18,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
});
