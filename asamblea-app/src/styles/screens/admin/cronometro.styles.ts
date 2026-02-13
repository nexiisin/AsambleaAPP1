import { StyleSheet } from 'react-native';
import { palette } from '@/src/styles/tokens';

const BUTTON_WIDTH = 260;

export const styles = StyleSheet.create({
  content: {
    padding: 24,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  backButtonText: {
    fontSize: 16,
    color: palette.primaryDark,
    fontWeight: '600',
  },
  estado: {
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '600',
  },
  circlesRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 30,
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    position: 'absolute',
    alignItems: 'center',
  },
  circleValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.primaryDark,
  },
  circleLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  config: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    width: BUTTON_WIDTH,
    alignItems: 'center',
    gap: 16,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  adjust: {
    fontSize: 28,
    color: '#16a34a',
    fontWeight: 'bold',
  },
  adjustValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 12,
    width: BUTTON_WIDTH,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  quorumBox: {
    width: BUTTON_WIDTH,
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quorumText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primaryDark,
  },
  quorumSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    width: BUTTON_WIDTH,
    alignItems: 'center',
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: palette.danger,
    paddingVertical: 14,
    borderRadius: 12,
    width: BUTTON_WIDTH,
    alignItems: 'center',
  },
  buttonText: {
    color: palette.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
