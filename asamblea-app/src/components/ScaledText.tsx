import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useFontSize } from '../hooks/useFontSize';

export const ScaledText: React.FC<TextProps> = ({ style, ...props }) => {
  let getFontSize: (baseSize: number) => number = (size) => size;
  
  try {
    const context = useFontSize();
    getFontSize = context.getFontSize;
  } catch (e) {
    // Si no hay contexto, usar tamaño normal
  }

  // Extraer el fontSize del estilo
  const flatStyle = StyleSheet.flatten(style);
  const baseFontSize = flatStyle?.fontSize || 14;
  const scaledFontSize = getFontSize(baseFontSize);

  return (
    <Text
      {...props}
      style={[
        style,
        { fontSize: scaledFontSize }
      ]}
    />
  );
};
