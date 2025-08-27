
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, I18nManager,
  ToastAndroid, Platform, Alert, TouchableOpacity, RefreshControl
} from 'react-native';
import { getUserEmail } from '../../utils/auth';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

const REPORTS_URL = 'https://66pv06z732.execute-api.us-east-1.amazonaws.com/get-reports';
const IMAGE_CDN_BASE = 'https://safezone-images.s3.amazonaws.com';

type Report = {
  reportId: string;
  name?: string;
  reportText: string;
  timestamp?: string;
  images?: string[];
  // new optional structured fields
  status?: 'open' | 'in_progress' | 'resolved';
  issues?: string[];
  severity?: 'low'|'medium'|'high';
  capacity?: number;
  occupancy?: number;
  lighting?: 'none'|'dim'|'ok';
  accessibility?: { wheelchair?: boolean; stroller?: boolean };
};
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

const isLikelyUrl = (s?: string) => !!s && /^https?:\/\//i.test(s);
const trimSlash = (s: string) => s.replace(/\/+$/, '');
const trimLeadingSlash = (s: string) => s.replace(/^\/+/, '');
const makeImageUrl = (keyOrUrl?: string): string | null => {
  if (!keyOrUrl) return null;
  if (isLikelyUrl(keyOrUrl)) return keyOrUrl;
  const base = trimSlash(IMAGE_CDN_BASE);
  const k = trimLeadingSlash(keyOrUrl);
  return `${base}/${encodeURI(k)}`;
};

const parseDateFlexible = (v: any): Date | null => {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const ms = v > 10_000_000_000 ? v : v * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    if (/^\d{13}$/.test(s)) return new Date(Number(s));
    if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};
const toIso = (ts: any): string | undefined => {
  const d = parseDateFlexible(ts);
  return d ? d.toISOString() : undefined;
};

const splitCsv = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const normalizeToReports = (raw: any): Report[] => {
  const wrap = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.reports) && raw.reports) ||
      (Array.isArray(raw?.Items) && raw.Items) ||
      (Array.isArray(raw?.items) && raw.items) ||
      [];

  return wrap
    .map((it: any) => {
      const arrCandidates: any[] = [];
      if (Array.isArray(it?.images)) arrCandidates.push(...it.images);
      if (Array.isArray(it?.imageUrls)) arrCandidates.push(...it.imageUrls);
      if (Array.isArray(it?.photos)) arrCandidates.push(...it.photos);
      if (Array.isArray(it?.imageKeys)) arrCandidates.push(...it.imageKeys);
      arrCandidates.push(...splitCsv(it?.imageUrlsCsv ?? it?.imageUrls));
      arrCandidates.push(...splitCsv(it?.imagesCsv ?? it?.images));
      arrCandidates.push(...splitCsv(it?.photosCsv ?? it?.photos));
      arrCandidates.push(...splitCsv(it?.imageKeysCsv ?? it?.imageKeys));
      if (it?.imageUrl) arrCandidates.push(it.imageUrl);
      if (it?.imageKey) arrCandidates.push(it.imageKey);
      if (it?.photo) arrCandidates.push(it.photo);
      const urls = Array.from(new Set(arrCandidates.map((v) => makeImageUrl(typeof v === 'string' ? v : String(v))).filter((u): u is string => !!u)));

      return {
        reportId: it?.reportId ?? it?.id ?? it?.report_id ?? '',
        name: it?.name ?? it?.shelterName ?? it?.shelter_name,
        reportText: it?.reportText ?? it?.text ?? it?.description ?? '',
        timestamp: toIso(it?.timestamp ?? it?.createdAt ?? it?.updatedAt),
        images: urls,
        status: it?.status as Report['status'],
        issues: Array.isArray(it?.issues) ? it.issues : splitCsv(it?.issuesCsv ?? ''),
        severity: it?.severity as Report['severity'],
        capacity: typeof it?.capacity === 'number' ? it.capacity : Number(it?.capacity ?? NaN),
        occupancy: typeof it?.occupancy === 'number' ? it.occupancy : Number(it?.occupancy ?? NaN),
        lighting: it?.lighting as Report['lighting'],
        accessibility: typeof it?.accessibility === 'object' ? it.accessibility : undefined,
      } as Report;
    })
    .filter((r: Report) => !!r.reportId);
};

const copyToClipboard = async (text: string) => {
  try {
    await Clipboard.setStringAsync(text);
    if (Platform.OS === 'android') ToastAndroid.show('מספר הפנייה הועתק', ToastAndroid.SHORT);
    else Alert.alert('הועתק', 'מספר הפנייה הועתק ללוח');
  } catch {
    if (Platform.OS === 'android') ToastAndroid.show('שגיאה בהעתקה', ToastAndroid.SHORT);
    else Alert.alert('שגיאה', 'לא ניתן להעתיק ללוח');
  }
};

const StatusBadge = ({status}:{status?: Report['status']}) => {
  const map: Record<string, [string, string]> = {
    open: ['פתוח', '#eab308'],
    in_progress: ['בטיפול', '#0ea5e9'],
    resolved: ['טופל', '#16a34a'],
  };
  const [label, bg] = map[status || 'open'] || map.open;
  return (
    <View style={{ alignSelf:'flex-start', backgroundColor: bg, paddingHorizontal:10, paddingVertical:4, borderRadius:999 }}>
      <Text style={{ color:'#fff', fontWeight:'700' }}>{label}</Text>
    </View>
  );
};

const IssueTag = ({text}:{text:string}) => (
  <View style={{ backgroundColor:'#eef2f7', paddingHorizontal:8, paddingVertical:4, borderRadius:12, marginRight:6, marginBottom:6 }}>
    <Text style={{ color:'#334155', fontSize:12, fontWeight:'600' }}>{text}</Text>
  </View>
);

const MyReportsScreen = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    const email = await getUserEmail();
    if (!email) { setReports([]); setLoading(false); setRefreshing(false); return; }
    try {
      const url = `${REPORTS_URL}?email=${encodeURIComponent(email)}`;
      const response = await fetch(url);
      const data = await response.json().catch(() => null);
      const list = normalizeToReports(data);
      list.sort((a, b) => (parseDateFlexible(b.timestamp)?.getTime() ?? 0) - (parseDateFlexible(a.timestamp)?.getTime() ?? 0));
      setReports(list);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadReports(); }, [loadReports]));
  const onRefresh = useCallback(() => { setRefreshing(true); loadReports(); }, [loadReports]);

  const formatDate = (isoLike?: string) => {
    const d = parseDateFlexible(isoLike);
    if (!d) return 'לא זמין';
    return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} /> as any;

  const issueLabel = (id: string) => ISSUE_OPTIONS.find(o => o.id===id)?.label || id;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>      
      <View style={styles.titleWrapper}>
        <Text style={styles.title}>הדיווחים שלי</Text>
        <View style={styles.titleUnderline} />
      </View>

      {(!reports || reports.length === 0) ? (
        <Text style={styles.noReports}>לא נמצאו דיווחים</Text>
      ) : (
        reports.map((report, idx) => (
          <View key={report.reportId || String(idx)} style={[styles.card, { borderColor: '#ccc' }]}>
            <View style={{ flexDirection:'row-reverse', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={styles.shelterName}>{report.name || 'שם המקלט: לא זמין'}</Text>
              <StatusBadge status={report.status} />
            </View>

            <View style={styles.reportIdRow}>
              <Text style={styles.reportId}>מספר פנייה: <Text style={styles.reportIdValue}>{report.reportId}</Text></Text>
              <TouchableOpacity style={styles.copyButton} onPress={() => copyToClipboard(report.reportId)}>
                <Text style={styles.copyText}>העתק</Text>
              </TouchableOpacity>
            </View>

            {/* Issues tags */}
            {!!report.issues?.length && (
              <View style={{ flexDirection:'row', flexWrap:'wrap', marginBottom:8 }}>
                {report.issues.map((iid) => <IssueTag key={iid} text={issueLabel(iid)} />)}
              </View>
            )}

            {/* Structured info row */}
            <View style={{ flexDirection:'row-reverse', flexWrap:'wrap', gap:12, marginBottom:6 }}>
              {report.severity && <Text style={styles.metaItem}>חומרה: {report.severity==='low'?'נמוכה':report.severity==='medium'?'בינונית':'גבוהה'}</Text>}
              {report.lighting && <Text style={styles.metaItem}>תאורה: {report.lighting==='none'?'אין':report.lighting==='dim'?'חלשה':'תקינה'}</Text>}
              {Number.isFinite(report.capacity as number) && <Text style={styles.metaItem}>קיבולת: {report.capacity}</Text>}
              {Number.isFinite(report.occupancy as number) && <Text style={styles.metaItem}>תפוסה: {report.occupancy}</Text>}
              {report.accessibility?.wheelchair !== undefined && <Text style={styles.metaItem}>כיסא גלגלים: {report.accessibility?.wheelchair ? 'כן' : 'לא'}</Text>}
              {report.accessibility?.stroller !== undefined && <Text style={styles.metaItem}>עגלות: {report.accessibility?.stroller ? 'כן' : 'לא'}</Text>}
            </View>

            <Text style={styles.label}>תיאור:</Text>
            <Text style={styles.text}>{report.reportText || '—'}</Text>
            <Text style={styles.date}>תאריך: {formatDate(report.timestamp)}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
              {report.images?.length ? (
                report.images.map((uri, i) => (
                  <Image key={`${report.reportId}-${i}`} source={{ uri }} style={styles.image} onError={() => console.warn('Image failed to load:', uri)} />
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

export default MyReportsScreen as any;

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f9f9f9', flexDirection: 'column', alignItems: 'stretch', direction: I18nManager.isRTL ? 'rtl' : 'ltr' },
  titleWrapper: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  titleUnderline: { marginTop: 6, width: 120, height: 4, backgroundColor: '#11998e', borderRadius: 2 },
  noReports: { textAlign: 'center', color: '#888', fontSize: 16, marginTop: 30 },
  card: { borderWidth: 2, borderRadius: 15, padding: 15, marginBottom: 20, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  shelterName: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#333', textAlign: 'right' },
  label: { fontWeight: '600', fontSize: 15, marginTop: 5, marginBottom: 2, textAlign: 'right' },
  text: { fontSize: 15, color: '#444', marginBottom: 10, lineHeight: 22, textAlign: 'right' },
  date: { fontSize: 14, color: '#666', marginBottom: 10, textAlign: 'right' },
  imagesContainer: { flexDirection: 'row', marginTop: 10, marginBottom: 5 },
  image: { width: 110, height: 110, borderRadius: 12, marginRight: 10 },
  noImages: { fontStyle: 'italic', color: '#999', fontSize: 14, paddingTop: 10, textAlign: 'right' },
  reportId: { fontSize: 14, fontWeight: '500', color: '#666', textAlign: 'right', flexShrink: 1 },
  reportIdValue: { color: '#000', fontWeight: 'bold' },
  reportIdRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 6, position: 'relative' },
  copyButton: { position: 'absolute', left: 0, top: 0, padding: 4 },
  copyText: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
  metaItem: { fontSize: 12, color: '#475569' },
});
