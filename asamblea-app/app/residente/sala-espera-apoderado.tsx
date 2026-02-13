import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { styles as screenStyles } from '@/src/styles/screens/residente/sala-espera-apoderado.styles';

const styles = screenStyles;

export default function SalaEsperaApoderado() {
  const { asambleaId, asistenciaId, numeroCasa, casaRepresentada } = useLocalSearchParams<{
    asambleaId: string;
    asistenciaId: string;
    numeroCasa: string;
    casaRepresentada: string;
  }>();

  const [verificando, setVerificando] = useState(true);
  const navigatedRef = useRef(false);
  const asistenciaRedirectedRef = useRef(false);

  useEffect(() => {
    if (!asambleaId || !asistenciaId) return;

    let isActive = true;
    const pollIntervalMs = 5000;

    // Función para verificar el estado del apoderado
    const verificarEstado = async (showSpinner: boolean) => {
      if (showSpinner) {
        setVerificando(true);
      }

      try {
        const { data, error } = await supabase
          .from('asistencias')
          .select('estado_apoderado')
          .eq('id', asistenciaId)
          .single();

        if (error) throw error;

        console.log('📋 Estado apoderado:', data?.estado_apoderado);

        if (data?.estado_apoderado === 'APROBADO') {
          if (navigatedRef.current) return;
          navigatedRef.current = true;

          const goToSalaEspera = () => {
            router.replace({
              pathname: '/residente/sala-espera',
              params: {
                asambleaId,
                asistenciaId,
                numeroCasa,
              },
            });
          };

          if (Platform.OS === 'web') {
            // En web el Alert no soporta botones, navega directo.
            goToSalaEspera();
          } else {
            Alert.alert(
              '✅ ¡Aprobado!',
              'Tu apoderación ha sido aprobada. Bienvenido a la asamblea.',
              [
                {
                  text: 'Continuar',
                  onPress: goToSalaEspera,
                },
              ]
            );
          }
        } else if (data?.estado_apoderado === 'RECHAZADO') {
          if (navigatedRef.current) return;
          navigatedRef.current = true;

          const goHome = () => router.replace('/residente');

          if (Platform.OS === 'web') {
            goHome();
          } else {
            Alert.alert(
              '❌ Apoderación Rechazada',
              'Tu solicitud de apoderación ha sido rechazada por el administrador. Puedes intentar registrarte nuevamente.',
              [
                {
                  text: 'Volver al inicio',
                  onPress: goHome,
                },
              ]
            );
          }
        }
      } catch (e) {
        console.error('Error verificando estado:', e);
      } finally {
        if (showSpinner && isActive) {
          setVerificando(false);
        }
      }
    };

    // Verificación inicial con indicador
    verificarEstado(true);

    // Suscripción realtime para detectar cambios
    const channel = supabase
      .channel(`apoderado-${asistenciaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'asistencias',
          filter: `id=eq.${asistenciaId}`,
        },
        (payload) => {
          console.log('🔔 Cambio detectado:', payload.new);
          verificarEstado(false);
        }
      )
      .subscribe();

    // Fallback de polling para ambientes donde realtime no dispara (web/prod)
    const pollId = setInterval(() => {
      verificarEstado(false);
    }, pollIntervalMs);

    const broadcastChannel = supabase
      .channel(`asamblea-broadcast-${asambleaId}`)
      .on('broadcast', { event: 'asistencia' }, (payload) => {
        try {
          const action = payload?.payload?.action;
          if (action !== 'permitir-salida-anticipada') return;
          const targetId = payload?.payload?.asistenciaId;
          if (targetId && asistenciaId && targetId === asistenciaId) {
            if (asistenciaRedirectedRef.current) return;
            asistenciaRedirectedRef.current = true;
            router.replace({ pathname: '/residente/asistencia', params: { asambleaId, asistenciaId } });
          }
        } catch (e) {
          console.error('Error redirigiendo a asistencia:', e);
        }
      })
      .subscribe();

    return () => {
      isActive = false;
      clearInterval(pollId);
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [asambleaId, asistenciaId, numeroCasa]);

  return (
    <LinearGradient
      colors={['#fca5a5', '#fee2e2']} // Rojo claro degradado
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Ícono de reloj */}
        <Text style={styles.icon}>🕐</Text>

        {/* Título */}
        <Text style={styles.title}>Solicitud en Revisión</Text>

        {/* Mensaje principal */}
        <Text style={styles.message}>
          Espera un momento, para que el administrador acepte tu apoderación de otra vivienda
        </Text>

        {/* Información */}
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🏠 Tu casa:</Text>
            <Text style={styles.infoValue}>{numeroCasa}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📋 Representas:</Text>
            <Text style={styles.infoValue}>Casa {casaRepresentada}</Text>
          </View>
        </View>

        {/* Indicador de carga */}
        {verificando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#991b1b" />
            <Text style={styles.loadingText}>Verificando estado...</Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#991b1b" />
            <Text style={styles.waitingText}>Esperando aprobación del administrador</Text>
          </View>
        )}

        {/* Botón para salir */}
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              const confirmed = typeof window !== 'undefined'
                ? window.confirm('¿Estás seguro de que quieres salir? Perderás tu solicitud de apoderación.')
                : false;
              if (confirmed) {
                router.replace('/residente');
              }
              return;
            }

            Alert.alert(
              'Salir',
              '¿Estás seguro de que quieres salir? Perderás tu solicitud de apoderación.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Salir',
                  style: 'destructive',
                  onPress: () => router.replace('/residente'),
                },
              ]
            );
          }}
        >
          <Text style={styles.exitButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}
