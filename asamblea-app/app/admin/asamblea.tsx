import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';

export default function AdminAsamblea() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();

  const [asamblea, setAsamblea] = useState<any>(null);
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [propuestaAbierta, setPropuestaAbierta] = useState<any>(null);
  const [totalAsistentes, setTotalAsistentes] = useState(0);
  const [apoderadosPendientes, setApoderadosPendientes] = useState(0);
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [asistenciaModalVisible, setAsistenciaModalVisible] = useState(false);
  const [cerrarModalVisible, setCerrarModalVisible] = useState(false);
  const [cerrandoAsamblea, setCerrandoAsamblea] = useState(false);
  const [codigoModalVisible, setCodigoModalVisible] = useState(false);

  const cargarTodo = useCallback(async () => {
    if (!asambleaId) return;

    const { data: a } = await supabase
      .from('asambleas')
      .select('*')
      .eq('id', asambleaId)
      .single();

    setAsamblea(a);

    const { data: props } = await supabase
      .from('propuestas')
      .select('*')
      .eq('asamblea_id', asambleaId)
      .order('orden');

    setPropuestas(props || []);
    setPropuestaAbierta(props?.find(p => p.estado === 'ABIERTA') || null);

    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('*')
      .eq('asamblea_id', asambleaId);

    let total = 0;
    let pendientes = 0;

    (asistencias || []).forEach(a => {
      total += 1;
      if (a.es_apoderado) {
        if (a.estado_apoderado === 'APROBADO') total += 1;
        if (a.estado_apoderado === 'PENDIENTE') pendientes += 1;
      }
    });

    setTotalAsistentes(total);
    setApoderadosPendientes(pendientes);
  }, [asambleaId]);

  const calcularTiempoRestante = useCallback(() => {
    if (!asamblea?.hora_cierre_ingreso) {
      setTiempoRestante('');
      return;
    }

    const ahora = new Date();
    const horaCierre = new Date(asamblea.hora_cierre_ingreso);
    
    if (ahora >= horaCierre) {
      setTiempoRestante('CERRADO');
      return;
    }

    const diffMs = horaCierre.getTime() - ahora.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffSeg = Math.floor((diffMs % 60000) / 1000);
    setTiempoRestante(`ABIERTO - ${diffMin}:${diffSeg.toString().padStart(2, '0')} restantes`);
  }, [asamblea]);

  useEffect(() => {
    if (!asambleaId) return;

    // Carga inicial
    cargarTodo();

    // Suscripción a cambios en asambleas
    const asambleasSubscription = supabase
      .channel('asambleas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asambleas',
          filter: `id=eq.${asambleaId}`,
        },
        (payload) => {
          console.log('Cambio en asamblea:', payload);
          cargarTodo();
        }
      )
      .subscribe();

    // Suscripción a cambios en propuestas
    const propuestasSubscription = supabase
      .channel('propuestas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'propuestas',
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        (payload) => {
          console.log('Cambio en propuestas:', payload);
          cargarTodo();
        }
      )
      .subscribe();

    // Suscripción a cambios en asistencias
    const asistenciasSubscription = supabase
      .channel('asistencias-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencias',
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        (payload) => {
          console.log('Cambio en asistencias:', payload);
          cargarTodo();
        }
      )
      .subscribe();

    // Suscripción a cambios en votos (para actualizar propuestas)
    const votosSubscription = supabase
      .channel('votos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votos',
        },
        (payload) => {
          console.log('Cambio en votos:', payload);
          cargarTodo();
        }
      )
      .subscribe();

    // Timer para actualizar el contador de tiempo
    const timer = setInterval(() => {
      calcularTiempoRestante();
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(timer);
      supabase.removeChannel(asambleasSubscription);
      supabase.removeChannel(propuestasSubscription);
      supabase.removeChannel(asistenciasSubscription);
      supabase.removeChannel(votosSubscription);
    };
  }, [asambleaId, cargarTodo, calcularTiempoRestante]);

  // Calcular tiempo restante cuando cambie la asamblea
  useEffect(() => {
    calcularTiempoRestante();
  }, [calcularTiempoRestante]);

  const cerrarAsamblea = async () => {
    setCerrandoAsamblea(true);
    try {
      const { error } = await supabase
        .from('asambleas')
        .update({ estado: 'CERRADA' })
        .eq('id', asambleaId);

      if (error) {
        Alert.alert('Error', 'No se pudo cerrar la asamblea');
        console.error('Error al cerrar asamblea:', error);
        setCerrandoAsamblea(false);
        return;
      }

      setCerrarModalVisible(false);
      Alert.alert('✅ Asamblea cerrada', 'La asamblea se ha cerrado correctamente');
      cargarTodo();
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Ocurrió un error al cerrar la asamblea');
      setCerrandoAsamblea(false);
    }
  };

  if (!asamblea) {
    return <View style={styles.center}><Text>Cargando…</Text></View>;
  }

  const estadoVisual = asamblea.estado || asamblea.estado_actual || 'ESPERA';
  const estadoColor = estadoVisual === 'CERRADA' ? '#dc2626' : '#16a34a';

  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.label}>Código de acceso</Text>
          <Text style={styles.codigo}>{asamblea.codigo_acceso}</Text>
        </View>

        {/* TIEMPO DE INGRESO */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>⏱️ Tiempo de ingreso</Text>
          <Text style={styles.infoText}>
            {!asamblea.hora_cierre_ingreso 
              ? 'ABIERTO' 
              : tiempoRestante || 'Calculando...'}
          </Text>

          {asamblea.hora_cierre_ingreso && tiempoRestante && tiempoRestante !== 'CERRADO' && (
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={async () => {
                await supabase
                  .from('asambleas')
                  .update({ hora_cierre_ingreso: new Date().toISOString() })
                  .eq('id', asambleaId);
              }}
            >
              <Text style={styles.smallBtnText}>Cerrar ingreso ahora</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ESTADÍSTICAS */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalAsistentes}</Text>
            <Text>Asistentes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{propuestas.length}</Text>
            <Text>Propuestas</Text>
          </View>
        </View>

        {/* ESTADO CENTRAL */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            📊 Estado: <Text style={{ color: estadoColor }}>{estadoVisual}</Text>
          </Text>

      <TouchableOpacity
        style={styles.orangeBtn}
        onPress={() =>
          router.push({
            pathname: '/admin/cronometro',
            params: { asambleaId },
          })
        }
      >
        <Text style={styles.btnText}>💬 Iniciar debate</Text>
      </TouchableOpacity>

          {/* Botón Asistencia - abre modal para conteo de registros */}
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={() => setAsistenciaModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>🧾 Asistencia</Text>
          </TouchableOpacity>
        </View>

        {/* ACCIONES */}
        <View style={styles.actions}>
          <Action
            text="🧑‍🤝‍🧑 Listado de asistentes"
            color="#059669"
            onPress={() =>
              router.push({ pathname: '/admin/asistentes', params: { asambleaId } })
            }
          />

          <Action
            text="❕ Mostrar Código"
            color="#8b5cf6"
            onPress={() => setCodigoModalVisible(true)}
          />

          <Action
            text="📋 Listado de propuestas"
            color="#2563eb"
            onPress={() =>
              router.push({ pathname: '/admin/propuestas', params: { asambleaId } })
            }
          />

          <Action
            text={`👥 Apoderados pendientes (${apoderadosPendientes})`}
            color="#0ea5a4"
            onPress={() =>
              router.push({ pathname: '/admin/apoderados', params: { asambleaId } })
            }
          />

          <Action
            text="📊 Ver resultados"
            color="#10b981"
            onPress={() => router.push({ pathname: '/admin/resultados', params: { asambleaId } })}
          />

          <Action
            text="📥 Descargar acta"
            color="#6366f1"
            onPress={() => Alert.alert('PDF', 'Aquí va el PDF')}
          />

          <Action
            text="🔴 Cerrar asamblea"
            color="#dc2626"
            onPress={() => setCerrarModalVisible(true)}
          />
        </View>

      </View>
    </ScrollView>
      <AsistenciaModal
        visible={asistenciaModalVisible}
        onClose={() => setAsistenciaModalVisible(false)}
        asambleaId={asambleaId}
      />

      {/* Modal para mostrar código en grande */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={codigoModalVisible}
        onRequestClose={() => setCodigoModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setCodigoModalVisible(false)}
        >
          <Pressable 
            style={styles.codigoModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.codigoModalTitle}>Código de acceso</Text>
            <Text style={styles.codigoModalCodigo}>{asamblea.codigo_acceso}</Text>
            <TouchableOpacity
              style={styles.codigoModalButton}
              onPress={() => setCodigoModalVisible(false)}
            >
              <Text style={styles.codigoModalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmación para cerrar asamblea */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={cerrarModalVisible}
        onRequestClose={() => !cerrandoAsamblea && setCerrarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalIcon}>⚠️</Text>
              <Text style={styles.confirmModalTitle}>¿Cerrar asamblea?</Text>
            </View>
            
            <Text style={styles.confirmModalMessage}>
              Esta acción cerrará la asamblea de forma permanente. Ya no se podrán realizar votaciones ni registrar nuevos asistentes.
            </Text>

            <View style={styles.confirmModalStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Asistentes registrados</Text>
                <Text style={styles.confirmStatValue}>{totalAsistentes}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Propuestas creadas</Text>
                <Text style={styles.confirmStatValue}>{propuestas.length}</Text>
              </View>
            </View>

            <Text style={styles.confirmModalWarning}>
              ⚠️ Esta acción no se puede deshacer
            </Text>

            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setCerrarModalVisible(false)}
                disabled={cerrandoAsamblea}
              >
                <Text style={styles.confirmCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  cerrandoAsamblea && styles.confirmDeleteButtonDisabled
                ]}
                onPress={cerrarAsamblea}
                disabled={cerrandoAsamblea}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  {cerrandoAsamblea ? '⏳ Cerrando...' : '🔴 Sí, cerrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// =========================
// Modal de Asistencia (en el mismo archivo para facilidad)
// =========================
function AsistenciaModal({ visible, onClose, asambleaId }: any) {
  const [totalViviendas, setTotalViviendas] = useState<number | null>(null);
  const [registrados, setRegistrados] = useState<number>(0);

  useEffect(() => {
    if (!asambleaId) return;

    const cargar = async () => {
      // total viviendas (si existe columna) fallback: contar viviendas en DB
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

      const { count } = await supabase
        .from('asistencias')
        .select('*', { count: 'exact', head: true })
        .eq('asamblea_id', asambleaId);

      setRegistrados(count || 0);
    };

    cargar();

    // Suscripción realtime para actualizar contador
    const channel = supabase
      .channel('asistencias-modal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencias', filter: `asamblea_id=eq.${asambleaId}` }, (payload) => {
        // recargar conteos
        (async () => {
          const { count } = await supabase
            .from('asistencias')
            .select('*', { count: 'exact', head: true })
            .eq('asamblea_id', asambleaId);
          setRegistrados(count || 0);
        })();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asambleaId]);

  const restantes = totalViviendas != null ? Math.max(0, totalViviendas - registrados) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Control de Asistencia</Text>
          <Text>Registrados: {registrados}</Text>
          <Text>Total viviendas: {totalViviendas ?? '—'}</Text>
          <Text style={{ marginTop: 8, fontSize: 16 }}>
            {restantes == null ? 'Restantes: —' : `Restantes: ${restantes}`}
          </Text>

          <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
            <Pressable style={modalStyles.btn} onPress={onClose}>
              <Text style={{ color: '#fff' }}>Cerrar</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.btn, { backgroundColor: '#16a34a' }]}
              onPress={async () => {
                try {
                  // enviar broadcast para que los residentes escuchen y sean redirigidos
                  const chName = `asamblea-broadcast-${asambleaId}`;
                  const channel = supabase.channel(chName);
                  await channel.send({ type: 'broadcast', event: 'asistencia', payload: { asambleaId } });
                  // opcional: cerrar modal y notificar al admin
                  Alert.alert('Enviado', 'Solicitud de asistencia enviada a residentes');
                } catch (e) {
                  console.error('Error enviando broadcast de asistencia:', e);
                  Alert.alert('Error', 'No se pudo notificar a los residentes');
                } finally {
                  onClose();
                }
              }}
            >
              <Text style={{ color: '#fff' }}>Asistencia</Text>
            </Pressable>
              <Pressable
                style={[modalStyles.btn, { backgroundColor: '#2563eb' }]}
                onPress={async () => {
                  const path = `/residente/asistencia?asambleaId=${asambleaId}`;
                  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

                  try {
                    if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
                      await (navigator as any).clipboard.writeText(url);
                      Alert.alert('Copiado', 'Enlace copiado al portapapeles');
                    } else {
                      Alert.alert('Enlace', url);
                    }
                  } catch (e) {
                    console.error('Error copiando enlace:', e);
                    Alert.alert('Error', url);
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>Copiar enlace</Text>
              </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '90%', maxWidth: 420, backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  btn: { backgroundColor: '#64748b', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
});

function Action({ text, color, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.btnText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: 24, alignItems: 'center' },
  container: { maxWidth: 420, width: '100%', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { alignItems: 'center', marginBottom: 20 },
  label: { color: '#64748b' },
  codigo: { fontSize: 34, fontWeight: 'bold', letterSpacing: 6, color: '#16a34a' },

  infoBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  infoTitle: { fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 16, color: '#16a34a', fontWeight: '600' },

  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 'bold' },

  actions: { gap: 12 },

  actionBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  btnText: { color: '#fff', fontWeight: '600', textAlign: 'center' },

  smallBtn: {
    marginTop: 8,
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallBtnText: { color: '#fff' },

  orangeBtn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 10, marginTop: 8 },
  redBtn: { backgroundColor: '#ef4444', padding: 14, borderRadius: 10, marginTop: 8 },
  grayBtn: { backgroundColor: '#64748b', padding: 14, borderRadius: 10, marginTop: 8 },
  purpleBtn: { backgroundColor: '#8b5cf6', padding: 14, borderRadius: 10, marginTop: 8 },
  primaryButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Estilos para el modal de confirmación
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  confirmModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  confirmModalStats: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  confirmStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
  },
  confirmModalWarning: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  confirmCancelButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmDeleteButtonDisabled: {
    backgroundColor: '#fca5a5',
    opacity: 0.7,
  },
  confirmDeleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Estilos para el modal del código
  codigoModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 450,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  codigoModalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
    textAlign: 'center',
  },
  codigoModalCodigo: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 12,
    marginBottom: 32,
    textAlign: 'center',
  },
  codigoModalButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  codigoModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
