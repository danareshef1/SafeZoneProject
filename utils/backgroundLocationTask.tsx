import * as TaskManager from 'expo-task-manager';
import { sendLocationToBackend } from './api'; // will create later

const TASK_NAME = 'background-location-task';

TaskManager.defineTask(TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { latitude, longitude } = data.locations[0].coords;
    console.log(`📍 Background location: ${latitude}, ${longitude}`);
    sendLocationToBackend(latitude, longitude); // send to backend
  }
});

export default TASK_NAME;
