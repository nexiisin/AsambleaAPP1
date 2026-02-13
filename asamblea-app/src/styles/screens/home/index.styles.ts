import { StyleSheet } from 'react-native';
import { palette } from '@/src/styles/tokens';

const BUTTON_WIDTH = 280;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  main: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.primaryDark,
    marginBottom: 29,
  },
  centerContent: {
    alignItems: 'center',
    marginTop: 24,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 24,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    width: BUTTON_WIDTH,
    marginBottom: 14,
  },
  primary: {
    backgroundColor: palette.primary,
  },
  admin: {
    backgroundColor: palette.info,
  },
  gray: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: palette.white,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  pqrsText: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 10,
  },
  pqrsButtonText: {
    color: palette.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
});
