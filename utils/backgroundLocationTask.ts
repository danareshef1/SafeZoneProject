import * as TaskManager from 'expo-task-manager';
import { LocationObject } from 'expo-location';
import { sendLocationToBackend } from './api';

const TASK_NAME = 'background-location-task';

TaskManager.defineTask(
  TASK_NAME,
  async ({
    data,
    error,
  }: {
    data?: { locations: LocationObject[] };
    error?: TaskManager.TaskManagerError | null;
  }) => {
    if (error) {
      console.error('Location task error:', error);
      return;
    }

    if (data?.locations?.length) {
      const { latitude, longitude } = data.locations[0].coords;
      console.log('📍 מיקום נשלח:', latitude, longitude);
      await sendLocationToBackend(latitude, longitude);
    }
  }
);

export default TASK_NAME;
