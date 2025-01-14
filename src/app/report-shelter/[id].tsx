import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import StatusButtons from '../../components/ui/Map/StatusButtons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ShelterDetail: React.FC = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [shelter, setShelter] = useState<any>(null);
  const [reportText, setReportText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // Images uploaded in current session
  const [shelters, setShelters] = useState<any[]>([]);
  const [showComboBox, setShowComboBox] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredShelters, setFilteredShelters] = useState<any[]>([]);

  // Fetch shelter details and all shelters
  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const storedShelters = await AsyncStorage.getItem('shelters');
        const allShelters = storedShelters ? JSON.parse(storedShelters) : [];
        setShelters(allShelters);
        setFilteredShelters(allShelters.filter((s) => s.id !== id));

        const foundShelter = allShelters.find((shelter: any) => shelter.id === id);
        if (foundShelter) {
          setShelter(foundShelter);
          setSelectedStatus(foundShelter.status || null);
        }
      } catch (error) {
        console.error('Error fetching shelters:', error);
      }
    };

    fetchShelters();
  }, [id]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    const lowercasedText = text.toLowerCase();
    const filtered = shelters.filter(
      (s) =>
        s.id !== id &&
        s.location.toLowerCase().includes(lowercasedText)
    );
    setFilteredShelters(filtered);
  };

  const handleChangeShelter = (selectedId: string) => {
    setShowComboBox(false);
    router.push({ pathname: '/report-shelter/[id]', params: { id: selectedId } });
  };

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

    if (!result.canceled) {
      const newImageUri = result.assets[0].uri;
      setUploadedImages((prev) => [...prev, newImageUri]);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedStatus) {
      Alert.alert('Error', 'Please select a status');
      return;
    }

    try {
      const storedShelters = await AsyncStorage.getItem('shelters');
      const shelters = storedShelters ? JSON.parse(storedShelters) : [];

      const updatedShelters = shelters.map((shelter: any) =>
        shelter.id === id
          ? { ...shelter, status: selectedStatus }
          : shelter
      );

      await AsyncStorage.setItem('shelters', JSON.stringify(updatedShelters));

      Alert.alert('Success', 'Your report has been submitted');

      // Reset state
      setUploadedImages([]); // Clear uploaded images
      setReportText(''); // Clear report text
      setSelectedStatus(null); // Reset status
      setShowComboBox(false); // Hide combo box
      setSearchText(''); // Reset search text

      // Navigate back to the home screen
      router.push('/');
    } catch (error) {
      console.error('Error updating shelter:', error);
      Alert.alert('Error', 'Unable to submit your report.');
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>דיווח על מקלט</Text>
      <Text style={styles.shelterName}>{shelter?.location || 'מקלט נבחר'}</Text>

      {/* Change Shelter Button */}
      <TouchableOpacity
        style={styles.changeShelterButton}
        onPress={() => setShowComboBox(!showComboBox)}
      >
        <Text style={styles.changeShelterButtonText}>שינוי מקלט</Text>
      </TouchableOpacity>

      {/* Shelter Image */}
      {shelter?.image && (
        <Image source={{ uri: shelter.image }} style={styles.shelterImage} />
      )}

      {/* Combo Box */}
      {showComboBox && (
        <View style={styles.comboBox}>
          <TextInput
            style={styles.comboBoxInput}
            placeholder="חפש מקלט"
            value={searchText}
            onChangeText={handleSearch}
          />
          <ScrollView style={styles.comboBoxList}>
            {filteredShelters.length === 0 ? (
              <Text style={styles.noSheltersText}>לא נמצאו מקלטים</Text>
            ) : (
              filteredShelters.map((shelter) => (
                <TouchableOpacity
                  key={shelter.id}
                  style={styles.comboBoxItem}
                  onPress={() => handleChangeShelter(shelter.id)}
                >
                  <Text style={styles.comboBoxItemText}>{shelter.location}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Add Picture */}
      <TouchableOpacity style={styles.addImageButton} onPress={handleAddImage}>
        <Text style={styles.addImageButtonText}>הוסף תמונה</Text>
      </TouchableOpacity>

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {uploadedImages.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.previewImage} />
          ))}
        </ScrollView>
      )}

      <StatusButtons onReport={handleStatusChange} />
      
      <TextInput
        style={styles.textInput}
        placeholder="דווח על בעיה במקלט"
        value={reportText}
        onChangeText={setReportText}
        multiline
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport}>
          <Text style={styles.submitButtonText}>שלח דיווח</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>ביטול</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  shelterName: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  changeShelterButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  changeShelterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shelterImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  comboBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginVertical: 10,
  },
  comboBoxInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    textAlign: 'right', // For RTL
  },
  comboBoxList: {
    maxHeight: 200,
  },
  comboBoxItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  comboBoxItemText: {
    fontSize: 16,
    color: '#333',
  },
  noSheltersText: {
    textAlign: 'center',
    padding: 10,
    color: '#666',
  },
  addImageButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  addImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    textAlign: 'right', // RTL alignment
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#FF5722',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ShelterDetail;
