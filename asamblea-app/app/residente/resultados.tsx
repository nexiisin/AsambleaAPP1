import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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

export default function Resultados() {
  const { asambleaId, asistenciaId, propuestaId } = useLocalSearchParams<{ 
    asambleaId: string; 
    asistenciaId?: string;
    propuestaId: string;
  }>();

  const [propuesta, setPropuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ResultStats>({
    votos_si: 0,
    votos_no: 0,
    no_votaron: 0,
    no_asistentes: 0,
    total_viviendas: 0,
    total_asistentes: 0,
  });

  const cargarResultados = useCallback(async () => {
    if (!asambleaId) {
      console.log('❌ No hay asambleaId');
      return;
    }

    setLoading(true);

    try {
      // Si no se pasó propuestaId, intentar obtenerlo de la asamblea
      let propuestaIdFinal = propuestaId;
      
      if (!propuestaIdFinal) {
        console.log('🔍 No se pasó propuestaId, buscando en asamblea...');
        const { data: asambleaData } = await supabase
          .from('asambleas')
          .select('propuesta_resultados_id')
          .eq('id', asambleaId)
          .single();
        
        propuestaIdFinal = asambleaData?.propuesta_resultados_id;
        console.log('📋 propuesta_resultados_id de asamblea:', propuestaIdFinal);
      }

      if (!propuestaIdFinal) {
        console.log('❌ No hay propuesta para mostrar resultados');
        setLoading(false);
        return;
      }

      console.log('📊 Cargando resultados para propuesta:', propuestaIdFinal);

      // Cargar propuesta
      const { data: propData } = await supabase
        .from('propuestas')
        .select('*')
        .eq('id', propuestaIdFinal)
        .single();

      console.log('📄 Propuesta cargada:', propData);
      setPropuesta(propData);

      const totalCasas = 15; // Total de casas en la base de datos
      console.log('📊 (Residente) Total casas configurado:', totalCasas);

      // Obtener votos SI
      const { count: votosSi } = await supabase
        .from('votos')
        .select('*', { count: 'exact', head: true })
        .eq('propuesta_id', propuestaIdFinal)
        .eq('tipo_voto', 'SI');

      // Obtener votos NO
      const { count: votosNo } = await supabase
        .from('votos')
        .select('*', { count: 'exact', head: true })
        .eq('propuesta_id', propuestaIdFinal)
        .eq('tipo_voto', 'NO');

      // Obtener asistentes
      const { count: asistentes } = await supabase
        .from('asistencias')
        .select('vivienda_id', { count: 'exact', head: true })
        .eq('asamblea_id', asambleaId);

      const totalVotos = (votosSi || 0) + (votosNo || 0);
      const noVotaron = Math.max(0, (asistentes || 0) - totalVotos);
      const noAsistentes = Math.max(0, totalCasas - (asistentes || 0));

      console.log('📊 (Residente) Estadísticas calculadas:', {
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
      console.error('Error cargando resultados:', e);
    } finally {
      setLoading(false);
    }
  }, [propuestaId, asambleaId]);

  useEffect(() => {
    cargarResultados();
  }, [cargarResultados]);

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
          <Text style={styles.title}>No hay resultados disponibles</Text>
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
    <LinearGradient colors={["#5fba8b", "#d9f3e2"]} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.icon}>📊</Text>
          <Text style={styles.title}>Resultados de votación</Text>
          
          <View style={styles.propuestaBox}>
            <Text style={styles.propuestaTitulo}>{propuesta.titulo}</Text>
            {propuesta.descripcion && (
              <Text style={styles.propuestaDescripcion}>{propuesta.descripcion}</Text>
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

          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              console.log('🔙 Volviendo a sala de espera');
              router.replace({ pathname: '/residente/sala-espera', params: { asambleaId, asistenciaId, fromResults: 'true' } });
            }}
          >
            <Text style={styles.backBtnText}>Volver a sala de espera</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    paddingVertical: 40,
  },
  card: { 
    width: '100%', 
    maxWidth: 650, 
    backgroundColor: '#fff', 
    padding: 28, 
    borderRadius: 20, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '800', 
    marginBottom: 20, 
    textAlign: 'center',
    color: '#1f2937',
  },
  
  // Propuesta
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

  // Resumen
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

  // Gráfico
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

  // Resultado final
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

  backBtn: { 
    width: '100%',
    backgroundColor: '#f3f4f6', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  backBtnText: { 
    color: '#374151', 
    fontWeight: '600',
    fontSize: 15,
  },
});
