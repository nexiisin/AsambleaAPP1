import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/src/services/supabase';

interface ResultStats {
  votos_si: number;
  votos_no: number;
  no_votaron: number;
  no_asistentes: number;
  total_viviendas: number;
  total_asistentes: number;
}

export default function AdminResultados() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [propuestaSeleccionada, setPropuestaSeleccionada] = useState<any>(null);
  const [stats, setStats] = useState<ResultStats | null>(null);

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
      const totalCasas = 15; // Total de casas en la base de datos
      console.log('📊 Total casas configurado:', totalCasas);

      // Obtener votos SI
      const { count: votosSi } = await supabase
        .from('votos')
        .select('*', { count: 'exact', head: true })
        .eq('propuesta_id', propuestaId)
        .eq('tipo_voto', 'SI');

      // Obtener votos NO
      const { count: votosNo } = await supabase
        .from('votos')
        .select('*', { count: 'exact', head: true })
        .eq('propuesta_id', propuestaId)
        .eq('tipo_voto', 'NO');

      // Obtener asistentes (los que se unieron a la asamblea)
      const { count: asistentes } = await supabase
        .from('asistencias')
        .select('vivienda_id', { count: 'exact', head: true })
        .eq('asamblea_id', asambleaId);

      const totalVotos = (votosSi || 0) + (votosNo || 0);
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setPropuestaSeleccionada(null);
                setStats(null);
              }}
            >
              <Text style={styles.backButtonText}>← Volver al listado</Text>
            </TouchableOpacity>

            <Text style={styles.title}>📊 Resultados de votación</Text>
            
            <View style={styles.propuestaBox}>
              <Text style={styles.propuestaTitulo}>{propuestaSeleccionada.titulo}</Text>
              {propuestaSeleccionada.descripcion && (
                <Text style={styles.propuestaDescripcion}>{propuestaSeleccionada.descripcion}</Text>
              )}
            </View>

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

            {/* Gráfico de columnas */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Resultados detallados</Text>
              
              <View style={styles.columnsContainer}>
                {/* Columna SI */}
                <View style={styles.columnWrapper}>
                  <View style={styles.columnBar}>
                    <View 
                      style={[
                        styles.columnFill, 
                        styles.columnFillSi,
                        { height: `${totalAsistentes > 0 ? (stats.votos_si / totalAsistentes) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                  <View style={styles.columnStats}>
                    <Text style={styles.columnValue}>{stats.votos_si}</Text>
                    <Text style={styles.columnPercentage}>{porcentajeSi}%</Text>
                  </View>
                  <View style={styles.columnLabelContainer}>
                    <Text style={styles.columnLabel}>👍</Text>
                    <Text style={styles.columnLabel}>SÍ</Text>
                  </View>
                </View>

                {/* Columna NO */}
                <View style={styles.columnWrapper}>
                  <View style={styles.columnBar}>
                    <View 
                      style={[
                        styles.columnFill, 
                        styles.columnFillNo,
                        { height: `${totalAsistentes > 0 ? (stats.votos_no / totalAsistentes) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                  <View style={styles.columnStats}>
                    <Text style={styles.columnValue}>{stats.votos_no}</Text>
                    <Text style={styles.columnPercentage}>{porcentajeNo}%</Text>
                  </View>
                  <View style={styles.columnLabelContainer}>
                    <Text style={styles.columnLabel}>👎</Text>
                    <Text style={styles.columnLabel}>NO</Text>
                  </View>
                </View>

                {/* Columna No votaron */}
                <View style={styles.columnWrapper}>
                  <View style={styles.columnBar}>
                    <View 
                      style={[
                        styles.columnFill, 
                        styles.columnFillPending,
                        { height: `${totalAsistentes > 0 ? (stats.no_votaron / totalAsistentes) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                  <View style={styles.columnStats}>
                    <Text style={styles.columnValue}>{stats.no_votaron}</Text>
                    <Text style={styles.columnPercentage}>{porcentajeNoVotaron}%</Text>
                  </View>
                  <View style={styles.columnLabelContainer}>
                    <Text style={styles.columnLabel}>⏳</Text>
                    <Text style={styles.columnLabel}>No</Text>
                    <Text style={styles.columnLabel}>votaron</Text>
                  </View>
                </View>

                {/* Columna No asistentes */}
                <View style={styles.columnWrapper}>
                  <View style={styles.columnBar}>
                    <View 
                      style={[
                        styles.columnFill, 
                        styles.columnFillAbsent,
                        { height: `${stats.total_viviendas > 0 ? (stats.no_asistentes / stats.total_viviendas) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                  <View style={styles.columnStats}>
                    <Text style={styles.columnValue}>{stats.no_asistentes}</Text>
                    <Text style={styles.columnPercentage}>{porcentajeNoAsistentes}%</Text>
                  </View>
                  <View style={styles.columnLabelContainer}>
                    <Text style={styles.columnLabel}>❌</Text>
                    <Text style={styles.columnLabel}>No</Text>
                    <Text style={styles.columnLabel}>asistieron</Text>
                  </View>
                </View>
              </View>
              
              {/* Línea base */}
              <View style={styles.baseLine} />
            </View>

            {/* Resultado final */}
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Resultado de la votación:</Text>
              <Text style={styles.resultInfo}>
                Se necesitan {votosNecesarios} votos de {totalAsistentes} asistentes (50% + 1)
              </Text>
              <Text style={[
                styles.resultText,
                { color: aprobada ? '#16a34a' : '#dc2626' }
              ]}>
                {aprobada ? '✅ APROBADA' : '❌ RECHAZADA'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.page}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📊 Resultados de propuestas</Text>

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
              <View style={styles.card}>
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

                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.statsBtn} 
                    onPress={() => handleVerEstadisticas(item)}
                  >
                    <Text style={styles.statsBtnText}>📈 Ver estadísticas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.publishBtn} 
                    onPress={() => handleMostrarResultados(item)}
                    disabled={cargando}
                  >
                    <Text style={styles.publishBtnText}>
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

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: 700, padding: 16 },
  scrollContent: { 
    paddingVertical: 20,
  },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 24, color: '#1f2937', textAlign: 'center' },
  
  backButton: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 14,
  },

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
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#991b1b',
    fontWeight: '600',
    fontSize: 13,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1f2937' },
  cardText: { color: '#4b5563', marginBottom: 12, fontSize: 15, lineHeight: 22 },
  cardBody: { marginBottom: 16 },
  cardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  
  statsBtn: { 
    backgroundColor: '#f3f4f6', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statsBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  
  publishBtn: { 
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
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Vista de estadísticas
  propuestaBox: {
    width: '100%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  propuestaTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  propuestaDescripcion: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  chartContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  baseLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: -3,
  },
  columnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 240,
    maxWidth: 85,
  },
  columnBar: {
    width: '100%',
    height: 160,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  columnFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  columnFillSi: {
    backgroundColor: '#22c55e',
  },
  columnFillNo: {
    backgroundColor: '#ef4444',
  },
  columnFillPending: {
    backgroundColor: '#f59e0b',
  },
  columnFillAbsent: {
    backgroundColor: '#9ca3af',
  },
  columnStats: {
    marginTop: 10,
    alignItems: 'center',
    height: 40,
  },
  columnValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1f2937',
  },
  columnPercentage: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
  columnLabelContainer: {
    marginTop: 4,
    alignItems: 'center',
    height: 46,
    justifyContent: 'flex-start',
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 12,
  },
  resultBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  resultInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
});
