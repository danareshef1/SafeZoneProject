import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, I18nManager } from 'react-native';
import { getAuthUserEmail } from '../../utils/auth';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { ToastAndroid, Platform, Alert, TouchableOpacity } from 'react-native';

const REPORTS_URL = 'https://ghidbhwemf.execute-api.us-east-1.amazonaws.com/prod/report';

type Report = {
  reportId: string;
  name?: string;
  status: string;
  reportText: string;
  timestamp?: string;
  images?: string[];
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
        const email = await getAuthUserEmail();
        if (!email) return;

        try {
          const response = await fetch(`${REPORTS_URL}?email=${email}`);
          const data = await response.json();
          setReports(data);
        } catch (error) {
          console.error('Error fetching reports:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'גבוה': return '#FF3B30';
      case 'בינוני': return '#FFCC00';
      case 'נמוך': return '#34C759';
      default: return '#ccc';
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleWrapper}>
              <Text style={styles.title}>הדיווחים שלי</Text>
              <View style={styles.titleUnderline} />
              </View>

      {reports.length === 0 ? (
        <Text style={styles.noReports}>לא נמצאו דיווחים</Text>
      ) : (
        reports.map((report, idx) => (
          <View key={idx} style={[styles.card, { borderColor: getStatusColor(report.status) }]}>
            <Text style={styles.shelterName}>{report.name || 'שם המקלט: לא זמין'}</Text>
            <View style={styles.reportIdRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.reportId}>   מספר פנייה: <Text style={styles.reportIdValue}>{report.reportId}</Text> </Text>
             </View>
             <TouchableOpacity onPress={() => copyToClipboard(report.reportId)}>
            <Text style={styles.copyText}>העתק</Text>
            </TouchableOpacity>

                  </View>
            <Text style={styles.status}>עומס: <Text style={{ color: getStatusColor(report.status), fontWeight: 'bold' }}>{report.status}</Text></Text>
            <Text style={styles.label}>תיאור:</Text>
            <Text style={styles.text}>{report.reportText}</Text>
            <Text style={styles.date}>תאריך: {formatDate(report.timestamp)}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
              {report.images?.length ? (
                report.images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.image} />
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
    status: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
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
        marginBottom: 6,
        textAlign: 'right',
      },
      reportIdValue: {
        color: '#000',
        fontWeight: 'bold',
      },
      reportIdRow: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      },
      copyText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: 'bold',
      },
      
  });
  