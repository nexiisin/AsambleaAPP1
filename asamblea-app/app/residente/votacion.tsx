import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/src/services/supabase';

export default function Votacion() {
  const { asambleaId, asistenciaId } = useLocalSearchParams<{ asambleaId: string; asistenciaId?: string }>();

  const [propuesta, setPropuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [viviendaId, setViviendaId] = useState<string | null>(null);

  const cargarPropuestaActiva = useCallback(async () => {
    if (!asambleaId) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('propuestas')
        .select('*')
        .eq('asamblea_id', asambleaId)
        .eq('estado', 'ABIERTA')
        .order('fecha_apertura', { ascending: false })
        .limit(1);

      setPropuesta(data?.[0] ?? null);
    } catch (e) {
      console.error('Error cargando propuesta activa:', e);
    } finally {
      setLoading(false);
    }
  }, [asambleaId]);

  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Cargar vivienda desde asistencia si se pasa asistenciaId
    const cargarAsistencia = async () => {
      if (!asistenciaId) return;
      try {
        const { data } = await supabase.from('asistencias').select('vivienda_id').eq('id', asistenciaId).single();
        setViviendaId(data?.vivienda_id ?? null);
      } catch (e) {
        console.error('Error cargando asistencia:', e);
      }
    };

    cargarAsistencia();
    cargarPropuestaActiva();

    // Suscribirse a actualizaciones de propuestas (solo UPDATE) y de la asamblea
    const channel = supabase
      .channel(`propuestas-residente-${asambleaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'propuestas', filter: `asamblea_id=eq.${asambleaId}` },
        () => {
          const now = Date.now();
          if (now - (lastUpdateRef.current || 0) > 800) {
            lastUpdateRef.current = now;
            cargarPropuestaActiva();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'asambleas', filter: `id=eq.${asambleaId}` },
        () => {
          const now = Date.now();
          if (now - (lastUpdateRef.current || 0) > 800) {
            lastUpdateRef.current = now;
            cargarPropuestaActiva();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asistenciaId, asambleaId, cargarPropuestaActiva]);

  const enviarVoto = async (tipo: 'SI' | 'NO') => {
    if (!propuesta) return;
    if (!asistenciaId || !viviendaId) {
      Alert.alert('Error', 'No se encontró tu registro de asistencia.');
      return;
    }

    setVoting(true);
    try {
      // Evitar duplicados: verificar si ya existe un voto para esta vivienda y propuesta
      const { data: existing } = await supabase
        .from('votos')
        .select('id')
        .eq('propuesta_id', propuesta.id)
        .eq('vivienda_id', viviendaId)
        .limit(1);

      if (existing && existing.length > 0) {
        setVoted(true);
        Alert.alert('Registro', 'Ya registraste tu voto para esta propuesta.');
        setVoting(false);
        return;
      }

      const { error } = await supabase.from('votos').insert({
        propuesta_id: propuesta.id,
        vivienda_id: viviendaId,
        asistencia_id: asistenciaId,
        tipo_voto: tipo,
      });

      if (error) {
        console.error('Error insertando voto:', error);
        Alert.alert('No se pudo registrar tu voto', error.message || '');
      } else {
        // Marcar localmente como votado para evitar reintentos mientras la app procesa el update
        setVoted(true);
        Alert.alert('Voto registrado', 'Gracias por participar');
      }
    } catch (e) {
      console.error('Error enviando voto:', e);
      Alert.alert('Error', 'No se pudo enviar el voto');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
        <ActivityIndicator size="large" color="#065f46" />
      </LinearGradient>
    );
  }

  if (!propuesta) {
    return (
      <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>No hay votación activa</Text>
          <Text style={styles.subtitle}>Espera a que el administrador inicie una votación.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.push({ pathname: '/residente/sala-espera', params: { asambleaId } })}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{propuesta.titulo}</Text>
        {propuesta.descripcion ? <Text style={styles.description}>{propuesta.descripcion}</Text> : null}

        {voted ? (
          <Text style={styles.thanks}>Tu voto fue registrado. Espera resultados.</Text>
        ) : (
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.yesBtn} onPress={() => enviarVoto('SI')} disabled={voting}>
              <Text style={styles.yesText}>{voting ? 'Enviando...' : 'SI'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.noBtn} onPress={() => enviarVoto('NO')} disabled={voting}>
              <Text style={styles.noText}>{voting ? 'Enviando...' : 'NO'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#374151', marginBottom: 12, textAlign: 'center' },
  description: { fontSize: 15, color: '#4b5563', marginBottom: 20, textAlign: 'center' },
  buttonsRow: { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'space-between' },
  yesBtn: { flex: 1, backgroundColor: '#16a34a', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  noBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginLeft: 8 },
  yesText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  noText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  thanks: { fontSize: 16, color: '#065f46', fontWeight: '600' },
  backBtn: { marginTop: 16, backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  backBtnText: { color: '#374151' },
});
