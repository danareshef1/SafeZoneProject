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
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import StatusButtons from '../../components/ui/Map/StatusButtons';
import { getAuthUserEmail } from '../../../utils/auth'
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer'; 

const API_URL = 'https://d6jaqmxif9.execute-api.us-east-1.amazonaws.com/shelters';
const REPORTS_URL = ' https://nq6yv4sht1.execute-api.us-east-1.amazonaws.com/report';

const getColorByStatus = (status: string | null) => {
  switch (status) {
    case 'גבוה':
      return '#FF3B30'; // Red
    case 'בינוני':
      return '#FFCC00'; // Yellow
    case 'נמוך':
      return '#34C759'; // Green
    default:
      return '#ccc'; // Neutral gray
  }
};

const ShelterDetail: React.FC = () => {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [shelter, setShelter] = useState<any>(null);
  const [reportText, setReportText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [shelters, setShelters] = useState<any[]>([]);
  const [showComboBox, setShowComboBox] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredShelters, setFilteredShelters] = useState<any[]>([]);

  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const response = await fetch(`${API_URL}`);
        const allShelters = await response.json();
        setShelters(allShelters);
        setFilteredShelters(allShelters.filter((s) => s.id !== id));

        const foundShelter = allShelters.find((shelter: any) => shelter.id === id);
        if (foundShelter) {
          setShelter(foundShelter);
          setSelectedStatus(foundShelter.status || null);
          setReportText(foundShelter.reportText || '');
          setUploadedImages(foundShelter.images || []);
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
        (s.name?.toLowerCase().includes(lowercasedText) || s.location?.toLowerCase().includes(lowercasedText))
    );
    setFilteredShelters(filtered);
  };

  const handleChangeShelter = (selectedId: string) => {
    setShowComboBox(false);
    router.push({ pathname: '/report-shelter/[id]', params: { id: selectedId } });
  };

  const getSignedUploadUrl = async (type: 'shelter' | 'report') => {
    const response = await fetch('https://nt66vuij24.execute-api.us-east-1.amazonaws.com/getSignedUploadUrl', 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }
    );
  
    const text = await response.text();  
    if (!response.ok) {
      throw new Error('Failed to get signed URL');
    }
  
    return JSON.parse(text);
  };
  
  
  const uploadImageToS3 = async (localUri: string, type: 'shelter' | 'report') => {
    const { uploadUrl, imageUrl } = await getSignedUploadUrl(type);
  
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  
    const buffer = Buffer.from(base64, 'base64');
  
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: buffer,
    });
  
    return imageUrl;
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
      const localUri = result.assets[0].uri;
      try {
        setIsUploadingImage(true); 
        const uploadedUrl = await uploadImageToS3(localUri, 'report'); 
        setUploadedImages((prev) => [...prev, uploadedUrl]);
      } catch (error) {
        console.error('Image upload failed:', error);
        Alert.alert('Error', 'Image upload failed.');
      } finally {
        setIsUploadingImage(false); 
      }
    }
  };
  

  const handleSubmitReport = async () => {
    if (!selectedStatus) {
      Alert.alert('Error', 'Please select a status');
      return;
    }
  
    try {
      setIsSubmitting(true); 
      const userEmail = await getAuthUserEmail();
      if (!userEmail) {
        Alert.alert('Error', 'User email not found.');
        return;
      }
  
      const statusOnlyUpdate = {
        id: shelter.id,
        status: selectedStatus,
      };
  
      const statusResponse = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusOnlyUpdate),
      });
  
      if (!statusResponse.ok) {
        throw new Error('Failed to update shelter status');
      }
  
      await fetch(REPORTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: shelter.id,
          name: shelter.name,
          status: selectedStatus,
          reportText,
          images: uploadedImages,
          email: userEmail,
        }),
      });
  
      Alert.alert('Success', 'Your report has been submitted');
  
      setUploadedImages([]);
      setReportText('');
      setSelectedStatus(null);
      setShowComboBox(false);
      setSearchText('');
  
      router.push('/');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Unable to submit your report.');
    } finally {
      setIsSubmitting(false); 
    }
  };
  
  
  

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>דיווח על מקלט</Text>
      <Text style={styles.shelterName}>{shelter?.name || shelter?.location || 'מקלט נבחר'}</Text>

      {selectedStatus && (
        <View style={styles.statusRow}>
          <View style={[styles.statusCircle, { backgroundColor: getColorByStatus(selectedStatus) }]} />
          <Text style={styles.statusText}>סטטוס נבחר: {selectedStatus}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.changeShelterButton}
        onPress={() => setShowComboBox(!showComboBox)}
      >
        <Text style={styles.changeShelterButtonText}>שינוי מקלט</Text>
      </TouchableOpacity>

      {shelter?.image && (
  <View style={styles.imageWrapper}>
    <Image
      source={{ uri: shelter.image }}
      style={styles.shelterImage}
      onLoadStart={() => setIsImageLoading(true)}
      onLoadEnd={() => setIsImageLoading(false)}
      blurRadius={isImageLoading ? 5 : 0}
    />
    {isImageLoading && (
      <ActivityIndicator
        size="large"
        color="#0000ff"
        style={styles.imageLoaderOverlay}
      />
    )}
  </View>
)}


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
                  <Text style={styles.comboBoxItemText}>{shelter.name || shelter.location}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
<TouchableOpacity
  style={styles.addImageButton}
  onPress={handleAddImage}
  disabled={isUploadingImage}
>
  {isUploadingImage ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.addImageButtonText}>הוסף תמונה</Text>
  )}
</TouchableOpacity>

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
      <TouchableOpacity
  style={styles.submitButton}
  onPress={handleSubmitReport}
  disabled={isSubmitting}
>
  {isSubmitting ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.submitButtonText}>שלח דיווח</Text>
  )}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
    textAlign: 'right',
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
    textAlign: 'right',
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
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 200,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  imageLoaderOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },  
});

export default ShelterDetail;