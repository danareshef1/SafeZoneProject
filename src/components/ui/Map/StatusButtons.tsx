import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics'; // For tactile feedback

type StatusButtonsProps = {
  onReport: (status: string) => void;
};

const StatusButtons: React.FC<StatusButtonsProps> = ({ onReport }) => {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const handlePress = (status: string) => {
    setActiveStatus(status); // Set the selected status
    Haptics.selectionAsync(); // Trigger haptic feedback
    onReport(status); // Notify the parent component of the selection
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.circleButton,
          styles.redButton,
          activeStatus === 'High Load (Red)' && styles.activeButton,
        ]}
        onPress={() => handlePress('High Load (Red)')}
      >
        <Text style={styles.buttonText}>High</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.circleButton,
          styles.yellowButton,
          activeStatus === 'Medium Load (Yellow)' && styles.activeButton,
        ]}
        onPress={() => handlePress('Medium Load (Yellow)')}
      >
        <Text style={styles.buttonText}>Medium</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.circleButton,
          styles.greenButton,
          activeStatus === 'Low Load (Green)' && styles.activeButton,
        ]}
        onPress={() => handlePress('Low Load (Green)')}
      >
        <Text style={styles.buttonText}>Low</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  circleButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // For Android shadow effect
    shadowColor: '#000', // For iOS shadow effect
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  redButton: {
    backgroundColor: 'red',
    shadowColor: 'rgba(255, 0, 0, 0.5)',
  },
  yellowButton: {
    backgroundColor: 'yellow',
    shadowColor: 'rgba(255, 255, 0, 0.5)',
  },
  greenButton: {
    backgroundColor: 'green',
    shadowColor: 'rgba(0, 255, 0, 0.5)',
  },
  activeButton: {
    borderWidth: 3,
    borderColor: '#000', // Black border for the active button
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default StatusButtons;
