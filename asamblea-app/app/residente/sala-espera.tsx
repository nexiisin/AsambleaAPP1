import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width * 0.5, 180);
const STROKE_WIDTH = 6;

export default function SalaEspera() {
  const { asambleaId, asistenciaId, numeroCasa } = useLocalSearchParams<{
    asambleaId: string;
    asistenciaId: string;
    numeroCasa: string;
  }>();

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [ingresoCerrado, setIngresoCerrado] = useState(false);
  
  // Estados del cronómetro
  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [cronometroPausado, setCronometroPausado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [asamblea, setAsamblea] = useState<any>(null);
  const [hayPropuestaActiva, setHayPropuestaActiva] = useState(false);

  useEffect(() => {
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!asambleaId) return;

    // Verificar el estado de la asamblea
    const verificarEstado = async () => {
      const { data: asambleaData } = await supabase
        .from('asambleas')
        .select('*')
        .eq('id', asambleaId)
        .single();

      if (!asambleaData) return;

      setAsamblea(asambleaData);
      // Indicar que hay una propuesta activa pero NO redirigir automáticamente
      setHayPropuestaActiva(!!asambleaData.propuesta_activa_id);

      // Verificar si el cronómetro está activo
      if (asambleaData.cronometro_activo) {
        setCronometroActivo(true);
        setCronometroPausado(asambleaData.cronometro_pausado || false);
        
        // Calcular tiempo restante del cronómetro
        if (!asambleaData.cronometro_pausado && asambleaData.cronometro_inicio) {
          const ahora = Date.now();
          const inicio = new Date(asambleaData.cronometro_inicio).getTime();
          const transcurrido = Math.floor((ahora - inicio) / 1000);
          const restante = Math.max(0, asambleaData.cronometro_duracion_segundos - transcurrido);
          setSegundosRestantes(restante);
        } else if (asambleaData.cronometro_pausado) {
          const restante = asambleaData.cronometro_duracion_segundos - (asambleaData.cronometro_tiempo_pausado || 0);
          setSegundosRestantes(Math.max(0, restante));
        }
      } else {
        setCronometroActivo(false);
        setCronometroPausado(false);
      }

      // Verificar tiempo de ingreso
      if (asambleaData.hora_cierre_ingreso) {
        const ahora = new Date();
        const horaCierre = new Date(asambleaData.hora_cierre_ingreso);

        if (ahora >= horaCierre) {
          setIngresoCerrado(true);
          setTiempoRestante('');
        } else {
          const diffMs = horaCierre.getTime() - ahora.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffSeg = Math.floor((diffMs % 60000) / 1000);
          setTiempoRestante(`${diffMin}:${diffSeg.toString().padStart(2, '0')}`);
          setIngresoCerrado(false);
        }
      } else {
        setIngresoCerrado(false);
      }
    };

    // Verificar inmediatamente
    verificarEstado();

    // Verificar cada segundo
    const timer = setInterval(verificarEstado, 1000);

    // Suscripción a cambios en la asamblea
    const subscription = supabase
      .channel('sala-espera')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'asambleas',
          filter: `id=eq.${asambleaId}`,
        },
        () => {
          verificarEstado();
        }
      )
      .subscribe();

    // Suscripción broadcast para acciones del admin (ej. redirigir a formulario de asistencia)
    const broadcastChannel = supabase
      .channel(`asamblea-broadcast-${asambleaId}`)
      .on('broadcast', { event: 'asistencia' }, () => {
        try {
          // redirigir residente al formulario de cierre/asistencia
          router.push({ pathname: '/residente/asistencia', params: { asambleaId } });
        } catch (e) {
          console.error('Error redirigiendo a asistencia:', e);
        }
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(subscription);
      supabase.removeChannel(broadcastChannel);
    };
  }, [asambleaId]);

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Si el cronómetro está activo, mostrar cronómetro */}
        {cronometroActivo ? (
          <>
            <Text style={styles.title}>Debate en Curso</Text>
            <Text style={styles.subtitle}>Casa: {numeroCasa}</Text>

            {/* Cronómetro visual */}
            <View style={styles.cronometroContainer}>
              <View style={styles.circlesRow}>
                <CronometroCirculo valor={Math.floor(segundosRestantes / 60)} label="min" />
                <CronometroCirculo valor={segundosRestantes % 60} label="seg" />
              </View>
              
              <Text style={styles.cronometroEstado}>
                {cronometroPausado ? '⏸️ PAUSADO' : '▶️ EN PROGRESO'}
              </Text>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Tiempo de debate</Text>
              <Text style={styles.infoText}>
                El administrador ha iniciado el cronómetro para el debate. Por favor, aguarda hasta que finalice.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Título */}
            <Text style={styles.title}>
              {ingresoCerrado ? 'Esperando Acción del Administrador' : 'Registro Exitoso'}
            </Text>
            <Text style={styles.subtitle}>Casa: {numeroCasa}</Text>

            {/* Animación de carga */}
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#065f46" />
            </View>

            {/* Texto informativo */}
            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>
                {ingresoCerrado ? 'Esperando acción' : 'Aguarda un momento'}
              </Text>
              <Text style={styles.infoText}>
                {ingresoCerrado 
                  ? 'Esperando tiempo de debate, propuesta o resultado'
                  : 'Estás en la sala de espera. El proceso de registro permanecerá abierto hasta que el administrador inicie la asamblea.'}
              </Text>
              
              {tiempoRestante && !ingresoCerrado && (
                <View style={styles.timerContainer}>
                  <Text style={styles.timerLabel}>Tiempo restante de ingreso:</Text>
                  <Text style={styles.timerValue}>{tiempoRestante}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Si hay propuesta activa, mostrar botón para ir a votar (manual) */}
        {hayPropuestaActiva && (
          <View style={{ marginBottom: 12, width: '100%', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.voteNowButton}
              onPress={() => router.push({ pathname: '/residente/votacion', params: { asambleaId, asistenciaId, numeroCasa } })}
            >
              <Text style={styles.voteNowText}>Ir a votar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Indicador de conexión */}
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Conectado</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

// Componente para mostrar círculos del cronómetro
function CronometroCirculo({ valor, label }: { valor: number; label: string }) {
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;

  return (
    <View style={styles.circleContainer}>
      <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={radius}
          stroke="#bbf7d0"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
      </Svg>
      <View style={styles.circleText}>
        <Text style={styles.circleValue}>{valor}</Text>
        <Text style={styles.circleLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },

  logoContainer: {
    marginBottom: 24,
  },

  logo: {
    width: 140,
    height: 140,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 18,
    color: '#047857',
    marginBottom: 32,
    fontWeight: '600',
  },

  loadingContainer: {
    marginBottom: 32,
    padding: 20,
  },

  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 12,
    textAlign: 'center',
  },

  infoText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },

  timerContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    alignItems: 'center',
  },

  timerLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },

  timerValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a',
    fontFamily: 'monospace',
  },

  voteNowButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '80%'
  },
  voteNowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },

  statusText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
  },

  // Estilos del cronómetro
  cronometroContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },

  circlesRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },

  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  circleText: {
    position: 'absolute',
    alignItems: 'center',
  },

  circleValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#065f46',
  },

  circleLabel: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },

  cronometroEstado: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
});
