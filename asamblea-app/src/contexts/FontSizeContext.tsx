import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSizeLevel = 'small' | 'normal' | 'large';

interface FontSizeContextType {
  fontSizeLevel: FontSizeLevel;
  setFontSizeLevel: (level: FontSizeLevel) => void;
  getFontSize: (baseSize: number) => number;
  getContainerScale: () => number;
}

export const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSizeLevel, setFontSizeLevelState] = useState<FontSizeLevel>('normal');

  // Cargar preferencia guardada
  useEffect(() => {
    const loadFontSize = async () => {
      try {
        const saved = await AsyncStorage.getItem('fontSizeLevel');
        if (saved && ['small', 'normal', 'large'].includes(saved)) {
          setFontSizeLevelState(saved as FontSizeLevel);
        }
      } catch (error) {
        console.error('Error loading font size preference:', error);
      }
    };
    loadFontSize();
  }, []);

  const setFontSizeLevel = async (level: FontSizeLevel) => {
    try {
      setFontSizeLevelState(level);
      await AsyncStorage.setItem('fontSizeLevel', level);
    } catch (error) {
      console.error('Error saving font size preference:', error);
    }
  };

  const getFontSize = (baseSize: number): number => {
    const multipliers = {
      small: 0.85,
      normal: 1,
      large: 1.3,
    };
    return Math.round(baseSize * multipliers[fontSizeLevel]);
  };

  const getContainerScale = (): number => {
    const multipliers = {
      small: 0.96,
      normal: 1,
      large: 1.08,
    };
    return multipliers[fontSizeLevel];
  };

  return (
    <FontSizeContext.Provider value={{ fontSizeLevel, setFontSizeLevel, getFontSize, getContainerScale }}>
      {children}
    </FontSizeContext.Provider>
  );
};
