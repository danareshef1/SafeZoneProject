import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { fetchAuthSession } from 'aws-amplify/auth';

const REPORTS_URL = 'https://ghidbhwemf.execute-api.us-east-1.amazonaws.com/prod/report';

const getCurrentUserEmail = async () => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.payload?.email;
  } catch (error) {
    console.error('Error getting email:', error);
    return null;
  }
};

const MyReportsScreen: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      const email = await getCurrentUserEmail();
      if (!email) return;

      try {
        const response = await fetch(REPORTS_URL);
        const data = await response.json();

        const filtered = data.filter((report: any) => report.email === email);
        setReports(filtered);
      } catch (err) {
        console.error('Error fetching reports:', err);
      }
    };

    fetchReports();
  }, []);

  const renderReport = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.title}>Shelter ID: {item.shelterId}</Text>
      <Text>Status: {item.status}</Text>
      <Text>Date: {new Date(item.timestamp).toLocaleString()}</Text>
      {item.reportText ? <Text>Note: {item.reportText}</Text> : null}
      <ScrollView horizontal>
        {item.images?.map((img: string, idx: number) => (
          <Image key={idx} source={{ uri: img }} style={styles.image} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Reports</Text>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.reportId}
        renderItem={renderReport}
        contentContainerStyle={{ padding: 10 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  image: {
    width: 100,
    height: 100,
    marginTop: 10,
    marginRight: 10,
    borderRadius: 8,
  },
});

export default MyReportsScreen;