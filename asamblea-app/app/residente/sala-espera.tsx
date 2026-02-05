import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width * 0.5, 180);
const STROKE_WIDTH = 6;

export default function SalaEspera() {
  const { asambleaId, asistenciaId, numeroCasa, fromResults } = useLocalSearchParams<{
    asambleaId: string;
    asistenciaId: string;
    numeroCasa: string;
    fromResults?: string;
  }>();

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [ingresoCerrado, setIngresoCerrado] = useState(false);
  const [mostrarModalAdvertencia, setMostrarModalAdvertencia] = useState(!fromResults);

  // Estados del quórum
  const [totalViviendas, setTotalViviendas] = useState<number | null>(null);
  const [viviendasRepresentadas, setViviendasRepresentadas] = useState(0);

  // Estados del cronómetro
  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [cronometroPausado, setCronometroPausado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [asamblea, setAsamblea] = useState<any>(null);
  const [hayPropuestaActiva, setHayPropuestaActiva] = useState(false);

  // Ref para evitar redirecciones infinitas
  const lastPropuestaResultadosId = useRef<string | null>(null);
  const fromResultsProcessed = useRef(false);
  const lastPropuestaActiveRef = useRef<string | null>(null);
  const lastPropuestaResultadosRefRealtime = useRef<string | null>(null);
  
  // Refs para contador local (sin queries a BD)
  const crieroCierreIngresoRef = useRef<string | null>(null);
  const crieroCronometroRef = useRef<{ activo: boolean; pausado: boolean; inicio: string; duracion: number } | null>(null);

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

      console.log('🔄 (Sala espera) Estado asamblea:', {
        propuesta_activa_id: asambleaData.propuesta_activa_id,
        propuesta_resultados_id: asambleaData.propuesta_resultados_id,
        estado_actual: asambleaData.estado_actual
      });

      setAsamblea(asambleaData);
      
      // Redirigir automáticamente si hay propuesta activa (votación)
      if (asambleaData.propuesta_activa_id) {
        console.log('➡️ Redirigiendo a votación');
        router.replace({
          pathname: '/residente/votacion',
          params: { asambleaId, asistenciaId },
        });
        return;
      }
      
      // Redirigir automáticamente si hay resultados publicados
      // EXCEPTO si el usuario viene intencionalmente desde la pantalla de resultados
      if (asambleaData.propuesta_resultados_id && !fromResults && !fromResultsProcessed.current) {
        if (lastPropuestaResultadosId.current !== asambleaData.propuesta_resultados_id) {
          console.log('➡️ Redirigiendo a resultados (NUEVO), propuestaId:', asambleaData.propuesta_resultados_id);
          lastPropuestaResultadosId.current = asambleaData.propuesta_resultados_id;
          router.replace({
            pathname: '/residente/resultados',
            params: { 
              asambleaId, 
              asistenciaId,
              propuestaId: asambleaData.propuesta_resultados_id 
            },
          });
          return;
        } else {
          console.log('⏸️ Ya se mostró esta propuesta de resultados, no redirigir');
        }
      } else if (fromResults && !fromResultsProcessed.current) {
        console.log('🔙 Usuario regresó intencionalmente desde resultados, no redirigir');
        fromResultsProcessed.current = true;
      } else if (!asambleaData.propuesta_resultados_id) {
        // Si se limpia propuesta_resultados_id, resetear los refs
        lastPropuestaResultadosId.current = null;
        fromResultsProcessed.current = false;
      }
      
      setHayPropuestaActiva(false);

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

    // Contador local SOLO para actualizar las UI (sin queries a BD)
    const timerLocal = setInterval(() => {
      // Actualizar tiempo de ingreso restante (cálculo local)
      if (crieroCierreIngresoRef.current) {
        const ahora = new Date();
        const horaCierre = new Date(crieroCierreIngresoRef.current);

        if (ahora >= horaCierre) {
          setIngresoCerrado(true);
          setTiempoRestante('');
        } else {
          const diffMs = horaCierre.getTime() - ahora.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffSeg = Math.floor((diffMs % 60000) / 1000);
          setTiempoRestante(`${diffMin}:${diffSeg.toString().padStart(2, '0')}`);
        }
      }

      // Actualizar cronómetro si está activo (cálculo local)
      if (crieroCronometroRef.current && crieroCronometroRef.current.activo && !crieroCronometroRef.current.pausado) {
        const ahora = Date.now();
        const inicio = new Date(crieroCronometroRef.current.inicio).getTime();
        const transcurrido = Math.floor((ahora - inicio) / 1000);
        const restante = Math.max(0, crieroCronometroRef.current.duracion - transcurrido);
        setSegundosRestantes(restante);
      }
    }, 1000);

    // Suscripción a cambios en la asamblea (solo cambios relevantes)
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
        (payload) => {
          const newPropActiva = payload.new?.propuesta_activa_id;
          const newPropResultados = payload.new?.propuesta_resultados_id;
          
          // Guardar refs para el contador local
          crieroCierreIngresoRef.current = payload.new?.hora_cierre_ingreso;
          crieroCronometroRef.current = {
            activo: payload.new?.cronometro_activo,
            pausado: payload.new?.cronometro_pausado,
            inicio: payload.new?.cronometro_inicio,
            duracion: payload.new?.cronometro_duracion_segundos,
          };
          
          // Solo recargar si cambió propuesta_activa_id o propuesta_resultados_id
          if (newPropActiva !== lastPropuestaActiveRef.current || newPropResultados !== lastPropuestaResultadosRefRealtime.current) {
            lastPropuestaActiveRef.current = newPropActiva;
            lastPropuestaResultadosRefRealtime.current = newPropResultados;
            console.log('🔔 Cambio detectado en propuesta activa/resultados:', { newPropActiva, newPropResultados });
            verificarEstado();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado suscripción sala-espera:', status);
      });

    // Suscripción broadcast para acciones del admin (ej. redirigir a formulario de asistencia)
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
      .on('broadcast', { event: 'mostrar-formulario-salida' }, (payload) => {
        try {
          console.log('📋 Admin mostró formulario de salida');
          router.push({ pathname: '/residente/asistencia', params: { asambleaId, asistenciaId } });
        } catch (e) {
          console.error('Error redirigiendo a formulario de salida:', e);
        }
      })
      .subscribe();

    return () => {
      clearInterval(timerLocal);
      supabase.removeChannel(subscription);
      supabase.removeChannel(broadcastChannel);
    };
  }, [asambleaId]);

  useEffect(() => {
    if (!asambleaId) return;

    const cargarQuorum = async () => {
      const { data: a } = await supabase
        .from('asambleas')
        .select('total_viviendas')
        .eq('id', asambleaId)
        .single();

      if (a?.total_viviendas) {
        setTotalViviendas(a.total_viviendas);
      } else {
        const { count: viviendasCount } = await supabase
          .from('viviendas')
          .select('*', { count: 'exact', head: true });
        setTotalViviendas(viviendasCount || null);
      }

      const { data: asistenciasData } = await supabase
        .from('asistencias')
        .select('vivienda_id, es_apoderado, estado_apoderado, casa_representada')
        .eq('asamblea_id', asambleaId);

      const setViviendas = new Set<string>();
      asistenciasData?.forEach((asistencia) => {
        setViviendas.add(asistencia.vivienda_id);
        if (asistencia.es_apoderado && asistencia.estado_apoderado === 'APROBADO' && asistencia.casa_representada) {
          setViviendas.add(asistencia.casa_representada);
        }
      });

      setViviendasRepresentadas(setViviendas.size);
    };

    cargarQuorum();

    const channel = supabase
      .channel(`asistencias-quorum-${asambleaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asistencias', filter: `asamblea_id=eq.${asambleaId}` },
        () => {
          console.log('📊 Nueva asistencia registrada, recargando quórum');
          cargarQuorum();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asambleaId]);

  const porcentajeQuorum = totalViviendas ? Math.round((viviendasRepresentadas / totalViviendas) * 100) : 0;
  const minimoViviendas = totalViviendas ? Math.floor(totalViviendas / 2) + 1 : 0;
  const quorumCumplido = viviendasRepresentadas >= minimoViviendas;

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.container}>
      {/* Modal de advertencia sobre salirse antes de tiempo */}
      <Modal
        visible={mostrarModalAdvertencia}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarModalAdvertencia(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Importante</Text>
            <Text style={styles.modalText}>
              Al ingresar a la asamblea, te comprometes a permanecer hasta el final del proceso.
            </Text>
            <Text style={styles.modalTextWarning}>
              Si abandonas la sala antes de que finalice la asamblea:
            </Text>
            <View style={styles.warningList}>
              <Text style={styles.warningItem}>• No podrás votar en las propuestas pendientes</Text>
              <Text style={styles.warningItem}>• Tu participación quedará registrada como incompleta</Text>
              <Text style={styles.warningItem}>• Deberás esperar autorización del administrador para salir</Text>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setMostrarModalAdvertencia(false)}
            >
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

              <View style={styles.quorumContainer}>
                <Text style={styles.quorumLabel}>Quórum: {porcentajeQuorum}%</Text>
                <View style={styles.quorumBar}>
                  <View
                    style={[
                      styles.quorumFill,
                      { width: `${Math.min(100, porcentajeQuorum)}%` },
                      quorumCumplido ? styles.quorumFillOk : styles.quorumFillPending,
                    ]}
                  />
                </View>
                <Text style={styles.quorumHint}>
                  {quorumCumplido
                    ? '✅ Quórum alcanzado (mínimo 50% + 1 vivienda)'
                    : `Se requiere mínimo 50% + 1 (${minimoViviendas} viviendas)`}
                </Text>
              </View>
              
              {tiempoRestante && !ingresoCerrado && (
                <View style={styles.timerContainer}>
                  <Text style={styles.timerLabel}>Tiempo restante de ingreso:</Text>
                  <Text style={styles.timerValue}>{tiempoRestante}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Indicador de conexión */}
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Conectado</Text>
        </View>
      </Animated.View>
      <AccessibilityFAB />
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

  quorumContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    alignItems: 'center',
  },
  quorumLabel: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '700',
    marginBottom: 8,
  },
  quorumBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  quorumFill: {
    height: '100%',
    borderRadius: 999,
  },
  quorumFillOk: {
    backgroundColor: '#22c55e',
  },
  quorumFillPending: {
    backgroundColor: '#f59e0b',
  },
  quorumHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
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

  // Estilos del modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  modalTextWarning: {
    fontSize: 15,
    color: '#065f46',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  warningList: {
    alignSelf: 'stretch',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
