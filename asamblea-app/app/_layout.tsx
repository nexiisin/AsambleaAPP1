import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FontSizeProvider } from '../src/contexts/FontSizeContext';
import { useFontSize } from '../src/hooks/useFontSize';
import { AccessibilityFAB, AccessibilityFabGlobalProvider } from '../src/components/AccessibilityFAB';

function AppNavigator() {
  const { getContainerScale } = useFontSize();
  const scale = getContainerScale();
  const inversePercent = `${(100 / scale).toFixed(2)}%` as `${number}%`;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.scaledLayer,
          {
            width: inversePercent,
            height: inversePercent,
            transform: [{ scale }],
          },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </View>
      <AccessibilityFAB forceRender />
    </View>
  );
}

export default function Layout() {
  return (
    <FontSizeProvider>
      <AccessibilityFabGlobalProvider>
        <AppNavigator />
      </AccessibilityFabGlobalProvider>
    </FontSizeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scaledLayer: {
    flex: 1,
    alignSelf: 'center',
  },
});
