import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { styles } from '@/src/styles/screens/admin/resultados.styles';
import { useResponsive } from '@/src/hooks/useResponsive';

interface ResultStats {
  votos_si: number;
  votos_no: number;
  no_votaron: number;
  no_asistentes: number;
  total_viviendas: number;
  total_asistentes: number;
}

export default function AdminResultados() {
  const { asambleaId, propuestaId, live } = useLocalSearchParams<{
    asambleaId: string;
    propuestaId?: string;
    live?: string;
  }>();
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [propuestaSeleccionada, setPropuestaSeleccionada] = useState<any>(null);
  const [stats, setStats] = useState<ResultStats | null>(null);
  const liveMode = live === '1';
  const { width, isDesktop, isTablet, isMobile } = useResponsive();

  const isLargeScreen = isDesktop;
  const isMediumScreen = isTablet;
  const projectorMode = isDesktop && width >= 1280;

  const cargarPropuestasCerradas = useCallback(async () => {
    if (!asambleaId) return;
    
    const { data } = await supabase
      .from('propuestas')
      .select('*')
      .eq('asamblea_id', asambleaId)
      .eq('estado', 'CERRADA')
      .order('fecha_cierre', { ascending: false });

    setPropuestas(data || []);
  }, [asambleaId]);

  useEffect(() => {
    cargarPropuestasCerradas();
  }, [cargarPropuestasCerradas]);

  const cargarEstadisticas = async (propuestaId: string) => {
    try {
      const totalCasas = 164; // Total de casas en la base de datos
      console.log('📊 Total casas configurado:', totalCasas);

      // OPTIMIZACIÓN Priority 3.2: Usar RPC en lugar de 3 queries separadas
      // Antes: COUNT votos SI + COUNT votos NO + SELECT asistencias = 3 queries
      // Ahora: 1 RPC call obtener_estadisticas_propuesta()
      
      const { data: statsData, error: statsError } = await supabase.rpc(
        'obtener_estadisticas_propuesta',
        { p_propuesta_id: propuestaId }
      );

      if (statsError) {
        console.error('Error obteniendo estadísticas:', statsError);
        return;
      }

      const votosSi = statsData?.votos_si || 0;
      const votosNo = statsData?.votos_no || 0;

      // Obtener asistencias (incluyendo apoderados)
      const { data: asistenciasData } = await supabase
        .from('asistencias')
        .select('vivienda_id, es_apoderado, estado_apoderado, casa_representada')
        .eq('asamblea_id', asambleaId);

      // Contar viviendas representadas (incluyendo las representadas por apoderados)
      let viviendasRepresentadas = new Set<string>();
      
      asistenciasData?.forEach((asistencia) => {
        // Agregar la vivienda del asistente
        viviendasRepresentadas.add(asistencia.vivienda_id);
        
        // Si es apoderado aprobado, agregar la casa que representa
        if (asistencia.es_apoderado && asistencia.estado_apoderado === 'APROBADO' && asistencia.casa_representada) {
          viviendasRepresentadas.add(asistencia.casa_representada);
        }
      });
      
      const asistentes = viviendasRepresentadas.size;

      const totalVotos = votosSi + votosNo;
      const noVotaron = Math.max(0, (asistentes || 0) - totalVotos);
      const noAsistentes = Math.max(0, totalCasas - (asistentes || 0));

      console.log('📊 Estadísticas calculadas:', {
        votosSi,
        votosNo,
        asistentes,
        noVotaron,
        noAsistentes,
        totalCasas
      });

      setStats({
        votos_si: votosSi || 0,
        votos_no: votosNo || 0,
        no_votaron: noVotaron,
        no_asistentes: noAsistentes,
        total_viviendas: totalCasas,
        total_asistentes: asistentes || 0,
      });
    } catch (e) {
      console.error('Error cargando estadísticas:', e);
    }
  };

  const abrirPropuesta = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('propuestas')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error cargando propuesta:', error);
      return;
    }

    setPropuestaSeleccionada(data);
    await cargarEstadisticas(data.id);
  }, [asambleaId]);

  useEffect(() => {
    if (!propuestaId) return;
    abrirPropuesta(propuestaId);
  }, [propuestaId, abrirPropuesta]);

  const handleMostrarResultados = async (item: any) => {
    console.log('🔵🔵🔵 BOTÓN PRESIONADO - handleMostrarResultados');
    console.log('🔵🔵🔵 Item completo:', JSON.stringify(item, null, 2));
    console.log('🔵🔵🔵 AsambleaId:', asambleaId);
    
    try {
      setCargando(true);
      
      console.log('📊 Llamando RPC directamente...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('mostrar_resultados', {
        p_asamblea_id: asambleaId,
        p_propuesta_id: item.id
      });

      console.log('📡 Respuesta RPC:', JSON.stringify({ rpcData, rpcError }, null, 2));

      if (rpcError) {
        console.error('❌ Error RPC:', rpcError);
        Alert.alert('Error', `RPC falló: ${rpcError.message || JSON.stringify(rpcError)}`);
        return;
      }
      
      console.log('✅ RPC ejecutado exitosamente');
      
      // Esperar propagación
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verificar
      const { data: verificacion } = await supabase
        .from('asambleas')
        .select('propuesta_resultados_id, estado_actual')
        .eq('id', asambleaId)
        .single();
      
      console.log('🔍 Verificación después del RPC:', verificacion);
      
      Alert.alert('✅ Hecho', `Resultados publicados. propuesta_resultados_id = ${verificacion?.propuesta_resultados_id}`);
      
      setPropuestaSeleccionada(item);
      await cargarEstadisticas(item.id);
    } catch (e: any) {
      console.error('💥 Excepción:', e);
      Alert.alert('Error', e.message);
    } finally {
      setCargando(false);
    }
  };

  const handleVerEstadisticas = async (item: any) => {
    setPropuestaSeleccionada(item);
    await cargarEstadisticas(item.id);
  };

  useEffect(() => {
    if (!asambleaId || !propuestaSeleccionada) return;

    const propuestaEnVivo = liveMode || propuestaSeleccionada.estado === 'ABIERTA';
    if (!propuestaEnVivo) return;

    const channel = supabase
      .channel(`admin-resultados-live-${propuestaSeleccionada.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votos',
          filter: `propuesta_id=eq.${propuestaSeleccionada.id}`,
        },
        async () => {
          await cargarEstadisticas(propuestaSeleccionada.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'propuestas',
          filter: `id=eq.${propuestaSeleccionada.id}`,
        },
        async (payload) => {
          setPropuestaSeleccionada(payload.new);
          await cargarEstadisticas(propuestaSeleccionada.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asambleaId, propuestaSeleccionada, liveMode]);

  if (propuestaSeleccionada && stats) {
    const totalVotos = stats.votos_si + stats.votos_no;
    const totalAsistentes = stats.total_asistentes;
    
    // Porcentajes sobre asistentes para SI y NO
    const porcentajeSi = totalAsistentes > 0 ? ((stats.votos_si / totalAsistentes) * 100).toFixed(1) : '0';
    const porcentajeNo = totalAsistentes > 0 ? ((stats.votos_no / totalAsistentes) * 100).toFixed(1) : '0';
    const porcentajeNoVotaron = totalAsistentes > 0 ? ((stats.no_votaron / totalAsistentes) * 100).toFixed(1) : '0';
    
    // Porcentaje de no asistentes sobre el total de casas
    const porcentajeNoAsistentes = stats.total_viviendas > 0 ? ((stats.no_asistentes / stats.total_viviendas) * 100).toFixed(1) : '0';
    
    // Aprobación: 50% + 1 de los asistentes
    const votosNecesarios = Math.floor(totalAsistentes / 2) + 1;
    const aprobada = stats.votos_si >= votosNecesarios;

    return (
      <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent,
            isLargeScreen && styles.scrollContentDesktop,
            isMediumScreen && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              isLargeScreen && styles.containerDesktop,
              isMediumScreen && styles.containerTablet,
            ]}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setPropuestaSeleccionada(null);
                setStats(null);
              }}
            >
              <Text
                style={[
                  styles.backButtonText,
                  isLargeScreen && styles.backButtonTextDesktop,
                ]}
              >
                ← Volver al listado
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.title,
                isLargeScreen && styles.titleDesktop,
                isMediumScreen && styles.titleTablet,
                projectorMode && styles.titleProjector,
              ]}
            >
              📊 Resultados de votación
            </Text>

            {projectorMode && (
              <View style={styles.projectorBadge}>
                <Text style={styles.projectorBadgeText}>🎥 Modo proyector</Text>
              </View>
            )}

            {(liveMode || propuestaSeleccionada.estado === 'ABIERTA') && (
              <View style={[styles.liveBadge, isLargeScreen && styles.liveBadgeDesktop]}>
                <Text style={[styles.liveBadgeText, isLargeScreen && styles.liveBadgeTextDesktop]}>🔴 En vivo · actualizando en tiempo real</Text>
              </View>
            )}
            
            <View style={[styles.propuestaBox, isLargeScreen && styles.propuestaBoxDesktop]}>
              <Text style={[styles.propuestaTitulo, isLargeScreen && styles.propuestaTituloDesktop]}>{propuestaSeleccionada.titulo}</Text>
              {propuestaSeleccionada.descripcion && (
                <Text style={[styles.propuestaDescripcion, isLargeScreen && styles.propuestaDescripcionDesktop]}>{propuestaSeleccionada.descripcion}</Text>
              )}
            </View>

            {isLargeScreen ? (
              <View style={[styles.desktopMainGrid, projectorMode && styles.desktopMainGridProjector]}>
                <View style={styles.desktopChartColumn}>
                  <View style={[
                    styles.compactChartContainer,
                    styles.compactChartContainerDesktop,
                    styles.compactChartContainerDesktopStretch,
                    projectorMode && styles.compactChartContainerProjector,
                  ]}>
                    <View style={[styles.chartsRow, styles.chartsRowDesktop]}>
                      {/* Barra SI */}
                      <View style={[styles.compactColumn, styles.compactColumnDesktop]}>
                        <View style={[styles.compactBarWrapper, styles.compactBarWrapperDesktop, projectorMode && styles.compactBarWrapperProjector]}>
                          <View style={[styles.compactBar, styles.compactBarDesktop, projectorMode && styles.compactBarProjector]}>
                            <View
                              style={[
                                styles.compactBarFill,
                                styles.barFillSi,
                                { height: `${Math.min(100, totalAsistentes > 0 ? (stats.votos_si / totalAsistentes) * 100 : 0)}%` }
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.compactBarValue, styles.compactBarValueDesktop, projectorMode && styles.compactBarValueProjector]}>{stats.votos_si}</Text>
                        <Text style={[styles.compactBarPercentage, styles.compactBarPercentageDesktop, projectorMode && styles.compactBarPercentageProjector]}>{porcentajeSi}%</Text>
                        <Text style={[styles.compactBarEmoji, styles.compactBarEmojiDesktop, projectorMode && styles.compactBarEmojiProjector]}>👍</Text>
                        <Text style={[styles.compactBarLabel, styles.compactBarLabelDesktop, projectorMode && styles.compactBarLabelProjector]}>SÍ</Text>
                      </View>

                      {/* Barra NO */}
                      <View style={[styles.compactColumn, styles.compactColumnDesktop]}>
                        <View style={[styles.compactBarWrapper, styles.compactBarWrapperDesktop, projectorMode && styles.compactBarWrapperProjector]}>
                          <View style={[styles.compactBar, styles.compactBarDesktop, projectorMode && styles.compactBarProjector]}>
                            <View
                              style={[
                                styles.compactBarFill,
                                styles.barFillNo,
                                { height: `${Math.min(100, totalAsistentes > 0 ? (stats.votos_no / totalAsistentes) * 100 : 0)}%` }
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.compactBarValue, styles.compactBarValueDesktop, projectorMode && styles.compactBarValueProjector]}>{stats.votos_no}</Text>
                        <Text style={[styles.compactBarPercentage, styles.compactBarPercentageDesktop, projectorMode && styles.compactBarPercentageProjector]}>{porcentajeNo}%</Text>
                        <Text style={[styles.compactBarEmoji, styles.compactBarEmojiDesktop, projectorMode && styles.compactBarEmojiProjector]}>👎</Text>
                        <Text style={[styles.compactBarLabel, styles.compactBarLabelDesktop, projectorMode && styles.compactBarLabelProjector]}>NO</Text>
                      </View>

                      {/* Barra No votaron */}
                      <View style={[styles.compactColumn, styles.compactColumnDesktop]}>
                        <View style={[styles.compactBarWrapper, styles.compactBarWrapperDesktop, projectorMode && styles.compactBarWrapperProjector]}>
                          <View style={[styles.compactBar, styles.compactBarDesktop, projectorMode && styles.compactBarProjector]}>
                            <View
                              style={[
                                styles.compactBarFill,
                                styles.barFillPending,
                                { height: `${Math.min(100, totalAsistentes > 0 ? (stats.no_votaron / totalAsistentes) * 100 : 0)}%` }
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.compactBarValue, styles.compactBarValueDesktop, projectorMode && styles.compactBarValueProjector]}>{stats.no_votaron}</Text>
                        <Text style={[styles.compactBarPercentage, styles.compactBarPercentageDesktop, projectorMode && styles.compactBarPercentageProjector]}>{porcentajeNoVotaron}%</Text>
                        <Text style={[styles.compactBarEmoji, styles.compactBarEmojiDesktop, projectorMode && styles.compactBarEmojiProjector]}>⏳</Text>
                        <Text style={[styles.compactBarLabel, styles.compactBarLabelDesktop, projectorMode && styles.compactBarLabelProjector]}>No votaron</Text>
                      </View>

                      {/* Barra No asistentes */}
                      <View style={[styles.compactColumn, styles.compactColumnDesktop]}>
                        <View style={[styles.compactBarWrapper, styles.compactBarWrapperDesktop, projectorMode && styles.compactBarWrapperProjector]}>
                          <View style={[styles.compactBar, styles.compactBarDesktop, projectorMode && styles.compactBarProjector]}>
                            <View
                              style={[
                                styles.compactBarFill,
                                styles.barFillAbsent,
                                { height: `${Math.min(100, stats.total_viviendas > 0 ? (stats.no_asistentes / stats.total_viviendas) * 100 : 0)}%` }
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.compactBarValue, styles.compactBarValueDesktop, projectorMode && styles.compactBarValueProjector]}>{stats.no_asistentes}</Text>
                        <Text style={[styles.compactBarPercentage, styles.compactBarPercentageDesktop, projectorMode && styles.compactBarPercentageProjector]}>{porcentajeNoAsistentes}%</Text>
                        <Text style={[styles.compactBarEmoji, styles.compactBarEmojiDesktop, projectorMode && styles.compactBarEmojiProjector]}>❌</Text>
                        <Text style={[styles.compactBarLabel, styles.compactBarLabelDesktop, projectorMode && styles.compactBarLabelProjector]}>No asistieron</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.desktopInfoColumn}>
                  <View style={[styles.summaryBox, styles.summaryBoxDesktop, styles.summaryBoxDesktopStretch, projectorMode && styles.summaryBoxProjector]}>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, styles.summaryLabelDesktop, projectorMode && styles.summaryLabelProjector]}>Total viviendas:</Text>
                      <Text style={[styles.summaryValue, styles.summaryValueDesktop, projectorMode && styles.summaryValueProjector]}>{stats.total_viviendas}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, styles.summaryLabelDesktop, projectorMode && styles.summaryLabelProjector]}>Asistentes registrados:</Text>
                      <Text style={[styles.summaryValue, styles.summaryValueDesktop, projectorMode && styles.summaryValueProjector]}>{stats.total_asistentes}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, styles.summaryLabelDesktop, projectorMode && styles.summaryLabelProjector]}>Total votos emitidos:</Text>
                      <Text style={[styles.summaryValue, styles.summaryValueDesktop, projectorMode && styles.summaryValueProjector]}>{totalVotos}</Text>
                    </View>
                  </View>

                  <View style={[styles.resultBox, styles.resultBoxDesktop, styles.resultBoxDesktopStretch, projectorMode && styles.resultBoxProjector]}>
                    <Text style={[styles.resultLabel, styles.resultLabelDesktop, projectorMode && styles.resultLabelProjector]}>Resultado de la votación:</Text>
                    <Text style={[styles.resultInfo, styles.resultInfoDesktop, projectorMode && styles.resultInfoProjector]}>
                      Se necesitan {votosNecesarios} votos de {totalAsistentes} asistentes (50% + 1)
                    </Text>
                    <Text
                      style={[
                        styles.resultText,
                        styles.resultTextDesktop,
                        projectorMode && styles.resultTextProjector,
                        { color: aprobada ? '#16a34a' : '#dc2626' }
                      ]}
                    >
                      {aprobada ? '✅ APROBADA' : '❌ RECHAZADA'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <>
                {/* Resumen de participación */}
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total viviendas:</Text>
                    <Text style={styles.summaryValue}>{stats.total_viviendas}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Asistentes registrados:</Text>
                    <Text style={styles.summaryValue}>{stats.total_asistentes}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total votos emitidos:</Text>
                    <Text style={styles.summaryValue}>{totalVotos}</Text>
                  </View>
                </View>

                {/* Gráfico de columnas compacto */}
                <View style={styles.compactChartContainer}>
                  <View style={styles.chartsRow}>
                    {/* Barra SI */}
                    <View style={styles.compactColumn}>
                      <View style={styles.compactBarWrapper}>
                        <View style={styles.compactBar}>
                          <View
                            style={[
                              styles.compactBarFill,
                              styles.barFillSi,
                              { height: `${Math.min(100, totalAsistentes > 0 ? (stats.votos_si / totalAsistentes) * 100 : 0)}%` }
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.compactBarValue}>{stats.votos_si}</Text>
                      <Text style={styles.compactBarPercentage}>{porcentajeSi}%</Text>
                      <Text style={styles.compactBarEmoji}>👍</Text>
                      <Text style={styles.compactBarLabel}>SÍ</Text>
                    </View>

                    {/* Barra NO */}
                    <View style={styles.compactColumn}>
                      <View style={styles.compactBarWrapper}>
                        <View style={styles.compactBar}>
                          <View
                            style={[
                              styles.compactBarFill,
                              styles.barFillNo,
                              { height: `${Math.min(100, totalAsistentes > 0 ? (stats.votos_no / totalAsistentes) * 100 : 0)}%` }
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.compactBarValue}>{stats.votos_no}</Text>
                      <Text style={styles.compactBarPercentage}>{porcentajeNo}%</Text>
                      <Text style={styles.compactBarEmoji}>👎</Text>
                      <Text style={styles.compactBarLabel}>NO</Text>
                    </View>

                    {/* Barra No votaron */}
                    <View style={styles.compactColumn}>
                      <View style={styles.compactBarWrapper}>
                        <View style={styles.compactBar}>
                          <View
                            style={[
                              styles.compactBarFill,
                              styles.barFillPending,
                              { height: `${Math.min(100, totalAsistentes > 0 ? (stats.no_votaron / totalAsistentes) * 100 : 0)}%` }
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.compactBarValue}>{stats.no_votaron}</Text>
                      <Text style={styles.compactBarPercentage}>{porcentajeNoVotaron}%</Text>
                      <Text style={styles.compactBarEmoji}>⏳</Text>
                      <Text style={styles.compactBarLabel}>No votaron</Text>
                    </View>

                    {/* Barra No asistentes */}
                    <View style={styles.compactColumn}>
                      <View style={styles.compactBarWrapper}>
                        <View style={styles.compactBar}>
                          <View
                            style={[
                              styles.compactBarFill,
                              styles.barFillAbsent,
                              { height: `${Math.min(100, stats.total_viviendas > 0 ? (stats.no_asistentes / stats.total_viviendas) * 100 : 0)}%` }
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.compactBarValue}>{stats.no_asistentes}</Text>
                      <Text style={styles.compactBarPercentage}>{porcentajeNoAsistentes}%</Text>
                      <Text style={styles.compactBarEmoji}>❌</Text>
                      <Text style={styles.compactBarLabel}>No asistieron</Text>
                    </View>
                  </View>
                </View>

                {/* Resultado final */}
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>Resultado de la votación:</Text>
                  <Text style={styles.resultInfo}>
                    Se necesitan {votosNecesarios} votos de {totalAsistentes} asistentes (50% + 1)
                  </Text>
                  <Text
                    style={[
                      styles.resultText,
                      { color: aprobada ? '#16a34a' : '#dc2626' }
                    ]}
                  >
                    {aprobada ? '✅ APROBADA' : '❌ RECHAZADA'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
        <AccessibilityFAB />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View
        style={[
          styles.container,
          isLargeScreen && styles.containerDesktop,
          isMediumScreen && styles.containerTablet,
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, isLargeScreen && styles.backButtonTextDesktop]}>← Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isLargeScreen && styles.titleDesktop, isMediumScreen && styles.titleTablet]}>📊 Resultados de propuestas</Text>

        {propuestas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay propuestas cerradas</Text>
            <Text style={styles.emptySubtext}>Las propuestas cerradas aparecerán aquí</Text>
          </View>
        ) : (
          <FlatList
            data={propuestas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40, alignItems: 'center', width: '100%' }}
            style={{ width: '100%' }}
            renderItem={({ item, index }) => (
              <View style={[styles.card, isLargeScreen && styles.cardDesktop]}>
                <View style={styles.cardHeader}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>🔴 Cerrada</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  {item.descripcion ? (
                    <Text style={styles.cardText}>{item.descripcion}</Text>
                  ) : null}
                </View>

                <View style={[styles.cardActions, isMobile && styles.cardActionsMobile]}>
                  <TouchableOpacity 
                    style={[styles.statsBtn, isMobile && styles.actionBtnMobile]} 
                    onPress={() => handleVerEstadisticas(item)}
                  >
                    <Text style={[styles.statsBtnText, isLargeScreen && styles.actionBtnTextDesktop]}>📈 Ver estadísticas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.publishBtn, isMobile && styles.actionBtnMobile]} 
                    onPress={() => handleMostrarResultados(item)}
                    disabled={cargando}
                  >
                    <Text style={[styles.publishBtnText, isLargeScreen && styles.actionBtnTextDesktop]}>
                      📊 Mostrar a residentes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </LinearGradient>
  );
}

