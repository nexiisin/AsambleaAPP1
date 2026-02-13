import React, { createContext, useContext, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, Pressable } from 'react-native';
import { useFontSize, FontSizeLevel } from '../hooks/useFontSize';
import { useResponsive } from '../hooks/useResponsive';

const AccessibilityFabGlobalContext = createContext(false);

export const AccessibilityFabGlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AccessibilityFabGlobalContext.Provider value={true}>
    {children}
  </AccessibilityFabGlobalContext.Provider>
);

interface AccessibilityFABProps {
  forceRender?: boolean;
}

export const AccessibilityFAB: React.FC<AccessibilityFABProps> = ({ forceRender = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const hasGlobalFAB = useContext(AccessibilityFabGlobalContext);
  const { isDesktop, isTablet } = useResponsive();

  if (hasGlobalFAB && !forceRender) {
    return null;
  }
  
  // Intentar obtener el contexto, si no está disponible, no renderizar
  let fontSizeLevel: FontSizeLevel = 'normal';
  let setFontSizeLevel: (level: FontSizeLevel) => void = () => {};
  
  try {
    const context = useFontSize();
    fontSizeLevel = context.fontSizeLevel;
    setFontSizeLevel = context.setFontSizeLevel;
  } catch (e) {
    // Si el provider no está disponible, no mostrar el FAB
    return null;
  }

  const sizes: Array<{ level: FontSizeLevel; label: string; icon: string }> = [
    { level: 'small', label: 'Pequeño', icon: 'A' },
    { level: 'normal', label: 'Normal', icon: 'A' },
    { level: 'large', label: 'Grande', icon: 'A' },
  ];

  const fabSize = isDesktop ? 68 : isTablet ? 62 : 56;
  const fabBottom = isDesktop ? 30 : 24;
  const fabRight = isDesktop ? 30 : 24;
  const modalMaxWidth = isDesktop ? 460 : isTablet ? 390 : 340;

  return (
    <>
      {/* Botón Flotante */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2,
            bottom: fabBottom,
            right: fabRight,
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.fabText, { fontSize: isDesktop ? 30 : 24 }]}>A</Text>
      </TouchableOpacity>

      {/* Modal de Opciones */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { maxWidth: modalMaxWidth }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Tamaño de Letra</Text>

            <Text style={styles.modalSubtitle}>
              Los textos de la aplicación cambiarán de tamaño inmediatamente
            </Text>

            <View style={styles.optionsContainer}>
              {sizes.map((size) => (
                <TouchableOpacity
                  key={size.level}
                  style={[
                    styles.option,
                    fontSizeLevel === size.level && styles.optionSelected,
                  ]}
                  onPress={() => {
                    setFontSizeLevel(size.level);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionIcon,
                      { fontSize: size.level === 'small' ? 16 : size.level === 'normal' ? 24 : 32 },
                      fontSizeLevel === size.level && styles.optionIconSelected,
                    ]}
                  >
                    {size.icon}
                  </Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      fontSizeLevel === size.level && styles.optionLabelSelected,
                    ]}
                  >
                    {size.label}
                  </Text>
                  {fontSizeLevel === size.level && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#065f46',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999,
  },

  fabText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },

  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },

  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },

  optionSelected: {
    backgroundColor: '#d1fae5',
    borderColor: '#065f46',
  },

  optionIcon: {
    fontWeight: 'bold',
    color: '#065f46',
    marginRight: 12,
  },

  optionIconSelected: {
    color: '#059669',
  },

  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
  },

  optionLabelSelected: {
    color: '#065f46',
    fontWeight: '600',
  },

  checkmark: {
    fontSize: 20,
    color: '#065f46',
    marginLeft: 8,
  },

  closeButton: {
    backgroundColor: '#065f46',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
