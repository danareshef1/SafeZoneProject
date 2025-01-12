import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics'; // Import expo-haptics for tactile feedback

type StatusButtonsProps = {
  onReport: (status: string) => void;
};

const StatusButtons: React.FC<StatusButtonsProps> = ({ onReport }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.circleButton, styles.redButton]}
        onPress={() => {
          Haptics.selectionAsync(); // Haptic feedback
          onReport('High Load (Red)');
        }}
      >
        <Text style={styles.buttonText}>High</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.circleButton, styles.yellowButton]}
        onPress={() => {
          Haptics.selectionAsync(); // Haptic feedback
          onReport('Medium Load (Yellow)');
        }}
      >
        <Text style={styles.buttonText}>Medium</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.circleButton, styles.greenButton]}
        onPress={() => {
          Haptics.selectionAsync(); // Haptic feedback
          onReport('Low Load (Green)');
        }}
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
    elevation: 5, // 3D effect for Android
    shadowColor: '#000', // 3D effect for iOS
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
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default StatusButtons;
