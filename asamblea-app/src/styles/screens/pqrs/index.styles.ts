import { StyleSheet } from 'react-native';
import { palette } from '@/src/styles/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: palette.surface,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
    color: palette.textPrimary,
    fontWeight: '500',
  },
});
