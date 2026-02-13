import { StyleSheet } from 'react-native';
import { layout, palette } from '@/src/styles/tokens';

export const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: layout.cardMaxWidth,
    padding: 24,
    borderRadius: 16,
    backgroundColor: palette.surface,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: palette.primaryDark,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: palette.white,
  },
  button: {
    backgroundColor: palette.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  checkbox: {
    marginVertical: 10,
  },
  checkboxText: {
    fontSize: 16,
  },
});
