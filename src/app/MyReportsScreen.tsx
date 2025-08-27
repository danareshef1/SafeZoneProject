// src/app/MyReportsScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, I18nManager } from 'react-native';
import { getUserEmail } from '../../utils/auth';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { ToastAndroid, Platform, Alert, TouchableOpacity } from 'react-native';

const REPORTS_URL = 'https://66pv06z732.execute-api.us-east-1.amazonaws.com/get-reports';

type Report = {
  reportId: string;
  name?: string;
  reportText: string;
  timestamp?: string;
  images?: string[];
};

// --- helper: normalize any backend shape into Report[] ---
const toIso = (ts: any): string | undefined => {
  if (!ts) return undefined;
  if (typeof ts === 'number') return new Date(ts * (ts > 10_000_000_000 ? 1 : 1000)).toISOString();
  // אם קיבלת כבר ISO/מחרוזת תאריך, נשאיר כמו שהוא
  try { return new Date(ts).toISOString(); } catch { return String(ts); }
};

const normalizeToReports = (raw: any): Report[] => {
  // 1) כבר מערך מוכן
  if (Array.isArray(raw)) return raw as Report[];

  // 2) אובייקט שעוטף מערך
  const candidate =
    (Array.isArray(raw?.reports) && raw.reports) ||
    (Array.isArray(raw?.Items) && raw.Items) ||
    (Array.isArray(raw?.items) && raw.items) ||
    [];

  // 3) מיפוי שמות שדות נפוצים -> לשמות המסך
  return candidate
    .map((it: any) => ({
      reportId: it?.reportId ?? it?.id ?? it?.report_id ?? '',
      name: it?.name ?? it?.shelterName ?? it?.shelter_name,
      reportText: it?.reportText ?? it?.text ?? it?.description ?? '',
      timestamp: toIso(it?.timestamp ?? it?.createdAt ?? it?.updatedAt),
      images: Array.isArray(it?.images)
        ? it.images
        : (typeof it?.imageUrls === 'string'
            ? it.imageUrls.split(',').map((s: string) => s.trim()).filter(Boolean)
            : (it?.imageUrls ?? it?.photos ?? [])),
    }))
    .filter((r: Report) => !!r.reportId);
};

const copyToClipboard = (text: string) => {
  Clipboard.setStringAsync(text);
  if (Platform.OS === 'android') {
    ToastAndroid.show('מספר הפנייה הועתק', ToastAndroid.SHORT);
  } else {
    Alert.alert('הועתק', 'מספר הפנייה הועתק ללוח');
  }
};

const MyReportsScreen = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const fetchReports = async () => {
        const email = await getUserEmail();
        if (!email) {
          setReports([]);
          setLoading(false);
          return;
        }
        try {
          const url = `${REPORTS_URL}?email=${encodeURIComponent(email)}`;
          const response = await fetch(url);
          const data = await response.json().catch(() => null);

          const list = normalizeToReports(data);
          // מיון מהחדש לישן לפי timestamp אם קיים
          list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
          setReports(list);
        } catch (error) {
          console.error('Error fetching reports:', error);
          setReports([]);
        } finally {
          setLoading(false);
        }
      };
      fetchReports();
    }, [])
  );

  const formatDate = (isoDate?: string) => {
    if (!isoDate) return 'לא זמין';
    const date = new Date(isoDate);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleWrapper}>
        <Text style={styles.title}>הדיווחים שלי</Text>
        <View style={styles.titleUnderline} />
      </View>

      {(!reports || reports.length === 0) ? (
        <Text style={styles.noReports}>לא נמצאו דיווחים</Text>
      ) : (
        reports.map((report, idx) => (
          <View key={report.reportId || String(idx)} style={[styles.card, { borderColor: '#ccc' }]}>
            <Text style={styles.shelterName}>{report.name || 'שם המקלט: לא זמין'}</Text>

            <View style={styles.reportIdRow}>
              <Text style={styles.reportId}>
                מספר פנייה: <Text style={styles.reportIdValue}>{report.reportId}</Text>
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyToClipboard(report.reportId)}
              >
                <Text style={styles.copyText}>העתק</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>תיאור:</Text>
            <Text style={styles.text}>{report.reportText}</Text>
            <Text style={styles.date}>תאריך: {formatDate(report.timestamp)}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
              {report.images?.length ? (
                report.images.map((uri, i) => (
                  <Image key={`${report.reportId}-${i}`} source={{ uri }} style={styles.image} />
                ))
              ) : (
                <Text style={styles.noImages}>אין תמונות</Text>
              )}
            </ScrollView>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default MyReportsScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    flexDirection: 'column',
    alignItems: 'stretch',
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  titleWrapper: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  titleUnderline: {
    marginTop: 6,
    width: 120,
    height: 4,
    backgroundColor: '#11998e',
    borderRadius: 2,
  },
  noReports: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 30,
  },
  card: {
    borderWidth: 2,
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  shelterName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
    textAlign: 'right',
  },
  label: {
    fontWeight: '600',
    fontSize: 15,
    marginTop: 5,
    marginBottom: 2,
    textAlign: 'right',
  },
  text: {
    fontSize: 15,
    color: '#444',
    marginBottom: 10,
    lineHeight: 22,
    textAlign: 'right',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'right',
  },
  imagesContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 5,
  },
  image: {
    width: 110,
    height: 110,
    borderRadius: 12,
    marginRight: 10,
    textAlign: 'right',
  },
  noImages: {
    fontStyle: 'italic',
    color: '#999',
    fontSize: 14,
    paddingTop: 10,
    textAlign: 'right',
  },
  reportId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textAlign: 'right',
    flexShrink: 1,
  },
  reportIdValue: {
    color: '#000',
    fontWeight: 'bold',
  },
  reportIdRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 6,
    position: 'relative',
  },
  copyButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 4,
  },
  copyText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});
