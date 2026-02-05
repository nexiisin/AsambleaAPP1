import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';
import { useResponsive } from '@/src/hooks/useResponsive';

const PANEL_WIDTH = 520;

export default function AdminHome() {
  const { isDesktop } = useResponsive();
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  
  // Estados para el modal de configuración de tiempo
  const [modalVisible, setModalVisible] = useState(false);
  const [tiempoEntrada, setTiempoEntrada] = useState(60); // Tiempo en minutos (por defecto 1 hora)

  // Validar credenciales contra Supabase
  const iniciarSesion = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa usuario y contraseña');
      return;
    }

    setCargando(true);

    try {
      const { data, error } = await supabase
        .from('administradores')
        .select('*')
        .eq('usuario', usuario)
        .eq('password', password)
        .eq('activo', true)
        .single();

      setCargando(false);

      if (error || !data) {
        Alert.alert('Error', 'Usuario o contraseña incorrectos');
        return;
      }

      // Credenciales válidas
      setAutenticado(true);
    } catch (e) {
      setCargando(false);
      Alert.alert('Error', 'Ocurrió un error al iniciar sesión');
      console.error('Error en login:', e);
    }
  };

  const crearAsamblea = async () => {
    setCargando(true);

    const codigo = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();

    // Calcular la hora de cierre basada en el tiempo de entrada configurado
    const horaInicio = new Date();
    const horaCierre = new Date(horaInicio.getTime() + tiempoEntrada * 60000);

    const { data, error } = await supabase
      .from('asambleas')
      .insert({
        codigo_acceso: codigo,
        estado: 'ABIERTA',
        hora_inicio: horaInicio.toISOString(),
        hora_cierre_ingreso: horaCierre.toISOString(),
      })
      .select()
      .single();

    setCargando(false);
    setModalVisible(false);

    if (error || !data) {
      Alert.alert('Error', 'No se pudo crear la asamblea');
      console.error('Error al crear asamblea:', error);
      return;
    }

    router.push({
      pathname: '/admin/asamblea',
      params: { asambleaId: data.id },
    });
  };

  // Si no está autenticado, mostrar login
  if (!autenticado) {
    return (
      <LinearGradient
        colors={['#5fba8b', '#d9f3e2']}
        style={styles.page}
      >
        <KeyboardAvoidingView
          style={styles.page}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.loginPanel}>
            <ScaledText style={styles.title}>🔐 Acceso Administrador</ScaledText>
            <ScaledText style={styles.subtitle}>
              Ingresa tus credenciales para continuar
            </ScaledText>
            
            <View style={styles.formContainer}>
              <ScaledText style={styles.label}>Usuario</ScaledText>
              <TextInput
                style={styles.input}
                placeholder="Admin o Administrador"
                value={usuario}
                onChangeText={setUsuario}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <ScaledText style={styles.label}>Contraseña</ScaledText>
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.loginButton, cargando && styles.loginButtonDisabled]}
                onPress={iniciarSesion}
                disabled={cargando}
              >
                <ScaledText style={styles.loginButtonText}>
                  {cargando ? 'Verificando...' : 'Iniciar Sesión'}
                </ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <ScaledText style={styles.backButtonText}>← Volver</ScaledText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // Panel principal (después de autenticarse)
  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={isDesktop ? styles.desktopContainer : styles.scrollContainer}>
        {isDesktop ? (
          // Vista Desktop: Dashboard con Cards
          <View style={styles.dashboardContainer}>
            <View style={styles.dashboardHeader}>
              <ScaledText style={styles.dashboardTitle}>Panel Administrador</ScaledText>
              <ScaledText style={styles.welcomeText}>Bienvenido, {usuario}</ScaledText>
            </View>

            <View style={styles.cardsGrid}>
              {/* Card: Crear Asamblea */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.cardPrimary]}
                onPress={() => setModalVisible(true)}
                disabled={cargando}
              >
                <ScaledText style={styles.cardIcon}>➕</ScaledText>
                <ScaledText style={styles.cardTitle}>Crear Asamblea</ScaledText>
                <ScaledText style={styles.cardDescription}>Inicia una nueva asamblea</ScaledText>
              </TouchableOpacity>

              {/* Card: Ver Asambleas */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.cardSecondary]}
                onPress={() => router.push('/admin/asambleas')}
              >
                <ScaledText style={styles.cardIcon}>📂</ScaledText>
                <ScaledText style={styles.cardTitle}>Asambleas</ScaledText>
                <ScaledText style={styles.cardDescription}>Ver todas las asambleas</ScaledText>
              </TouchableOpacity>

              {/* Card: Cerrar Sesión */}
              <TouchableOpacity
                style={[styles.dashboardCard, styles.cardLogout]}
                onPress={() => {
                  setAutenticado(false);
                  setUsuario('');
                  setPassword('');
                }}
              >
                <ScaledText style={styles.cardIcon}>🚪</ScaledText>
                <ScaledText style={styles.cardTitle}>Cerrar Sesión</ScaledText>
                <ScaledText style={styles.cardDescription}>Salir del panel</ScaledText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Vista Móvil: Layout original
          <View style={styles.panel}>
            <ScaledText style={styles.title}>Panel Administrador</ScaledText>
            <ScaledText style={styles.welcomeText}>Bienvenido, {usuario}</ScaledText>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setModalVisible(true)}
              disabled={cargando}
            >
              <ScaledText style={styles.primaryButtonText}>
                ➕ Crear nueva asamblea
              </ScaledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/admin/asambleas')}
            >
              <ScaledText style={styles.secondaryButtonText}>
                📂 Ver asambleas existentes
              </ScaledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                setAutenticado(false);
                setUsuario('');
                setPassword('');
              }}
            >
              <ScaledText style={styles.logoutButtonText}>Cerrar Sesión</ScaledText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FAB de Accesibilidad */}
      <AccessibilityFAB />

      {/* Modal para configurar tiempo de entrada */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScaledText style={styles.modalTitle}>⏰ Configurar Tiempo de Entrada</ScaledText>
            <ScaledText style={styles.modalSubtitle}>
              Define cuánto tiempo tendrán los asistentes para registrarse
            </ScaledText>

            <View style={styles.tiempoContainer}>
              <ScaledText style={styles.tiempoLabel}>Tiempo de entrada:</ScaledText>
              <ScaledText style={styles.tiempoValor}>
                {tiempoEntrada < 60 
                  ? `${tiempoEntrada} minutos` 
                  : `${(tiempoEntrada / 60).toFixed(1)} hora(s)`}
              </ScaledText>
            </View>

            {/* Slider con botones */}
            <View style={styles.sliderContainer}>
              <TouchableOpacity
                style={[
                  styles.sliderButton,
                  tiempoEntrada <= 30 && styles.sliderButtonDisabled
                ]}
                onPress={() => setTiempoEntrada(Math.max(30, tiempoEntrada - 15))}
                disabled={tiempoEntrada <= 30}
              >
                <ScaledText style={styles.sliderButtonText}>−</ScaledText>
              </TouchableOpacity>

              <View style={styles.sliderTrack}>
                <View 
                  style={[
                    styles.sliderFill,
                    { width: `${((tiempoEntrada - 30) / 90) * 100}%` }
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.sliderButton,
                  tiempoEntrada >= 120 && styles.sliderButtonDisabled
                ]}
                onPress={() => setTiempoEntrada(Math.min(120, tiempoEntrada + 15))}
                disabled={tiempoEntrada >= 120}
              >
                <ScaledText style={styles.sliderButtonText}>+</ScaledText>
              </TouchableOpacity>
            </View>

            {/* Opciones rápidas */}
            <View style={styles.quickOptions}>
              <TouchableOpacity
                style={[
                  styles.quickOptionButton,
                  tiempoEntrada === 30 && styles.quickOptionButtonActive
                ]}
                onPress={() => setTiempoEntrada(30)}
              >
                <ScaledText style={[
                  styles.quickOptionText,
                  tiempoEntrada === 30 && styles.quickOptionTextActive
                ]}>30 min</ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickOptionButton,
                  tiempoEntrada === 60 && styles.quickOptionButtonActive
                ]}
                onPress={() => setTiempoEntrada(60)}
              >
                <ScaledText style={[
                  styles.quickOptionText,
                  tiempoEntrada === 60 && styles.quickOptionTextActive
                ]}>1 hora</ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickOptionButton,
                  tiempoEntrada === 90 && styles.quickOptionButtonActive
                ]}
                onPress={() => setTiempoEntrada(90)}
              >
                <ScaledText style={[
                  styles.quickOptionText,
                  tiempoEntrada === 90 && styles.quickOptionTextActive
                ]}>1.5 horas</ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickOptionButton,
                  tiempoEntrada === 120 && styles.quickOptionButtonActive
                ]}
                onPress={() => setTiempoEntrada(120)}
              >
                <ScaledText style={[
                  styles.quickOptionText,
                  tiempoEntrada === 120 && styles.quickOptionTextActive
                ]}>2 horas</ScaledText>
              </TouchableOpacity>
            </View>

            {/* Botones de acción */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <ScaledText style={styles.modalCancelButtonText}>Cancelar</ScaledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={crearAsamblea}
                disabled={cargando}
              >
                <ScaledText style={styles.modalConfirmButtonText}>
                  {cargando ? 'Creando...' : 'Crear Asamblea'}
                </ScaledText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  } as ViewStyle,

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  } as ViewStyle,

  loginPanel: {
    width: '100%',
    maxWidth: PANEL_WIDTH,
  } as ViewStyle,

  panel: {
    width: '100%',
    maxWidth: PANEL_WIDTH,
    paddingTop: 60,
    paddingHorizontal: 16,
  } as ViewStyle,

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#111827',
  } as TextStyle,

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 40,
    color: '#6b7280',
  } as TextStyle,

  formContainer: {
    paddingHorizontal: 8,
  } as ViewStyle,

  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#065f46',
    fontWeight: '500',
  } as TextStyle,

  // Estilos del login
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  } as TextStyle,

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9fafb',
  } as TextStyle,

  loginButton: {
    backgroundColor: '#065f46',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  } as ViewStyle,

  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.7,
  } as ViewStyle,

  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  } as TextStyle,

  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  } as ViewStyle,

  backButtonText: {
    color: '#065f46',
    fontSize: 15,
    fontWeight: '500',
  } as TextStyle,

  // Estilos del panel
  primaryButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  } as ViewStyle,

  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  } as TextStyle,

  secondaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,

  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,

  logoutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  } as ViewStyle,

  logoutButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,

  // Estilos del modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as ViewStyle,

  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,

  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111827',
  } as TextStyle,

  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    color: '#6b7280',
    lineHeight: 20,
  } as TextStyle,

  tiempoContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bbf7d0',
  } as ViewStyle,

  tiempoLabel: {
    fontSize: 14,
    color: '#065f46',
    marginBottom: 6,
    fontWeight: '500',
  } as TextStyle,

  tiempoValor: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a',
  } as TextStyle,

  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  } as ViewStyle,

  sliderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,

  sliderButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.5,
  } as ViewStyle,

  sliderButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  } as TextStyle,

  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  } as ViewStyle,

  sliderFill: {
    height: '100%',
    backgroundColor: '#16a34a',
  } as ViewStyle,

  quickOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  } as ViewStyle,

  quickOptionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  } as ViewStyle,

  quickOptionButtonActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  } as ViewStyle,

  quickOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  } as TextStyle,

  quickOptionTextActive: {
    color: '#16a34a',
  } as TextStyle,

  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,

  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  } as ViewStyle,

  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  } as TextStyle,

  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,

  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  } as TextStyle,

  // Estilos Dashboard Desktop
  desktopContainer: {
    flexGrow: 1,
    padding: 40,
    minHeight: '100%',
  } as ViewStyle,

  dashboardContainer: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  } as ViewStyle,

  dashboardHeader: {
    marginBottom: 40,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  } as ViewStyle,

  dashboardTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  } as TextStyle,

  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  } as ViewStyle,

  dashboardCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    flex: 1,
    minWidth: 280,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 2,
    borderColor: 'transparent',
  } as ViewStyle,

  cardPrimary: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  } as ViewStyle,

  cardSecondary: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  } as ViewStyle,

  cardTertiary: {
    borderColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
  } as ViewStyle,

  cardQuaternary: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  } as ViewStyle,

  cardLogout: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  } as ViewStyle,

  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  } as TextStyle,

  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,

  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  } as TextStyle,
});
