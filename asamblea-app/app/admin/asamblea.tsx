import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert,
  ScrollView,
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
import { descargarActaAsamblea } from '@/src/services/pdf-acta';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { useResponsive } from '@/src/hooks/useResponsive';
import { useFontSize } from '@/src/hooks/useFontSize';
import { styles, modalStyles } from '@/src/styles/screens/admin/asamblea.styles';

export default function AdminAsamblea() {
  const { isDesktop } = useResponsive();
  
  // Obtener getFontSize con manejo seguro de contexto
  let getFontSize = (size: number) => size;
  try {
    const fontSizeContext = useFontSize();
    getFontSize = fontSizeContext.getFontSize;
  } catch (e) {
    // Si el contexto no está disponible, usar tamaños base
  }
  
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();

  const [asamblea, setAsamblea] = useState<any>(null);
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [propuestaAbierta, setPropuestaAbierta] = useState<any>(null);
  const [totalAsistentes, setTotalAsistentes] = useState(0);
  const [totalViviendas, setTotalViviendas] = useState<number | null>(null);
  const [porcentajeQuorum, setPorcentajeQuorum] = useState(0);
  const [quorumCumplido, setQuorumCumplido] = useState(false);
  const [apoderadosPendientes, setApoderadosPendientes] = useState(0);
  const [tiempoRestante, setTiempoRestante] = useState('');
  const [asistenciaModalVisible, setAsistenciaModalVisible] = useState(false);
  const [cerrarModalVisible, setCerrarModalVisible] = useState(false);
  const [cerrandoAsamblea, setCerrandoAsamblea] = useState(false);
  const [codigoModalVisible, setCodigoModalVisible] = useState(false);
  const [formularioSalidaModalVisible, setFormularioSalidaModalVisible] = useState(false);
  const [formularioSalidaEnviado, setFormularioSalidaEnviado] = useState(false);
  const [totalConectadosSalida, setTotalConectadosSalida] = useState(0);
  const [totalSalidasCompletadas, setTotalSalidasCompletadas] = useState(0);
  const debounceTimeoutRef = useRef<number | null>(null);
  const exitDebounceTimeoutRef = useRef<number | null>(null);

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
      .select('vivienda_id, es_apoderado, estado_apoderado, casa_representada')
      .eq('asamblea_id', asambleaId);

    // Calcular viviendas únicas representadas (igual que en cronometro)
    const setViviendas = new Set<string>();
    let pendientes = 0;

    (asistencias || []).forEach(asistencia => {
      setViviendas.add(asistencia.vivienda_id);
      if (asistencia.es_apoderado) {
        if (asistencia.estado_apoderado === 'APROBADO' && asistencia.casa_representada) {
          setViviendas.add(asistencia.casa_representada);
        }
        if (asistencia.estado_apoderado === 'PENDIENTE') {
          pendientes += 1;
        }
      }
    });

    const viviendasRepresentadas = setViviendas.size;

    let totalVivs = a?.total_viviendas ?? null;
    if (!totalVivs) {
      const { count: viviendasCount } = await supabase
        .from('viviendas')
        .select('*', { count: 'exact', head: true });
      totalVivs = viviendasCount || null;
    }

    const pct = totalVivs ? Math.round((viviendasRepresentadas / totalVivs) * 100) : 0;
    const minimoViviendas = totalVivs ? Math.floor(totalVivs / 2) + 1 : 0;
    const cumple = viviendasRepresentadas >= minimoViviendas;

    setTotalViviendas(totalVivs);
    setTotalAsistentes(viviendasRepresentadas);
    setApoderadosPendientes(pendientes);
    setPorcentajeQuorum(pct);
    setQuorumCumplido(cumple);
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

    // Suscripción a cambios en asistencias (debounced para evitar cascada de 164 queries)
    const asistenciasSubscription = supabase
      .channel('asistencias-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'asistencias',
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        (payload) => {
          console.log('🆕 Nueva asistencia registrada, debouncing...');
          // OPTIMIZACIÓN Priority 3.1: Debounce para evitar 164 recargas simultáneas
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          debounceTimeoutRef.current = setTimeout(() => {
            cargarTodo();
            debounceTimeoutRef.current = null;
          }, 1000) as unknown as number;
        }
      )
      .subscribe();

    // Suscripción a cambios en votos deshabilitada para evitar recargas en cascada
    // Los conteos de votos se actualizan mediante triggers sin notificar al admin en tiempo real
    const votosSubscription = null;

    // Timer para actualizar el contador de tiempo
    const timer = setInterval(() => {
      calcularTiempoRestante();
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(timer);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      supabase.removeChannel(asambleasSubscription);
      supabase.removeChannel(propuestasSubscription);
      supabase.removeChannel(asistenciasSubscription);
      if (votosSubscription) supabase.removeChannel(votosSubscription);
    };
  }, [asambleaId, cargarTodo, calcularTiempoRestante]);

  // Effect para cargar datos de salida cuando se abre el modal
  useEffect(() => {
    if (!formularioSalidaModalVisible || !asambleaId) return;

    const cargarDatosExit = async () => {
      try {
        // 1. Obtener todas las asistencias de la asamblea
        const { data: asistencias } = await supabase
          .from('asistencias')
          .select('vivienda_id, es_apoderado, estado_apoderado, casa_representada, formulario_cierre_completado, salida_autorizada')
          .eq('asamblea_id', asambleaId);

        if (!asistencias) {
          setTotalConectadosSalida(0);
          setTotalSalidasCompletadas(0);
          return;
        }

        // 2. Calcular total conectados (contando personas, no viviendas)
        // Cada asistencia es 1 persona, si es apoderado APROBADO suma 1 más
        let totalConectados = 0;
        let salidasCompletadas = 0;

        asistencias.forEach(asistencia => {
          // Contar cada asistencia como 1 persona
          totalConectados += 1;
          
          // Si es apoderado APROBADO, contar como otra persona extra
          if (asistencia.es_apoderado && asistencia.estado_apoderado === 'APROBADO' && asistencia.casa_representada) {
            totalConectados += 1;
          }

          // Contar si completó salida (marca de formulario O salida autorizada)
          if (asistencia.formulario_cierre_completado || asistencia.salida_autorizada) {
            salidasCompletadas += 1;
            // Si es apoderado APROBADO y completó salida, contar la salida de ambas personas
            if (asistencia.es_apoderado && asistencia.estado_apoderado === 'APROBADO' && asistencia.casa_representada) {
              salidasCompletadas += 1;
            }
          }
        });

        setTotalConectadosSalida(totalConectados);
        setTotalSalidasCompletadas(salidasCompletadas);
      } catch (error) {
        console.error('Error cargando datos de salida:', error);
      }
    };

    cargarDatosExit();

    // Suscripción a cambios en asistencias para actualizar contador en tiempo real
    const exitSubscription = supabase
      .channel('asistencias-exit-' + asambleaId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencias',
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        () => {
          if (exitDebounceTimeoutRef.current) {
            clearTimeout(exitDebounceTimeoutRef.current);
          }
          exitDebounceTimeoutRef.current = setTimeout(() => {
            cargarDatosExit();
            exitDebounceTimeoutRef.current = null;
          }, 500) as unknown as number;
        }
      )
      .subscribe();

    return () => {
      if (exitDebounceTimeoutRef.current) clearTimeout(exitDebounceTimeoutRef.current);
      supabase.removeChannel(exitSubscription);
    };
  }, [formularioSalidaModalVisible, asambleaId]);

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
      // Redirigir directamente al panel administrador
      router.replace('/admin');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Ocurrió un error al cerrar la asamblea');
      setCerrandoAsamblea(false);
    }
  };

  const mostrarFormularioSalida = async () => {
    if (!asambleaId) return;
    
    try {
      const chName = `asamblea-broadcast-${asambleaId}`;
      const channel = supabase.channel(chName);
      await channel.subscribe();
      await channel.send({ 
        type: 'broadcast', 
        event: 'mostrar-formulario-salida', 
        payload: { asambleaId } 
      });
      supabase.removeChannel(channel);
      
      // Marcar como enviado en lugar de cerrar el modal inmediatamente
      setFormularioSalidaEnviado(true);
      Alert.alert('✅ Enviado', 'Se ha enviado el formulario de salida a todos los residentes');
    } catch (e) {
      console.error('Error enviando formulario de salida:', e);
      Alert.alert('Error', 'No se pudo enviar el formulario de salida');
    }
  };

  // Crear estilos dinámicos basados en el tamaño de letra seleccionado
  const getDynamicStyles = () => ({
    headerLabel: { fontSize: getFontSize(14) },
    codigo: { fontSize: getFontSize(48) },
    codigoDesktop: { fontSize: getFontSize(56) },
    estadoBadgeText: { fontSize: getFontSize(14) },
    estadoBadgeTextDesktop: { fontSize: getFontSize(18) },
    systemStatusIcon: { fontSize: getFontSize(24) },
    systemStatusTitle: { fontSize: getFontSize(14) },
    systemStatusValue: { fontSize: getFontSize(20) },
    systemStatusValueDesktop: { fontSize: getFontSize(24) },
    closeNowBtnText: { fontSize: getFontSize(14) },
    statIcon: { fontSize: getFontSize(32) },
    statIconDesktop: { fontSize: getFontSize(36) },
    statNumber: { fontSize: getFontSize(40) },
    statNumberDesktop: { fontSize: getFontSize(44) },
    statLabel: { fontSize: getFontSize(14) },
    statLabelDesktop: { fontSize: getFontSize(18) },
    statusTitle: { fontSize: getFontSize(16) },
    statusTitleDesktop: { fontSize: getFontSize(20) },
    statusValue: { fontSize: getFontSize(24) },
    statusValueDesktop: { fontSize: getFontSize(24) },
    quorumAlertIcon: { fontSize: getFontSize(24) },
    quorumAlertText: { fontSize: getFontSize(14) },
    debateBtnText: { fontSize: getFontSize(18) },
    debateBtnTextDesktop: { fontSize: getFontSize(22) },
    consoleTitle: { fontSize: getFontSize(18) },
    consoleTitleDesktop: { fontSize: getFontSize(22) },
    actionCardText: { fontSize: getFontSize(14) },
    actionCardTextDesktop: { fontSize: getFontSize(16) },
    closeAssemblyBtnText: { fontSize: getFontSize(16) },
    closeAssemblyBtnTextDesktop: { fontSize: getFontSize(22) },
    closeNowBtn: { fontSize: getFontSize(14) },
  });

  if (!asamblea) {
    return <View style={styles.center}><Text>Cargando…</Text></View>;
  }

  const dynamicStyles = getDynamicStyles();
  const estadoVisual = asamblea.estado || asamblea.estado_actual || 'ESPERA';
  const estadoColor = estadoVisual === 'CERRADA' ? '#dc2626' : '#16a34a';

  return (
    <LinearGradient
      colors={['#10b981', '#ffffff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={[styles.page, isDesktop && styles.pageDesktop]}>
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>

        {/* ESTADO DEL SISTEMA */}
        <View style={[styles.systemStatusCard, isDesktop && styles.systemStatusCardDesktop]}>
          <View style={styles.systemStatusHeader}>
            <Text style={[styles.systemStatusIcon, dynamicStyles.systemStatusIcon]}>⏱️</Text>
            <Text style={[styles.systemStatusTitle, dynamicStyles.systemStatusTitle]}>TIEMPO DE INGRESO</Text>
          </View>
          <Text style={[styles.systemStatusValue, isDesktop && styles.systemStatusValueDesktop, dynamicStyles.systemStatusValue, isDesktop && dynamicStyles.systemStatusValueDesktop]}>
            {!asamblea.hora_cierre_ingreso 
              ? 'ABIERTO' 
              : tiempoRestante || 'Calculando...'}
          </Text>
          {asamblea.hora_cierre_ingreso && tiempoRestante && tiempoRestante !== 'CERRADO' && (
            <TouchableOpacity
              style={styles.closeNowBtn}
              onPress={async () => {
                await supabase
                  .from('asambleas')
                  .update({ hora_cierre_ingreso: new Date().toISOString() })
                  .eq('id', asambleaId);
              }}
            >
              <Text style={[styles.closeNowBtnText, dynamicStyles.closeNowBtnText]}>Cerrar ingreso ahora</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ESTADÍSTICAS EN CARDS */}
        <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
          <View style={[styles.statCard, isDesktop && styles.statCardDesktop]}>
            <Text style={[styles.statIcon, isDesktop && styles.statIconDesktop, dynamicStyles.statIcon, isDesktop && dynamicStyles.statIconDesktop]}>👥</Text>
            <Text style={[styles.statNumber, isDesktop && styles.statNumberDesktop, dynamicStyles.statNumber, isDesktop && dynamicStyles.statNumberDesktop]}>{totalAsistentes}</Text>
            <Text style={[styles.statLabel, isDesktop && styles.statLabelDesktop, dynamicStyles.statLabel, isDesktop && dynamicStyles.statLabelDesktop]}>Asistentes</Text>
          </View>
          <View style={[styles.statCard, isDesktop && styles.statCardDesktop]}>
            <Text style={[styles.statIcon, isDesktop && styles.statIconDesktop, dynamicStyles.statIcon, isDesktop && dynamicStyles.statIconDesktop]}>💡</Text>
            <Text style={[styles.statNumber, isDesktop && styles.statNumberDesktop, dynamicStyles.statNumber, isDesktop && dynamicStyles.statNumberDesktop]}>{propuestas.length}</Text>
            <Text style={[styles.statLabel, isDesktop && styles.statLabelDesktop, dynamicStyles.statLabel, isDesktop && dynamicStyles.statLabelDesktop]}>Propuestas</Text>
          </View>
        </View>

        {/* ESTADO Y QUORUM */}
        <View style={[styles.statusCard, isDesktop && styles.statusCardDesktop]}>
          <Text style={[styles.statusTitle, isDesktop && styles.statusTitleDesktop, dynamicStyles.statusTitle, isDesktop && dynamicStyles.statusTitleDesktop]}>📊 Estado de la asamblea</Text>
          <Text style={[styles.statusValue, isDesktop && styles.statusValueDesktop, dynamicStyles.statusValue, isDesktop && dynamicStyles.statusValueDesktop, { color: estadoColor }]}>{estadoVisual}</Text>
          
          {!quorumCumplido && (
            <View style={styles.quorumAlert}>
              <Text style={styles.quorumAlertIcon}>⚠️</Text>
              <Text style={styles.quorumAlertText}>
                Se requiere mínimo 50% + 1 vivienda ({totalViviendas ? Math.floor(totalViviendas / 2) + 1 : '?'} viviendas) para iniciar.
              </Text>
            </View>
          )}
        </View>

        {/* BOTÓN INICIAR DEBATE */}
        <TouchableOpacity
          style={[
            styles.debateBtn, 
            isDesktop && styles.debateBtnDesktop
          ]}
          onPress={() =>
            router.push({
              pathname: '/admin/cronometro',
              params: { asambleaId },
            })
          }
        >
          <Text style={[styles.debateBtnText, isDesktop && styles.debateBtnTextDesktop, dynamicStyles.debateBtnText, isDesktop && dynamicStyles.debateBtnTextDesktop]}>💬 Iniciar debate</Text>
        </TouchableOpacity>

        {/* CONSOLA DE GESTIÓN */}
        <View style={styles.managementConsole}>
          <Text style={[styles.consoleTitle, isDesktop && styles.consoleTitleDesktop, dynamicStyles.consoleTitle, isDesktop && dynamicStyles.consoleTitleDesktop]}>Consola de gestión</Text>
          
          <View style={[styles.actionGrid, isDesktop && styles.actionGridDesktop]}>
            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#059669' }]}
              onPress={() => router.push({ pathname: '/admin/asistentes', params: { asambleaId } })}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>🧑‍🤝‍🧑</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>Listado de asistentes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#2563eb' }]}
              onPress={() => router.push({ pathname: '/admin/resultados', params: { asambleaId } })}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>📊</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>Ver resultados</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#8b5cf6' }]}
              onPress={() => setCodigoModalVisible(true)}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>❕</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>Mostrar código</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#2563eb' }]}
              onPress={() => router.push({ pathname: '/admin/propuestas', params: { asambleaId } })}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>📋</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>Listado de propuestas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#0ea5a4' }]}
              onPress={() => router.push({ pathname: '/admin/apoderados', params: { asambleaId } })}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>👥</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>{`Apoderados pendientes (${apoderadosPendientes})`}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, isDesktop && styles.actionCardDesktop, { backgroundColor: '#6366f1' }]}
              onPress={async () => {
                try {
                  Alert.alert('Generando acta', 'Por favor espera...');
                  if (asambleaId) {
                    await descargarActaAsamblea(asambleaId);
                    Alert.alert('✓ Éxito', 'El acta se ha descargado correctamente');
                  }
                } catch (error: any) {
                  Alert.alert('❌ Error', error.message || 'No se pudo descargar el acta');
                }
              }}
            >
              <Text style={[styles.actionCardIcon, isDesktop && styles.actionCardIconDesktop]}>📥</Text>
              <Text style={[styles.actionCardText, isDesktop && styles.actionCardTextDesktop, dynamicStyles.actionCardText, isDesktop && dynamicStyles.actionCardTextDesktop]}>Descargar acta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BOTÓN FORMULARIO DE SALIDA */}
        <TouchableOpacity
          style={[styles.closeAssemblyBtn, isDesktop && styles.closeAssemblyBtnDesktop, { backgroundColor: '#f97316' }]}
          onPress={() => setFormularioSalidaModalVisible(true)}
        >
          <Text style={[styles.closeAssemblyBtnText, isDesktop && styles.closeAssemblyBtnTextDesktop, dynamicStyles.closeAssemblyBtnText, isDesktop && dynamicStyles.closeAssemblyBtnTextDesktop]}>📋 Formulario de salida</Text>
        </TouchableOpacity>

        {/* BOTÓN CERRAR ASAMBLEA */}
        <TouchableOpacity
          style={[styles.closeAssemblyBtn, isDesktop && styles.closeAssemblyBtnDesktop]}
          onPress={() => setCerrarModalVisible(true)}
        >
          <Text style={[styles.closeAssemblyBtnText, isDesktop && styles.closeAssemblyBtnTextDesktop, dynamicStyles.closeAssemblyBtnText, isDesktop && dynamicStyles.closeAssemblyBtnTextDesktop]}>🔴 Cerrar asamblea</Text>
        </TouchableOpacity>

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

      {/* Modal de confirmación para formulario de salida */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={formularioSalidaModalVisible}
        onRequestClose={() => {
          setFormularioSalidaModalVisible(false);
          setFormularioSalidaEnviado(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalIcon}>📋</Text>
              <Text style={styles.confirmModalTitle}>
                {formularioSalidaEnviado ? '📤 Contador de Salidas' : '¿Mostrar formulario de salida?'}
              </Text>
            </View>
            
            {formularioSalidaEnviado ? (
              // Vista cuando ya fue enviado: mostrar contador en tiempo real
              <>
                <Text style={styles.confirmModalMessage}>
                  Residentes que han completado el formulario de salida:
                </Text>

                <View style={[styles.confirmModalStats, { justifyContent: 'center', alignItems: 'center', marginVertical: 30 }]}>
                  <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#065f46' }}>
                    {totalSalidasCompletadas}
                  </Text>
                  <Text style={{ fontSize: 18, color: '#6b7280', marginTop: 8 }}>
                    de {totalConectadosSalida} residentes conectados
                  </Text>
                  <View style={{ marginTop: 16, paddingHorizontal: 16, width: '100%', backgroundColor: '#f0fdf4', borderRadius: 8, paddingVertical: 12 }}>
                    <Text style={{ textAlign: 'center', color: '#065f46', fontWeight: '600' }}>
                      Progreso: {totalConectadosSalida > 0 ? Math.round((totalSalidasCompletadas / totalConectadosSalida) * 100) : 0}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.confirmModalWarning}>
                  ⏳ Esperando a que los residentes completen el formulario de salida...
                </Text>
              </>
            ) : (
              // Vista antes de enviar: mostrar confirmación
              <>
                <Text style={styles.confirmModalMessage}>
                  Se les mostrará a todos el formulario de asistencia y saldrán de la asamblea.
                </Text>

                <View style={styles.confirmModalStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Residentes conectados</Text>
                    <Text style={styles.confirmStatValue}>{totalConectadosSalida}</Text>
                  </View>
                </View>
                <Text style={styles.confirmModalWarning}>
                  ⚠️ Todos los residentes podrán rellenar el formulario de salida
                </Text>
              </>
            )}

            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  setFormularioSalidaModalVisible(false);
                  setFormularioSalidaEnviado(false);
                }}
              >
                <Text style={styles.confirmCancelButtonText}>
                  {formularioSalidaEnviado ? 'Cerrar' : 'Cancelar'}
                </Text>
              </TouchableOpacity>

              {!formularioSalidaEnviado && (
                <TouchableOpacity
                  style={[styles.confirmDeleteButton, { backgroundColor: '#f97316' }]}
                  onPress={mostrarFormularioSalida}
                >
                  <Text style={styles.confirmDeleteButtonText}>
                    ✅ Sí, mostrar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      <AccessibilityFAB />
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

    // Suscripción realtime para actualizar contador (solo nuevas entradas, no salidas)
    const channel = supabase
      .channel('asistencias-modal')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencias', filter: `asamblea_id=eq.${asambleaId}` }, (payload) => {
        console.log('📈 Nueva asistencia, incrementando contador');
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

function Action({ text, color, isDesktop, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color }, isDesktop && { paddingVertical: 20 }]}
      onPress={onPress}
    >
      <Text style={[styles.btnText, isDesktop && { fontSize: 18 }]}>{text}</Text>
    </TouchableOpacity>
  );
}
