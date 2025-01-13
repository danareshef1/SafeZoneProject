import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import StatusButtons from '../../components/ui/Map/StatusButtons';

const ShelterDetail: React.FC = () => {
  const { id } = useLocalSearchParams(); 
  console.log('Dynamic Route Loaded with ID:', id); // Debugging log

  const [reportText, setReportText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  const handleSubmitReport = () => {
    if (!selectedStatus) {
      Alert.alert('Error', 'Please select a status');
      return;
    }

    // Replace with your backend integration logic
    console.log('Report submitted:', { shelterId: id, status: selectedStatus, reportText });

    Alert.alert('Success', 'Your report has been submitted');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shelter Details</Text>
      <Text style={styles.subTitle}>Shelter ID: {id}</Text>
      <Image
        source={{ uri: 'https://via.placeholder.com/300' }} // Replace with real image URL
        style={styles.image}
      />
      <Text style={styles.sectionTitle}>Report Issue:</Text>
      <StatusButtons onReport={handleStatusChange} />
      <TextInput
        style={styles.textInput}
        placeholder="Describe the issue here..."
        value={reportText}
        onChangeText={setReportText}
        multiline
      />
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport}>
        <Text style={styles.submitButtonText}>Submit Report</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subTitle: { fontSize: 18, marginBottom: 20 },
  image: { width: '100%', height: 200, borderRadius: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ShelterDetail;
