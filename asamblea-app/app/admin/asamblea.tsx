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
import { descargarActaAsamblea } from '@/src/services/pdf-acta';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { useResponsive } from '@/src/hooks/useResponsive';
import { useFontSize } from '@/src/hooks/useFontSize';

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

    // Suscripción a cambios en asistencias (solo nuevas entradas, no salidas)
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
          console.log('🆕 Nueva asistencia registrada:', payload);
          cargarTodo();
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
      supabase.removeChannel(asambleasSubscription);
      supabase.removeChannel(propuestasSubscription);
      supabase.removeChannel(asistenciasSubscription);
      if (votosSubscription) supabase.removeChannel(votosSubscription);
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
      Alert.alert('✅ Asamblea cerrada', 'La asamblea se ha cerrado correctamente', [
        {
          text: 'Aceptar',
          onPress: () => router.replace({ pathname: '/admin' })
        }
      ]);
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
      await channel.send({ 
        type: 'broadcast', 
        event: 'mostrar-formulario-salida', 
        payload: { asambleaId } 
      });
      
      setFormularioSalidaModalVisible(false);
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

        {/* HEADER CON CÓDIGO */}
        <View style={[styles.headerCard, isDesktop && styles.headerCardDesktop]}>
          <Text style={[styles.headerLabel, dynamicStyles.headerLabel]}>Código de acceso</Text>
          <Text style={[styles.codigo, isDesktop && styles.codigoDesktop, dynamicStyles.codigo, isDesktop && dynamicStyles.codigoDesktop]}>{asamblea.codigo_acceso}</Text>
          <View style={[
            styles.estadoBadge, 
            asamblea.estado === 'CERRADA' && styles.estadoBadgeClosed,
            isDesktop && styles.estadoBadgeDesktop
          ]}>
            <Text style={[styles.estadoBadgeText, isDesktop && styles.estadoBadgeTextDesktop, dynamicStyles.estadoBadgeText, isDesktop && dynamicStyles.estadoBadgeTextDesktop]}>{asamblea.estado}</Text>
          </View>
        </View>

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
            !quorumCumplido && styles.debateBtnDisabled,
            isDesktop && styles.debateBtnDesktop
          ]}
          disabled={!quorumCumplido}
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
        onRequestClose={() => setFormularioSalidaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalIcon}>📋</Text>
              <Text style={styles.confirmModalTitle}>¿Mostrar formulario de salida?</Text>
            </View>
            
            <Text style={styles.confirmModalMessage}>
              Se les mostrará a todos el formulario de asistencia y saldrán de la asamblea.
            </Text>

            <View style={styles.confirmModalStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Residentes conectados</Text>
                <Text style={styles.confirmStatValue}>{totalAsistentes}</Text>
              </View>
            </View>

            <Text style={styles.confirmModalWarning}>
              ⚠️ Todos los residentes podrán rellenar el formulario de salida
            </Text>

            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setFormularioSalidaModalVisible(false)}
              >
                <Text style={styles.confirmCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteButton, { backgroundColor: '#f97316' }]}
                onPress={mostrarFormularioSalida}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  ✅ Sí, mostrar
                </Text>
              </TouchableOpacity>
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

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '90%', maxWidth: 420, backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  btn: { backgroundColor: '#64748b', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
});

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

const styles = StyleSheet.create({
  page: { paddingVertical: 32, alignItems: 'center', paddingBottom: 120 },
  container: { maxWidth: 1200, width: '100%', paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header Card
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codigo: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#10b981',
    marginBottom: 16,
  },
  estadoBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  estadoBadgeClosed: {
    backgroundColor: '#ef4444',
  },
  estadoBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
  },

  // System Status Card
  systemStatusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  systemStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  systemStatusIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  systemStatusTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  systemStatusValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeNowBtn: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  closeNowBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Status Card
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quorumAlert: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  quorumAlertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quorumAlertText: {
    flex: 1,
    color: '#92400e',
    fontSize: 14,
    lineHeight: 20,
  },

  // Debate Button
  debateBtn: {
    backgroundColor: '#f59e0b',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  debateBtnDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  debateBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Management Console
  managementConsole: {
    marginBottom: 32,
  },
  consoleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  actionCardIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  actionCardText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Close Assembly Button
  closeAssemblyBtn: {
    backgroundColor: '#ef4444',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  closeAssemblyBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
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
  statItemLabel: {
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

  // Estilos para Desktop (Pantalla grande en la sala)
  pageDesktop: {
    paddingVertical: 48,
    minHeight: '100vh',
  },
  containerDesktop: {
    maxWidth: 1200,
    width: '95%',
    paddingHorizontal: 140,
  },
  headerCardDesktop: {
    padding: 48,
    marginBottom: 32,
  },
  codigoDesktop: {
    fontSize: 56,
    letterSpacing: 10,
    marginBottom: 24,
  },
  estadoBadgeDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  estadoBadgeTextDesktop: {
    fontSize: 18,
  },
  systemStatusCardDesktop: {
    padding: 32,
    marginBottom: 32,
  },
  systemStatusValueDesktop: {
    fontSize: 24,
  },
  statsGridDesktop: {
    gap: 24,
    marginBottom: 32,
  },
  statCardDesktop: {
    padding: 32,
  },
  statIconDesktop: {
    fontSize: 36,
    marginBottom: 12,
  },
  statNumberDesktop: {
    fontSize: 44,
  },
  statLabelDesktop: {
    fontSize: 18,
  },
  statusCardDesktop: {
    padding: 32,
    marginBottom: 32,
  },
  statusTitleDesktop: {
    fontSize: 20,
  },
  statusValueDesktop: {
    fontSize: 24,
  },
  debateBtnDesktop: {
    padding: 24,
    marginBottom: 32,
  },
  debateBtnTextDesktop: {
    fontSize: 22,
  },
  consoleTitleDesktop: {
    fontSize: 22,
    marginBottom: 24,
  },
  actionGridDesktop: {
    gap: 20,
  },
  actionCardDesktop: {
    minWidth: '31%',
    width: 'auto',
    padding: 28,
    minHeight: 120,
  },
  actionCardIconDesktop: {
    fontSize: 36,
  },
  actionCardTextDesktop: {
    fontSize: 16,
  },
  closeAssemblyBtnDesktop: {
    padding: 24,
  },
  closeAssemblyBtnTextDesktop: {
    fontSize: 22,
  },
});
