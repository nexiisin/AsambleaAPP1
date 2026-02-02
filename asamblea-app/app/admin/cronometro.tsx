import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '@/src/services/supabase';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width * 0.35, 140);
const STROKE_WIDTH = 4;
const BUTTON_WIDTH = 260;

export default function Cronometro() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();

  const [asamblea, setAsamblea] = useState<any>(null);
  const [minutos, setMinutos] = useState(10);
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [loading, setLoading] = useState(true);

  /* =======================
     CARGA + REALTIME
  ======================= */
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('asambleas')
        .select('*')
        .eq('id', asambleaId)
        .single();

      if (data) {
        setAsamblea(data);
        actualizarTiempo(data);
      }

      setLoading(false);
    };

    cargar();

    const channel = supabase
      .channel('cronometro-asamblea')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'asambleas',
          filter: `id=eq.${asambleaId}`,
        },
        (payload) => {
          setAsamblea(payload.new);
          actualizarTiempo(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asambleaId]);

  /* =======================
     CÁLCULO DE TIEMPO
  ======================= */
  const actualizarTiempo = (a: any) => {
    let restante = 0;

    if (a.cronometro_activo && !a.cronometro_pausado && a.cronometro_inicio) {
      const ahora = Date.now();
      const inicio = new Date(a.cronometro_inicio).getTime();
      const transcurrido = Math.floor((ahora - inicio) / 1000);
      restante = Math.max(0, a.cronometro_duracion_segundos - transcurrido);
    }

    if (a.cronometro_pausado) {
      restante = Math.max(
        0,
        a.cronometro_duracion_segundos - a.cronometro_tiempo_pausado
      );
    }

    setTiempoRestante(restante);

    // ⛔ auto detener SOLO cuando llega a 0 y estaba activo
    if (restante === 0 && a.cronometro_activo && !a.cronometro_pausado) {
      supabase.rpc('detener_cronometro', {
        p_asamblea_id: asambleaId,
      });
    }
  };

  /* =======================
     TICK LOCAL (SOLO ACTIVO)
  ======================= */
  useEffect(() => {
    if (!asamblea?.cronometro_activo || asamblea?.cronometro_pausado) return;

    const interval = setInterval(() => {
      actualizarTiempo(asamblea);
    }, 1000);

    return () => clearInterval(interval);
  }, [asamblea]);

  /* =======================
     ACCIONES
  ======================= */
  const iniciarCronometro = async () => {
    await supabase.rpc('iniciar_cronometro_debate', {
      p_asamblea_id: asambleaId,
      p_duracion_segundos: minutos * 60,
    });
  };

  const pausarCronometro = async () => {
    await supabase.rpc('pausar_cronometro', {
      p_asamblea_id: asambleaId,
    });
  };

  const reanudarCronometro = async () => {
    await supabase.rpc('reanudar_cronometro', {
      p_asamblea_id: asambleaId,
    });
  };

  const detenerCronometro = async () => {
    await supabase.rpc('detener_cronometro', {
      p_asamblea_id: asambleaId,
    });
  };

  /* =======================
     ESTADOS DERIVADOS
  ======================= */
  const cronometroActivo =
    asamblea?.cronometro_activo && !asamblea?.cronometro_pausado;

  const cronometroPausado =
    asamblea?.cronometro_activo && asamblea?.cronometro_pausado;

  const cronometroDetenido = !asamblea?.cronometro_activo;

  const mins = Math.floor(tiempoRestante / 60);
  const secs = tiempoRestante % 60;

  /* =======================
     UI
  ======================= */
  const Circulo = ({ valor, label }: { valor: number; label: string }) => {
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
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.content}>
      
      {/* Botón de volver */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push({
          pathname: '/admin/asamblea',
          params: { asambleaId }
        })}
      >
        <Text style={styles.backButtonText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.estado}>
        Estado:{' '}
        {cronometroActivo
          ? 'ACTIVO'
          : cronometroPausado
          ? 'PAUSADO'
          : 'DETENIDO'}
      </Text>

      <View style={styles.circlesRow}>
        <Circulo valor={mins} label="MIN" />
        <Circulo valor={secs} label="SEG" />
      </View>

      {cronometroDetenido && (
        <View style={styles.config}>
          <Text style={styles.configTitle}>Duración del debate</Text>

          <View style={styles.row}>
            <TouchableOpacity onPress={() => setMinutos(Math.max(1, minutos - 1))}>
              <Text style={styles.adjust}>−</Text>
            </TouchableOpacity>

            <Text style={styles.adjustValue}>{minutos} min</Text>

            <TouchableOpacity onPress={() => setMinutos(minutos + 1)}>
              <Text style={styles.adjust}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={iniciarCronometro}
          >
            <Text style={styles.buttonText}>▶ Iniciar</Text>
          </TouchableOpacity>
        </View>
      )}

      {cronometroActivo && (
        <>
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={pausarCronometro}
          >
            <Text style={styles.buttonText}>⏸ Pausar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={detenerCronometro}
          >
            <Text style={styles.buttonText}>⏹ Detener</Text>
          </TouchableOpacity>
        </>
      )}

      {cronometroPausado && (
        <>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={reanudarCronometro}
          >
            <Text style={styles.buttonText}>▶ Reanudar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={detenerCronometro}
          >
            <Text style={styles.buttonText}>⏹ Detener</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
    </LinearGradient>
  );
}

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#065f46',
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
    color: '#065f46',
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
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    width: BUTTON_WIDTH,
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    width: BUTTON_WIDTH,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
