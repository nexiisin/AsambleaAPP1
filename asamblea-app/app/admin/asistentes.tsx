import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';

type Asistente = {
  id: string;
  nombre_asistente: string;
  vivienda_id: string;
  numero_casa: string;
  fecha_registro: string | null;
  es_apoderado: boolean;
  casa_representada: string | null;
  estado_apoderado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | null;
};

const PANEL_WIDTH = 520;

export default function AdminAsistentes() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();

  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [totalCasas, setTotalCasas] = useState(0);
  const [totalAsistentes, setTotalAsistentes] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const broadcastChannelRef = useRef<any>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  const cargarAsistentes = async () => {
    if (!asambleaId) return;

    try {
      setCargando(true);

      // Query optimizada CON JOIN: obtener asistencias + datos de vivienda en 1 query
      const { data: asistencias, error: errorAsistencias } = await supabase
        .from('asistencias')
        .select(
          'id, nombre_asistente, vivienda_id, fecha_registro, es_apoderado, casa_representada, estado_apoderado, viviendas(numero_casa)'
        )
        .eq('asamblea_id', asambleaId)
        .order('fecha_registro', { ascending: false });

      if (errorAsistencias) throw errorAsistencias;

      const asistentesConCasa: Asistente[] = (asistencias || []).map((a: any) => ({
        id: a.id,
        nombre_asistente: a.nombre_asistente,
        vivienda_id: a.vivienda_id,
        numero_casa: a.viviendas?.numero_casa || 'N/A',
        fecha_registro: a.fecha_registro ?? null,
        es_apoderado: !!a.es_apoderado,
        casa_representada: a.casa_representada ?? null,
        estado_apoderado: a.estado_apoderado ?? null,
      }));

      setAsistentes(asistentesConCasa);

      let total = asistentesConCasa.length;
      asistentesConCasa.forEach(a => {
        if (a.es_apoderado && a.estado_apoderado === 'APROBADO') {
          total += 1;
        }
      });
      setTotalAsistentes(total);

      const { count: countCasas } = await supabase
        .from('viviendas')
        .select('*', { count: 'exact', head: true });

      setTotalCasas(countCasas || 0);
    } catch (e) {
      console.error('Error cargando asistentes:', e);
    } finally {
      setCargando(false);
    }
  };

  // Agregar dinámicamente sin recargar todo
  const agregarAsistenteAlista = async (asistenciaId: string) => {
    try {
      const { data, error } = await supabase
        .from('asistencias')
        .select('id, nombre_asistente, vivienda_id, fecha_registro, es_apoderado, casa_representada, estado_apoderado, viviendas(numero_casa)')
        .eq('id', asistenciaId)
        .single();

      if (error || !data) return;

      const nuevoAsistente: Asistente = {
        id: data.id,
        nombre_asistente: data.nombre_asistente,
        vivienda_id: data.vivienda_id,
        numero_casa: (data as any).viviendas?.numero_casa || 'N/A',
        fecha_registro: data.fecha_registro,
        es_apoderado: !!data.es_apoderado,
        casa_representada: data.casa_representada ?? null,
        estado_apoderado: data.estado_apoderado ?? null,
      };

      setAsistentes(prev => [nuevoAsistente, ...prev]);
      
      // Actualizar conteo total
      setTotalAsistentes(prev => {
        let nueva = prev + 1;
        if (nuevoAsistente.es_apoderado && nuevoAsistente.estado_apoderado === 'APROBADO') {
          nueva += 1;
        }
        return nueva;
      });
    } catch (e) {
      console.error('Error agregando asistente:', e);
    }
  };

  // Debounce para recargas completas (en caso de cambios de estado)
  const cargarAsistentesDebounced = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      cargarAsistentes();
    }, 2000); // Esperar 2 segundos antes de recargar
  };

  useEffect(() => {
    cargarAsistentes();

    const channel = supabase
      .channel(`asistentes-${asambleaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asistencias', filter: `asamblea_id=eq.${asambleaId}` },
        (payload) => {
          console.log('🔔 Nuevo asistente registrado, agregando a lista');
          // Agregar dinámicamente en lugar de recargar todo
          agregarAsistenteAlista(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'asistencias', filter: `asamblea_id=eq.${asambleaId}` },
        (payload) => {
          console.log('🔄 Estado de asistente actualizado, recargando en 2s');
          // Solo recargar cuando hay cambios de estado (con debounce)
          cargarAsistentesDebounced();
        }
      )
      .subscribe();

    const broadcastChannel = supabase.channel(`asamblea-broadcast-${asambleaId}`);
    broadcastChannel.subscribe();
    broadcastChannelRef.current = broadcastChannel;

    return () => {
      supabase.removeChannel(channel);
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [asambleaId]);

  const permitirSalidaAnticipada = async (asistente: Asistente) => {
    if (!asambleaId || !asistente?.id) return;

    try {
      const channel = broadcastChannelRef.current;
      if (!channel) return;

      await channel.send({
        type: 'broadcast',
        event: 'asistencia',
        payload: { asistenciaId: asistente.id },
      });
    } catch (e) {
      console.error('Error enviando salida anticipada:', e);
    }
  };

  const asistentesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return asistentes;
    const q = busqueda.trim().toLowerCase();
    return asistentes.filter(a =>
      a.nombre_asistente?.toLowerCase().includes(q) ||
      a.numero_casa?.toLowerCase().includes(q)
    );
  }, [asistentes, busqueda]);

  const renderItem = ({ item }: { item: Asistente }) => {
    const estadoColor = item.estado_apoderado === 'APROBADO'
      ? '#10b981'
      : item.estado_apoderado === 'RECHAZADO'
        ? '#ef4444'
        : item.estado_apoderado === 'PENDIENTE'
          ? '#fbbf24'
          : '#e5e7eb';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.nombre_asistente}</Text>
          <View style={[styles.badge, { backgroundColor: estadoColor }]}>
            <Text style={styles.badgeText}>
              {item.es_apoderado ? (item.estado_apoderado || 'APODERADO') : 'ASISTENTE'}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🏠 Casa:</Text>
          <Text style={styles.value}>{item.numero_casa}</Text>
        </View>

        {item.es_apoderado && item.casa_representada ? (
          <View style={styles.row}>
            <Text style={styles.label}>📋 Representa:</Text>
            <Text style={styles.value}>Casa {item.casa_representada}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label}>⏰ Registro:</Text>
          <Text style={styles.value}>
            {item.fecha_registro
              ? new Date(item.fecha_registro).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
              : 'N/A'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.salidaButton}
          onPress={() => permitirSalidaAnticipada(item)}
        >
          <Text style={styles.salidaButtonText}>Permitir salida anticipada</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (cargando) {
    return (
      <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#065f46" />
          <Text style={styles.loadingText}>Cargando asistentes...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>👥 Listado de asistentes</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total asistentes</Text>
            <Text style={styles.statValue}>{totalAsistentes}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total casas</Text>
            <Text style={styles.statValue}>{totalCasas}</Text>
          </View>
        </View>

        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre o casa"
          style={styles.search}
        />

        {asistentesFiltrados.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay asistentes registrados</Text>
          </View>
        ) : (
          <FlatList
            data={asistentesFiltrados}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: {
    flex: 1,
    maxWidth: PANEL_WIDTH,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#065f46', fontWeight: '600' },
  backButton: { marginBottom: 12 },
  backButtonText: { color: '#065f46', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#065f46', textAlign: 'center', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: { color: '#6b7280', fontSize: 14 },
  statValue: { color: '#065f46', fontSize: 24, fontWeight: '700' },
  search: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  value: { color: '#1f2937', fontSize: 13, fontWeight: '700' },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyText: { color: '#6b7280', fontSize: 15 },
  salidaButton: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  salidaButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});