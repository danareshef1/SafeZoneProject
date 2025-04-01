import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = 'https://3izjdv6ao0.execute-api.us-east-1.amazonaws.com/prod/shelters';

const ShelterContext = createContext<any>(null);

export const ShelterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shelters, setShelters] = useState<any[]>([]);

  const fetchShelters = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setShelters(data);
    } catch (error) {
      console.error('Failed to fetch shelters:', error);
    }
  };

  useEffect(() => {
    fetchShelters();
  }, []);

  return (
    <ShelterContext.Provider value={{ shelters, setShelters, fetchShelters }}>
      {children}
    </ShelterContext.Provider>
  );
};

export const useShelters = () => useContext(ShelterContext);
