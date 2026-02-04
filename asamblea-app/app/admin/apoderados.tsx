import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';

type Apoderado = {
  id: string;
  nombre_asistente: string;
  vivienda_id: string;
  casa_representada: string;
  estado_apoderado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  hora_registro: string;
  numero_casa?: string; // Se cargará con join
};

type FiltroEstado = 'TODOS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

const PANEL_WIDTH = 520;

export default function Apoderados() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();
  
  const [apoderados, setApoderados] = useState<Apoderado[]>([]);
  const [apoderadosFiltrados, setApoderadosFiltrados] = useState<Apoderado[]>([]);
  const [filtroActual, setFiltroActual] = useState<FiltroEstado>('TODOS');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  
  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [apoderadoSeleccionado, setApoderadoSeleccionado] = useState<Apoderado | null>(null);

  const cargarApoderados = async () => {
    if (!asambleaId) return;

    console.log('🔍 Cargando apoderados para asamblea:', asambleaId);

    try {
      // Primero obtener las asistencias de apoderados
      const { data: asistencias, error: errorAsistencias } = await supabase
        .from('asistencias')
        .select('id, nombre_asistente, vivienda_id, casa_representada, estado_apoderado, fecha_registro')
        .eq('asamblea_id', asambleaId)
        .eq('es_apoderado', true)
        .order('fecha_registro', { ascending: false });

      console.log('📦 Resultado query asistencias:', { asistencias, errorAsistencias });

      if (errorAsistencias) throw errorAsistencias;

      if (!asistencias || asistencias.length === 0) {
        console.log('ℹ️ No hay apoderados registrados');
        setApoderados([]);
        aplicarFiltro([], filtroActual);
        setCargando(false);
        return;
      }

      // Obtener los números de casa para cada vivienda_id
      const viviendaIds = asistencias.map(a => a.vivienda_id);
      const { data: viviendas, error: errorViviendas } = await supabase
        .from('viviendas')
        .select('id, numero_casa')
        .in('id', viviendaIds);

      console.log('🏠 Resultado query viviendas:', { viviendas, errorViviendas });

      // Crear mapa de vivienda_id -> numero_casa
      const viviendaMap = new Map();
      (viviendas || []).forEach((v: any) => {
        viviendaMap.set(v.id, v.numero_casa);
      });

      // Combinar datos
      const apoderadosConCasa = asistencias.map((a: any) => ({
        id: a.id,
        nombre_asistente: a.nombre_asistente,
        vivienda_id: a.vivienda_id,
        casa_representada: a.casa_representada,
        estado_apoderado: a.estado_apoderado,
        hora_registro: a.fecha_registro,
        numero_casa: viviendaMap.get(a.vivienda_id) || 'N/A',
      }));

      console.log('✅ Apoderados procesados:', apoderadosConCasa);

      setApoderados(apoderadosConCasa);
      aplicarFiltro(apoderadosConCasa, filtroActual);
    } catch (e) {
      console.error('Error cargando apoderados:', e);
      Alert.alert('Error', 'No se pudieron cargar los apoderados');
    } finally {
      setCargando(false);
    }
  };

  const aplicarFiltro = (datos: Apoderado[], filtro: FiltroEstado) => {
    if (filtro === 'TODOS') {
      setApoderadosFiltrados(datos);
    } else {
      setApoderadosFiltrados(datos.filter(a => a.estado_apoderado === filtro));
    }
  };

  const cambiarFiltro = (filtro: FiltroEstado) => {
    setFiltroActual(filtro);
    aplicarFiltro(apoderados, filtro);
  };

  useEffect(() => {
    cargarApoderados();

    // Suscripción realtime
    const channel = supabase
      .channel(`apoderados-${asambleaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencias',
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        () => {
          cargarApoderados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asambleaId]);

  const abrirModal = (apoderado: Apoderado) => {
    setApoderadoSeleccionado(apoderado);
    setModalVisible(true);
  };

  const aprobarApoderado = async () => {
    if (!apoderadoSeleccionado) return;

    setProcesando(true);
    try {
      const { error } = await supabase
        .from('asistencias')
        .update({ estado_apoderado: 'APROBADO' })
        .eq('id', apoderadoSeleccionado.id);

      if (error) throw error;

      Alert.alert('✅ Aprobado', 'El apoderado ha sido aprobado correctamente');
      setModalVisible(false);
      cargarApoderados();
    } catch (e) {
      console.error('Error aprobando apoderado:', e);
      Alert.alert('Error', 'No se pudo aprobar el apoderado');
    } finally {
      setProcesando(false);
    }
  };

  const rechazarApoderado = async () => {
    if (!apoderadoSeleccionado) return;

    setProcesando(true);
    try {
      const { error } = await supabase
        .from('asistencias')
        .update({ estado_apoderado: 'RECHAZADO' })
        .eq('id', apoderadoSeleccionado.id);

      if (error) throw error;

      Alert.alert('❌ Rechazado', 'El apoderado ha sido rechazado');
      setModalVisible(false);
      cargarApoderados();
    } catch (e) {
      console.error('Error rechazando apoderado:', e);
      Alert.alert('Error', 'No se pudo rechazar el apoderado');
    } finally {
      setProcesando(false);
    }
  };

  const getColorEstado = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return '#fbbf24'; // Amarillo
      case 'APROBADO':
        return '#10b981'; // Verde
      case 'RECHAZADO':
        return '#ef4444'; // Rojo
      default:
        return '#9ca3af'; // Gris
    }
  };

  const renderApoderado = ({ item }: { item: Apoderado }) => {
    const color = getColorEstado(item.estado_apoderado);
    
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: color, borderLeftWidth: 6 }]}
        onPress={() => abrirModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardNombre}>{item.nombre_asistente}</Text>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{item.estado_apoderado}</Text>
          </View>
        </View>
        
        <View style={styles.cardInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🏠 Casa propia:</Text>
            <Text style={styles.infoValue}>{item.numero_casa}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📋 Representa:</Text>
            <Text style={styles.infoValue}>Casa {item.casa_representada}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>⏰ Registro:</Text>
            <Text style={styles.infoValue}>
              {new Date(item.hora_registro).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (cargando) {
    return (
      <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#065f46" />
          <Text style={styles.loadingText}>Cargando apoderados...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>👥 Gestión de Apoderados</Text>
        </View>

        {/* Filtros */}
        <View style={styles.filtros}>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActual === 'TODOS' && styles.filtroActivo]}
            onPress={() => cambiarFiltro('TODOS')}
          >
            <Text style={[styles.filtroBtnText, filtroActual === 'TODOS' && styles.filtroTextoActivo]}>
              Todos ({apoderados.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActual === 'PENDIENTE' && styles.filtroActivo]}
            onPress={() => cambiarFiltro('PENDIENTE')}
          >
            <Text style={[styles.filtroBtnText, filtroActual === 'PENDIENTE' && styles.filtroTextoActivo]}>
              Pendientes ({apoderados.filter(a => a.estado_apoderado === 'PENDIENTE').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filtroBtn, filtroActual === 'APROBADO' && styles.filtroActivo]}
            onPress={() => cambiarFiltro('APROBADO')}
          >
            <Text style={[styles.filtroBtnText, filtroActual === 'APROBADO' && styles.filtroTextoActivo]}>
              Aprobados ({apoderados.filter(a => a.estado_apoderado === 'APROBADO').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filtroBtn, filtroActual === 'RECHAZADO' && styles.filtroActivo]}
            onPress={() => cambiarFiltro('RECHAZADO')}
          >
            <Text style={[styles.filtroBtnText, filtroActual === 'RECHAZADO' && styles.filtroTextoActivo]}>
              Rechazados ({apoderados.filter(a => a.estado_apoderado === 'RECHAZADO').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista */}
        {apoderadosFiltrados.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {filtroActual === 'TODOS' 
                ? 'No hay apoderados registrados' 
                : `No hay apoderados ${filtroActual.toLowerCase()}s`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={apoderadosFiltrados}
            renderItem={renderApoderado}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Modal de detalle */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => !procesando && setModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => !procesando && setModalVisible(false)}
          >
            <Pressable 
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              {apoderadoSeleccionado && (
                <>
                  <Text style={styles.modalTitle}>Información del Apoderado</Text>
                  
                  <View style={styles.modalInfo}>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Nombre:</Text>
                      <Text style={styles.modalValue}>{apoderadoSeleccionado.nombre_asistente}</Text>
                    </View>
                    
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Casa propia:</Text>
                      <Text style={styles.modalValue}>{apoderadoSeleccionado.numero_casa}</Text>
                    </View>
                    
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Representa casa:</Text>
                      <Text style={styles.modalValue}>{apoderadoSeleccionado.casa_representada}</Text>
                    </View>
                    
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Estado actual:</Text>
                      <View style={[styles.badge, { backgroundColor: getColorEstado(apoderadoSeleccionado.estado_apoderado) }]}>
                        <Text style={styles.badgeText}>{apoderadoSeleccionado.estado_apoderado}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Hora de registro:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(apoderadoSeleccionado.hora_registro).toLocaleString('es-ES')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalNote}>
                    <Text style={styles.modalNoteText}>
                      ℹ️ Al aprobar este apoderado, tendrá voto doble: uno para su casa ({apoderadoSeleccionado.numero_casa}) y otro para la casa que representa ({apoderadoSeleccionado.casa_representada})
                    </Text>
                  </View>

                  {apoderadoSeleccionado.estado_apoderado === 'PENDIENTE' && (
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.rechazarBtn]}
                        onPress={rechazarApoderado}
                        disabled={procesando}
                      >
                        {procesando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalBtnText}>❌ Rechazar</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalBtn, styles.aprobarBtn]}
                        onPress={aprobarApoderado}
                        disabled={procesando}
                      >
                        {procesando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalBtnText}>✅ Aprobar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {apoderadoSeleccionado.estado_apoderado !== 'PENDIENTE' && (
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.cerrarBtn]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.modalBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    flex: 1,
    maxWidth: PANEL_WIDTH,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#065f46',
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#065f46',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#065f46',
    textAlign: 'center',
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filtroBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  filtroActivo: {
    backgroundColor: '#065f46',
    borderColor: '#065f46',
  },
  filtroBtnText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  filtroTextoActivo: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInfo: {
    gap: 16,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  modalNote: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalNoteText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  aprobarBtn: {
    backgroundColor: '#10b981',
  },
  rechazarBtn: {
    backgroundColor: '#ef4444',
  },
  cerrarBtn: {
    backgroundColor: '#6b7280',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
