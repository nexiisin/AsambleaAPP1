import { useContext } from 'react';
import { FontSizeContext, FontSizeLevel } from '../contexts/FontSizeContext';

export type { FontSizeLevel };

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize debe usarse dentro de FontSizeProvider');
  }
  return context;
};
