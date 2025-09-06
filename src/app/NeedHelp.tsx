// app/need-help.tsx
import { getUserEmail } from '@/utils/auth';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  I18nManager,
  StyleSheet,
} from 'react-native';

const SAVE_URL = 'https://50nq38ocfb.execute-api.us-east-1.amazonaws.com/save-help-profile';
const GET_URL  = 'https://50nq38ocfb.execute-api.us-east-1.amazonaws.com/get-help-profile';

const THEME = {
  bg: '#f0f4f8',
  card: '#ffffff',
  primary: '#11998e',
  primaryText: '#ffffff',
  border: '#e5e7eb',
  text: '#222',
  textMuted: '#475569',
  selectedBg: '#e6f7f5',
};

// עוזר: נירמול set שמגיע מדיינמו (יכול להגיע כאובייקט/מערך)
function normalizeSet(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object' && input.type === 'Set' && Array.isArray(input.values)) return input.values;
  if (typeof input === 'object' && Array.isArray((input as any).values)) return (input as any).values;
  return [];
}

const CATEGORIES = [
  { key: 'blind',             label: 'עיוור/ת' },
  { key: 'wheelchair',        label: 'נעזר/ת בכיסא גלגלים' },
  { key: 'parent_with_kids',  label: 'הורה עם ילדים' },
  { key: 'hearing_impaired',  label: 'לקות שמיעה' },
];

export default function NeedHelpScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [visibleOnMap, setVisibleOnMap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // אם האפליקציה לא רצה כבר ב־RTL גלובלי, נכריח RTL בלוקאלי דרך סטיילים
  const rtl = useMemo(() => I18nManager.isRTL ?? true, []);


  const toggle = (k: string) => {
    setSelected(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
  };
// טעינת פרופיל
useEffect(() => {
  (async () => {
    try {
      const email = ((await getUserEmail()) || '').trim().toLowerCase();
console.log('[NeedHelp] email for GET:', email);
if (!email) { setLoading(false); Alert.alert('שגיאה','לא נמצא אימייל משתמש'); return; }

      const r = await fetch(`${GET_URL}?email=${encodeURIComponent(email)}`); // ← בלי headers
      const j = await r.json();
      const p = j?.profile || {};
      setSelected(normalizeSet(p.categories));
      setNotes(p.notes || '');
      setVisibleOnMap(Boolean(p.wantsMapVisibility ?? true));
    } catch (e) {
      console.log('get-help-profile error', e);
      Alert.alert('שגיאה','לא ניתן לטעון פרופיל');
    } finally {
      setLoading(false);
    }
  })();
}, []);

// שמירה
const saveProfile = async () => {
  try {
    setSaving(true);
    const email = ((await getUserEmail()) || '').trim().toLowerCase();
console.log('[NeedHelp] email for SAVE:', email);
if (!email) { Alert.alert('שגיאה','לא נמצא אימייל משתמש'); return; }
// בשמירה:
const r = await fetch(`${SAVE_URL}?email=${encodeURIComponent(email)}`, { // 👈 הוספתי ?email=...
  method:'POST',
  headers:{ 'Content-Type':'application/json' },
  body: JSON.stringify({
    email, // אפשר להשאיר גם בגוף – לא מזיק
    categories: selected,
    notes,
    accessibilityNeeds:{},
    wantsMapVisibility: visibleOnMap
  }),
});

    const j = await r.json();
    if (j.ok) Alert.alert('נשמר', 'עודכנו העדפות העזרה');
    else Alert.alert('שגיאה', JSON.stringify(j));
  } catch {
    Alert.alert('שגיאה','לא ניתן לשמור כרגע');
  } finally {
    setSaving(false);
  }
};


  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: THEME.bg }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: THEME.bg, writingDirection: 'rtl' }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* כותרת */}
      <Text style={styles.title}>צריך/ה עזרה</Text>
      <Text style={styles.subtitle}>הגדירו אילו סוגי עזרה תזדקקו להם בזמן אזעקה</Text>

      {/* כרטיס בחירת קטגוריות */}
      <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel="בחירת קטגוריות עזרה">
        <Text style={styles.sectionTitle}>סוגי עזרה</Text>

        <View style={{ gap: 8 }}>
          {CATEGORIES.map(c => {
            const isSelected = selected.includes(c.key);
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => toggle(c.key)}
                activeOpacity={0.8}
                style={[
                  styles.optionRow,
                  isSelected && { backgroundColor: THEME.selectedBg, borderColor: THEME.primary },
                  rtl && { flexDirection: 'row-reverse' },
                ]}
                accessible
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={c.label}
                accessibilityHint={isSelected ? 'לחיצה תבטל בחירה' : 'לחיצה תבחר קטגוריה'}
              >
                <View style={[styles.checkbox, isSelected && { borderColor: THEME.primary, backgroundColor: THEME.primary }]}>
                  {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={[styles.optionText, { textAlign: 'right' }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* כרטיס הערות */}
      <View style={styles.card} accessible accessibilityRole="form" accessibilityLabel="הערות נוספות">
        <Text style={styles.sectionTitle}>הערות קצרות</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="למשל: קושי במדרגות"
          placeholderTextColor={THEME.textMuted}
          multiline
          numberOfLines={3}
          style={[
            styles.input,
            { textAlign: 'right', writingDirection: 'rtl' },
          ]}
          accessibilityLabel="שדה הערות"
          accessibilityHint="הקלד או הדבק הערות חשובות לגבי סוג העזרה"
        />
      </View>

      {/* כרטיס נראות במפה */}
      <View style={styles.card} accessible accessibilityRole="switch">
        <View style={[styles.switchRow, rtl && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.switchLabel, { textAlign: 'right' }]}>הצגה על המפה בזמן אזעקה</Text>
          <Switch
            value={visibleOnMap}
            onValueChange={setVisibleOnMap}
            thumbColor={visibleOnMap ? THEME.primary : '#f4f3f4'}
            trackColor={{ false: '#cbd5e1', true: '#9ddad6' }}
            accessibilityLabel="הצגה על המפה בזמן אזעקה"
            accessibilityHint="הפעל או כבה הצגת פרופיל העזרה שלך למשתמשים בסביבה בעת אזעקה"
          />
        </View>
        <Text style={[styles.helpText, { textAlign: 'right' }]}>
          אם האפשרות פעילה, משתמשים בסביבה בזמן אזעקה יוכלו לראות שיש מישהו שזקוק לעזרה בסביבתם (המיקום יוצג בצורה משוערת מטעמי פרטיות).
        </Text>
      </View>

      {/* כפתור שמירה */}
      <TouchableOpacity
        onPress={saveProfile}
        activeOpacity={0.9}
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="שמירה"
        accessibilityHint="שומר את פרופיל העזרה שלך"
      >
        <Text style={styles.saveBtnText}>{saving ? 'שומר…' : 'שמירה'}</Text>
      </TouchableOpacity>

      {/* מרווח תחתון גדול למקלדת/נגישות */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 16,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 12,
    textAlign: 'right',
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 10,
    textAlign: 'right',
  },

optionRow: {
  minHeight: 52,
  borderWidth: 1,
  borderColor: THEME.border,
  borderRadius: 14,
  paddingVertical: 12,
  paddingHorizontal: 12,
  alignItems: 'center',
  justifyContent: 'flex-start', // שלא יתפזרו
  gap: 10,
  flexDirection: 'row-reverse', // כדי שהריבוע והטקסט יישבו מימין לשמאל
},
optionText: {
  color: THEME.text,
  fontSize: 16,
  textAlign: 'right',
},


  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { color: '#fff', fontWeight: '800', fontSize: 14 },

  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    padding: 12,
    minHeight: 90,
    color: THEME.text,
    backgroundColor: '#fff',
  },

  switchRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexDirection: 'row', // נהפוך ל-row-reverse ב־RTL
  },
  switchLabel: {
    flex: 1,
    fontSize: 16,
    color: THEME.text,
  },
  helpText: {
    marginTop: 8,
    fontSize: 13,
    color: THEME.textMuted,
    lineHeight: 18,
  },

  saveBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  saveBtnText: {
    color: THEME.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
