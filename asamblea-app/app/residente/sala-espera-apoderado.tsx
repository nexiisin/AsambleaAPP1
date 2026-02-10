import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';

export default function SalaEsperaApoderado() {
  const { asambleaId, asistenciaId, numeroCasa, casaRepresentada } = useLocalSearchParams<{
    asambleaId: string;
    asistenciaId: string;
    numeroCasa: string;
    casaRepresentada: string;
  }>();

  const [verificando, setVerificando] = useState(true);

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
          // Mostrar mensaje de aprobación
          Alert.alert(
            '✅ ¡Aprobado!',
            'Tu apoderación ha sido aprobada. Bienvenido a la asamblea.',
            [
              {
                text: 'Continuar',
                onPress: () => {
                  // Redirigir a sala de espera normal
                  router.replace({
                    pathname: '/residente/sala-espera',
                    params: {
                      asambleaId,
                      asistenciaId,
                      numeroCasa,
                    },
                  });
                },
              },
            ]
          );
        } else if (data?.estado_apoderado === 'RECHAZADO') {
          // Mostrar mensaje de rechazo
          Alert.alert(
            '❌ Apoderación Rechazada',
            'Tu solicitud de apoderación ha sido rechazada por el administrador. Puedes intentar registrarte nuevamente.',
            [
              {
                text: 'Volver al inicio',
                onPress: () => {
                  router.replace('/residente');
                },
              },
            ]
          );
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
          const targetId = payload?.payload?.asistenciaId;
          if (targetId && asistenciaId && targetId === asistenciaId) {
            router.push({ pathname: '/residente/asistencia', params: { asambleaId, asistenciaId } });
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7f1d1d',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    color: '#991b1b',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
  },
  waitingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  waitingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
    textAlign: 'center',
  },
  exitButton: {
    marginTop: 40,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  exitButtonText: {
    color: '#7f1d1d',
    fontSize: 16,
    fontWeight: '600',
  },
});
