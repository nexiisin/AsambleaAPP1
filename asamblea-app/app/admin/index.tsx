import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';
import { useResponsive } from '@/src/hooks/useResponsive';
import { styles } from '@/src/styles/screens/admin/index.styles';

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

