import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { styles as screenStyles } from '@/src/styles/screens/residente/votacion.styles';

const styles = screenStyles;

export default function Votacion() {
  const { asambleaId, asistenciaId } = useLocalSearchParams<{ asambleaId: string; asistenciaId?: string }>();

  const [propuesta, setPropuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [viviendaId, setViviendaId] = useState<string | null>(null);
  const [propuestaCerrada, setPropuestaCerrada] = useState(false);
  const [esApoderadoAprobado, setEsApoderadoAprobado] = useState(false);
  const [casaRepresentadaId, setCasaRepresentadaId] = useState<string | null>(null);
  const salidaFormRedirectedRef = useRef(false);

  const cargarPropuestaActiva = useCallback(async () => {
    if (!asambleaId) return;
    setLoading(true);

    try {
      // Verificar primero si hay resultados publicados
      const { data: asambleaData } = await supabase
        .from('asambleas')
        .select('propuesta_resultados_id')
        .eq('id', asambleaId)
        .single();

      console.log('🔍 (Votación) Verificando resultados:', asambleaData);

      // Si hay resultados publicados, redirigir automáticamente
      if (asambleaData?.propuesta_resultados_id) {
        console.log('➡️ (Votación) Redirigiendo a resultados:', asambleaData.propuesta_resultados_id);
        router.replace({
          pathname: '/residente/resultados',
          params: { 
            asambleaId, 
            asistenciaId,
            propuestaId: asambleaData.propuesta_resultados_id 
          },
        });
        return;
      }

      const { data } = await supabase
        .from('propuestas')
        .select('*')
        .eq('asamblea_id', asambleaId)
        .eq('estado', 'ABIERTA')
        .order('fecha_apertura', { ascending: false })
        .limit(1);

      const propuestaActual = data?.[0] ?? null;
      setPropuesta(propuestaActual);
      
      // Si no hay propuesta abierta, verificar si se cerró una
      if (!propuestaActual) {
        const { data: cerrada } = await supabase
          .from('propuestas')
          .select('*')
          .eq('asamblea_id', asambleaId)
          .eq('estado', 'CERRADA')
          .order('fecha_cierre', { ascending: false })
          .limit(1);
        
        if (cerrada?.[0]) {
          setPropuestaCerrada(true);
        }
      } else {
        setPropuestaCerrada(false);
      }
    } catch (e) {
      console.error('Error cargando propuesta activa:', e);
    } finally {
      setLoading(false);
    }
  }, [asambleaId, asistenciaId]);

  const lastPropuestaIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Cargar vivienda desde asistencia si se pasa asistenciaId
    const cargarAsistencia = async () => {
      if (!asistenciaId) return;
      try {
        const { data } = await supabase
          .from('asistencias')
          .select('vivienda_id, es_apoderado, estado_apoderado, casa_representada')
          .eq('id', asistenciaId)
          .single();
        
        setViviendaId(data?.vivienda_id ?? null);
        
        // Si es apoderado aprobado, cargar la vivienda_id de la casa representada
        if (data?.es_apoderado && data?.estado_apoderado === 'APROBADO' && data?.casa_representada) {
          setEsApoderadoAprobado(true);
          
          // Buscar la vivienda_id para el número de casa representada
          const { data: casaData } = await supabase
            .from('viviendas')
            .select('id')
            .eq('numero_casa', data.casa_representada)
            .single();
          
          if (casaData?.id) {
            setCasaRepresentadaId(casaData.id);
            console.log('✅ Apoderado aprobado - Casa representada ID:', casaData.id);
          }
        } else {
          setEsApoderadoAprobado(false);
          setCasaRepresentadaId(null);
        }
      } catch (e) {
        console.error('Error cargando asistencia:', e);
        setEsApoderadoAprobado(false);
        setCasaRepresentadaId(null);
      }
    };

    cargarAsistencia();
    cargarPropuestaActiva();

    // Suscribirse a actualizaciones de asambleas (solo para detectar cuando se publican resultados)
    const channel = supabase
      .channel(`propuestas-residente-${asambleaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'asambleas', filter: `id=eq.${asambleaId}` },
        (payload) => {
          // Solo recargar si cambió propuesta_resultados_id o propuesta_activa_id
          const newResultadosId = payload.new?.propuesta_resultados_id;
          if (newResultadosId) {
            console.log('📊 Resultados publicados, recargan datos');
            cargarPropuestaActiva();
          }
        }
      )
      .subscribe();

    // Broadcast para formulario de salida
    const broadcastChannel = supabase
      .channel(`asamblea-broadcast-${asambleaId}`)
      .on('broadcast', { event: 'mostrar-formulario-salida' }, (payload) => {
        try {
          if (salidaFormRedirectedRef.current) return;
          salidaFormRedirectedRef.current = true;
          console.log('📋 Admin mostró formulario de salida');
          router.replace({ pathname: '/residente/asistencia', params: { asambleaId, asistenciaId } });
        } catch (e) {
          console.error('Error redirigiendo a formulario de salida:', e);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
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
      // OPTIMIZACIÓN: Usar RPC function en lugar de 3 queries separadas
      // Esto reduce 3 queries × 164 usuarios = 492 queries a 164 RPC calls
      
      const { data, error } = await supabase.rpc('registrar_voto', {
        p_propuesta_id: propuesta.id,
        p_vivienda_id: viviendaId,
        p_asistencia_id: asistenciaId,
        p_tipo_voto: tipo,
        p_casa_representada_id: esApoderadoAprobado ? casaRepresentadaId : null,
      });

      if (error) {
        console.error('Error registrando voto:', error);
        
        // Si el error es "Ya existe un voto", no mostrar alerta
        if (error.message?.includes('voto')) {
          setVoted(true);
        } else {
          Alert.alert('❌ Error', 'No se pudo registrar tu voto. Intenta nuevamente.');
        }
        setVoting(false);
        return;
      }

      if (data?.success) {
        setVoted(true);
        if (esApoderadoAprobado && casaRepresentadaId) {
          console.log('✅ Voto registrado para ambas viviendas (via RPC)');
        } else {
          console.log('✅ Voto registrado (via RPC)');
        }
      } else {
        console.error('Error RPC:', data?.error);
        Alert.alert('Error', data?.error || 'No se pudo registrar el voto');
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
    // Si hay una propuesta cerrada recientemente, mostrar mensaje de espera
    if (propuestaCerrada) {
      return (
        <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.title}>Votación cerrada</Text>
            <Text style={styles.waitingMessage}>
              Podrá ver los resultados en un momento
            </Text>
            <Text style={styles.waitingSubtext}>
              El administrador publicará los resultados pronto
            </Text>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => router.push({ pathname: '/residente/sala-espera', params: { asambleaId, asistenciaId } })}
            >
              <Text style={styles.backBtnText}>Volver a sala de espera</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      );
    }
    
    return (
      <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>No hay votación activa</Text>
          <Text style={styles.subtitle}>Espera a que el administrador inicie una votación.</Text>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => router.push({ pathname: '/residente/sala-espera', params: { asambleaId, asistenciaId } })}
          >
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.ballotIcon}>🗳️</Text>
        </View>
        
        <Text style={styles.title}>{propuesta.titulo}</Text>
        {propuesta.descripcion ? <Text style={styles.description}>{propuesta.descripcion}</Text> : null}

        {/* Botones de votación */}
        {voted ? (
          <View style={styles.thanksContainer}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>
            <Text style={styles.thanks}>¡Voto registrado exitosamente!</Text>
            <Text style={styles.thanksSubtext}>Gracias por participar en la votación</Text>
            <Text style={styles.thanksNote}>Espera a que el administrador cierre la votación para ver los resultados</Text>
          </View>
        ) : (
          <>
            <Text style={styles.votePrompt}>¿Cuál es tu voto?</Text>
            <View style={styles.buttonsRow}>
              <TouchableOpacity 
                style={[styles.voteBtn, styles.yesBtn]} 
                onPress={() => enviarVoto('SI')} 
                disabled={voting}
                activeOpacity={0.8}
              >
                <Text style={styles.voteBtnIcon}>👍</Text>
                <Text style={styles.voteBtnText}>{voting ? 'Enviando...' : 'SÍ'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.voteBtn, styles.noBtn]} 
                onPress={() => enviarVoto('NO')} 
                disabled={voting}
                activeOpacity={0.8}
              >
                <Text style={styles.voteBtnIcon}>👎</Text>
                <Text style={styles.voteBtnText}>{voting ? 'Enviando...' : 'NO'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}
