import { Stack } from 'expo-router';
import { FontSizeProvider } from '../src/contexts/FontSizeContext';

export default function Layout() {
  return (
    <FontSizeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </FontSizeProvider>
  );
}
