import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

export const useResponsive = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const width = dimensions.width;
  const isDesktop = width >= 1280;
  const isTablet = width >= 768 && width < 1280;
  const isMobile = width < 768;

  return {
    width,
    height: dimensions.height,
    isDesktop,
    isTablet,
    isMobile,
  };
};
