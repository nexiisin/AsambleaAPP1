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
import { useLocalSearchParams } from 'expo-router';
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
      Alert.alert('Votación', 'Se inició la votación para la propuesta');
      await cargar();
    } catch (e) {
      console.error('Error iniciando votación:', e);
      Alert.alert('Error', 'No se pudo iniciar la votación');
    } finally {
      setCargando(false);
    }
  };

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View style={styles.container}>
        <Text style={styles.title}>Listado de propuestas</Text>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>➕ Crear propuesta</Text>
        </TouchableOpacity>

        {propuestas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay propuestas aún</Text>
          </View>
        ) : (
          <FlatList
            data={propuestas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.titulo}</Text>
                    {item.descripcion ? (
                      <Text style={styles.cardText}>{item.descripcion}</Text>
                    ) : null}
                    <Text style={styles.meta}>Estado: {item.estado}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                      <Text style={styles.editBtnText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.voteBtn} onPress={() => handleVotar(item)}>
                      <Text style={styles.voteBtnText}>Votar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
            )}
          />
        )}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.content}>
              <Text style={modalStyles.heading}>Nueva propuesta</Text>

              <TextInput
                placeholder="Título"
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
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={{ color: '#374151' }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={modalStyles.confirmBtn}
                  onPress={crearPropuesta}
                  disabled={cargando}
                >
                  <Text style={{ color: '#fff' }}>{cargando ? 'Creando...' : 'Crear'}</Text>
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
  page: { flex: 1 },
  container: { width: '100%', maxWidth: PANEL_WIDTH, padding: 16, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  createButton: { backgroundColor: '#16a34a', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, marginBottom: 16 },
  createButtonText: { color: '#fff', fontWeight: '600' },
  emptyBox: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginTop: 8 },
  emptyText: { color: '#374151' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, width: '100%', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardText: { color: '#374151', marginBottom: 8 },
  meta: { color: '#6b7280', fontSize: 13 },
  cardBody: { flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
  editBtn: { backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editBtnText: { color: '#374151', fontWeight: '600' },
  voteBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  voteBtnText: { color: '#fff', fontWeight: '600' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '90%', maxWidth: 420, backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#fafafa' },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center' },
});
