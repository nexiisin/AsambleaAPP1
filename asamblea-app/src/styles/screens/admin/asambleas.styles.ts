import { StyleSheet } from 'react-native';
import { palette } from '@/src/styles/tokens';

export const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    paddingTop: 32,
    paddingHorizontal: 16,
    flex: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: palette.primaryDark,
    fontWeight: '600',
    fontSize: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 5,
    borderLeftColor: palette.primary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  emptyBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  emptyText: {
    color: palette.textSecondary,
    fontSize: 16,
  },
});
