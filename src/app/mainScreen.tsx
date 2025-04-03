import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getAuthUserEmail } from '../../utils/auth';

const ShelterInfoScreen = () => {
  const [minutes, setMinutes] = useState(10); // Initialize to 10 minutes
  const [seconds, setSeconds] = useState(0); // Initialize to 0 seconds
  const [progress, setProgress] = useState(1); // Full progress initially (100%)
  const [shelterLocation, setShelterLocation] = useState('תל אביב'); // Set default location
  const [timeToShelter, setTimeToShelter] = useState('דקה וחצי'); // Default time message

  useEffect(() => {
    const totalSeconds = 10 * 60; // Total countdown time in seconds (10 minutes)
    const updateProgress = (remainingSeconds: number) => {
      setProgress(remainingSeconds / totalSeconds); // Update progress based on remaining time
    };

    const timer = setInterval(() => {
      setSeconds((prevSeconds) => {
        if (prevSeconds === 0) {
          if (minutes === 0) {
            clearInterval(timer); // Stop the timer when it reaches 0
            return 0;
          }
          setMinutes((prevMinutes) => prevMinutes - 1); // Decrease the minute
          updateProgress((minutes - 1) * 60 + 59); // Update progress
          return 59; // Reset seconds to 59
        }
        const remainingSeconds = minutes * 60 + prevSeconds - 1;
        updateProgress(remainingSeconds); // Update progress
        return prevSeconds - 1; // Decrease seconds
      });
    }, 1000);

    return () => clearInterval(timer); // Cleanup the interval on component unmount
  }, [minutes]);

  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progress);

  const handleUpdate = () => {
    Alert.alert('עדכון', 'המידע עודכן בהצלחה');
  };

  const handleChat = () => {
    Alert.alert('צ\'אט', 'הצ\'אט נפתח');
  };

  const handleReport = () => {
    Alert.alert('דיווח', 'הדיווח בוצע בהצלחה');
  };
  useEffect(() => {
    const fetchCityFromServer = async () => {
      try {
        const email = await getAuthUserEmail();
        if (!email) return;
  
        const res = await fetch(`https://ker0ncay9f.execute-api.us-east-1.amazonaws.com/prod/get-user-location?email=${email}`);
        const data = await res.json();
  
        if (data.city) {
          setShelterLocation(data.city);
  
          // קביעת זמן לפי עיר
          const times: Record<string, { label: string; seconds: number }> = {
            'שדרות': { label: '15 שניות', seconds: 15 },
            'עוטף עזה': { label: '15 שניות', seconds: 15 },
            'אשקלון': { label: '30 שניות', seconds: 30 },
            'אשדוד': { label: '30 שניות', seconds: 30 },
            'תל אביב': { label: 'דקה וחצי', seconds: 90 },
            'ירושלים': { label: 'דקה וחצי', seconds: 90 },
          };
  
          const fallback = { label: 'דקה', seconds: 60 };
          const cityTime = times[data.city] || fallback;
  
          setTimeToShelter(cityTime.label);
          setMinutes(Math.floor(cityTime.seconds / 60));
          setSeconds(cityTime.seconds % 60);
        }
      } catch (err) {
        console.log('❌ שגיאה בשליפת עיר מהשרת:', err);
      }
    };
  
    fetchCityFromServer();
  }, []);
  
  return (
    
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>מיקומך: {shelterLocation}</Text>
        <Text style={styles.infoText}>זמן כניסה למקלט: {timeToShelter}</Text>
      </View>

      <View style={styles.mapContainer}>
        <Image
          source={{
            uri: 'https://upload.wikimedia.org/wikipedia/commons/4/47/OpenStreetMap_Project_logo.svg',
          }}
          style={styles.mapImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.timerContainer}>
          <Svg width={100} height={100}>
            <Circle
              cx="50"
              cy="50"
              r={circleRadius}
              stroke="#e0e0e0"
              strokeWidth="10"
              fill="none"
            />
            <Circle
              cx="50"
              cy="50"
              r={circleRadius}
              stroke="#00b300"
              strokeWidth="10"
              strokeDasharray={circleCircumference}
              strokeDashoffset={strokeDashoffset}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.timerText}>
            {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>עדכון</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleChat}>
            <Text style={styles.buttonText}>פתיחת צ'אט</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleReport}>
            <Text style={styles.buttonText}>דיווח</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ShelterInfoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00b300',
  },
  buttonsContainer: {
    flex: 1,
    marginLeft: 20,
  },
  button: {
    backgroundColor: '#00b300',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
