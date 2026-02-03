import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';

const PANEL_WIDTH = 520;

export default function Propuestas() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    if (!asambleaId) return;
    const { data } = await supabase
      .from('propuestas')
      .select('*')
      .eq('asamblea_id', asambleaId)
      .order('orden', { ascending: true });

    setPropuestas(data || []);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asambleaId]);

  const crearPropuesta = async () => {
    if (!titulo.trim()) {
      Alert.alert('Validación', 'El título es obligatorio');
      return;
    }

    setCargando(true);
    try {
      // Obtener el mayor `orden` existente para evitar colisiones concurrentes
      const { data: last } = await supabase
        .from('propuestas')
        .select('orden')
        .eq('asamblea_id', asambleaId)
        .order('orden', { ascending: false })
        .limit(1)
        .single();

      const orden = (last?.orden ?? 0) + 1;

      // `estado` debe respetar el CHECK de la tabla: 'BORRADOR'|'ABIERTA'|'CERRADA'
      if (editingId) {
        const { error } = await supabase
          .from('propuestas')
          .update({ titulo: titulo.trim(), descripcion: descripcion.trim() || null })
          .eq('id', editingId);

        if (error) throw error;

        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('propuestas')
          .insert({
            asamblea_id: asambleaId,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            estado: 'BORRADOR',
            orden,
          });

        if (error) throw error;
      }

      setTitulo('');
      setDescripcion('');
      setModalVisible(false);
      await cargar();
    } catch (e) {
      console.error('Error creando propuesta:', e);
      Alert.alert('Error', 'No se pudo crear la propuesta');
    } finally {
      setCargando(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setTitulo(item.titulo || '');
    setDescripcion(item.descripcion || '');
    setModalVisible(true);
  };

  const handleVotar = async (item: any) => {
    if (!asambleaId) return;
    try {
      setCargando(true);
      // Llamar RPC iniciar_votacion(p_asamblea_id, p_propuesta_id)
      const { error } = await supabase.rpc('iniciar_votacion', {
        p_asamblea_id: asambleaId,
        p_propuesta_id: item.id,
      });

      if (error) throw error;
      Alert.alert('✅ Votación iniciada', 'Los residentes pueden votar ahora');
      await cargar();
    } catch (e) {
      console.error('Error iniciando votación:', e);
      Alert.alert('Error', 'No se pudo iniciar la votación');
    } finally {
      setCargando(false);
    }
  };

  const handleCerrarVotacion = async (item: any) => {
    if (!asambleaId) {
      console.log('❌ No hay asambleaId');
      return;
    }
    
    console.log('🔴 handleCerrarVotacion llamado para asamblea:', asambleaId);
    
    try {
      setCargando(true);
      
      console.log('📞 Llamando RPC cerrar_votacion...');
      const { data, error } = await supabase.rpc('cerrar_votacion', {
        p_asamblea_id: asambleaId,
      });

      console.log('📡 Respuesta RPC:', { data, error });

      if (error) {
        console.error('❌ Error en RPC:', error);
        Alert.alert('❌ Error', `No se pudo cerrar la votación: ${error.message}`);
        return;
      }
      
      console.log('✅ Votación cerrada exitosamente');
      Alert.alert('✅ Éxito', 'Votación cerrada correctamente');
      await cargar();
    } catch (e: any) {
      console.error('💥 Excepción cerrando votación:', e);
      Alert.alert('❌ Error', `Excepción: ${e.message || e}`);
    } finally {
      setCargando(false);
      console.log('🏁 handleCerrarVotacion terminado');
    }
  };

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📋 Listado de propuestas</Text>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>➕ Crear propuesta</Text>
        </TouchableOpacity>

        {propuestas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No hay propuestas aún</Text>
            <Text style={styles.emptySubtext}>Crea la primera propuesta para iniciar</Text>
          </View>
        ) : (
          <FlatList
            data={propuestas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40, alignItems: 'center', width: '100%' }}
            style={{ width: '100%' }}
            renderItem={({ item, index }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>#{index + 1}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: item.estado === 'ABIERTA' ? '#dcfce7' : item.estado === 'CERRADA' ? '#fee2e2' : '#f3f4f6'
                  }]}>
                    <Text style={[styles.statusBadgeText, {
                      color: item.estado === 'ABIERTA' ? '#15803d' : item.estado === 'CERRADA' ? '#991b1b' : '#6b7280'
                    }]}>
                      {item.estado === 'ABIERTA' ? '🟢 Abierta' : item.estado === 'CERRADA' ? '🔴 Cerrada' : '📝 Borrador'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  {item.descripcion ? (
                    <Text style={styles.cardText}>{item.descripcion}</Text>
                  ) : null}
                </View>

                <View style={styles.cardActions}>
                  {item.estado !== 'CERRADA' && (
                    <TouchableOpacity 
                      style={styles.editBtn} 
                      onPress={() => handleEdit(item)}
                      disabled={item.estado === 'ABIERTA'}
                    >
                      <Text style={styles.editBtnText}>✏️ Editar</Text>
                    </TouchableOpacity>
                  )}

                  {item.estado === 'BORRADOR' && (
                    <TouchableOpacity 
                      style={styles.voteBtn} 
                      onPress={() => handleVotar(item)}
                      disabled={cargando}
                    >
                      <Text style={styles.voteBtnText}>
                        🗳️ Iniciar votación
                      </Text>
                    </TouchableOpacity>
                  )}

                  {item.estado === 'ABIERTA' && (
                    <TouchableOpacity 
                      style={styles.closeBtn} 
                      onPress={() => handleCerrarVotacion(item)}
                      disabled={cargando}
                    >
                      <Text style={styles.closeBtnText}>
                        🔴 Cerrar votación
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        )}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.content}>
              <Text style={modalStyles.heading}>
                {editingId ? '✏️ Editar propuesta' : '➕ Nueva propuesta'}
              </Text>

              <TextInput
                placeholder="Título de la propuesta"
                value={titulo}
                onChangeText={setTitulo}
                style={modalStyles.input}
              />

              <TextInput
                placeholder="Descripción (opcional)"
                value={descripcion}
                onChangeText={setDescripcion}
                style={[modalStyles.input, { height: 100 }]}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={modalStyles.cancelBtn}
                  onPress={() => {
                    setModalVisible(false);
                    setEditingId(null);
                    setTitulo('');
                    setDescripcion('');
                  }}
                >
                  <Text style={{ color: '#374151' }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={modalStyles.confirmBtn}
                  onPress={crearPropuesta}
                  disabled={cargando}
                >
                  <Text style={{ color: '#fff' }}>
                    {cargando ? '⏳ Guardando...' : editingId ? 'Guardar' : 'Crear'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: 700, padding: 16, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', marginBottom: 8 },
  backButtonText: { color: '#065f46', fontWeight: '700', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 16, color: '#1f2937' },
  createButton: { 
    backgroundColor: '#16a34a', 
    paddingVertical: 16, 
    paddingHorizontal: 28, 
    borderRadius: 14, 
    marginBottom: 24,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyBox: { 
    backgroundColor: '#fff', 
    padding: 40, 
    borderRadius: 16, 
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: '#374151', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: '#9ca3af', fontSize: 14 },
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    width: '100%',
    maxWidth: 650,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderBadgeText: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontWeight: '600',
    fontSize: 13,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1f2937' },
  cardText: { color: '#4b5563', marginBottom: 12, fontSize: 15, lineHeight: 22 },
  meta: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  cardBody: { marginBottom: 16 },
  cardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  editBtn: { 
    backgroundColor: '#f3f4f6', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  editBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  voteBtn: { 
    backgroundColor: '#2563eb', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  voteBtnDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  voteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  closeBtn: { 
    backgroundColor: '#dc2626', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultsBtn: { 
    backgroundColor: '#16a34a', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '90%', maxWidth: 420, backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#fafafa' },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center' },
});
