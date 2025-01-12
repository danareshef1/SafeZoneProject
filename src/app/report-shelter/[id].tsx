import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import sheltersData from '../../../assets/data/shelters.json';

const ReportShelter: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Use `useLocalSearchParams` instead of `useSearchParams`

  const shelter = sheltersData.find((shelter) => shelter.id === id);

  if (!shelter) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Shelter not found</Text>
      </View>
    );
  }

  const [status, setStatus] = useState(shelter.status || '');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(shelter.image || '');

  const handleSubmit = () => {
    console.log('Updated Shelter Info:', { status, description, image });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report Shelter: {shelter.location}</Text>
      <TextInput
        style={styles.input}
        placeholder="Status"
        value={status}
        onChangeText={setStatus}
      />
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        placeholder="Image URL"
        value={image}
        onChangeText={setImage}
      />
      <Image source={{ uri: image }} style={styles.image} />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5 },
  image: { width: '100%', height: 200, marginVertical: 20 },
  error: { fontSize: 16, color: 'red', textAlign: 'center' },
});

export default ReportShelter;
