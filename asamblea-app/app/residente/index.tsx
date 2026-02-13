import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';
import { styles } from '@/src/styles/screens/residente/index.styles';

export default function ResidenteScreen() {
  // paso 1 o 2
  const [step, setStep] = useState<1 | 2>(1);

  // asamblea
  const [codigo, setCodigo] = useState('');
  const [asambleaId, setAsambleaId] = useState<string | null>(null);

  // formulario
  const [numeroCasa, setNumeroCasa] = useState('');
  const [nombreAsistente, setNombreAsistente] = useState('');
  const [esApoderado, setEsApoderado] = useState(false);
  const [casaRepresentada, setCasaRepresentada] = useState('');

  const [cargando, setCargando] = useState(false);

  // =========================
  // VALIDAR CÓDIGO ASAMBLEA
  // =========================
  const validarCodigo = async () => {
    if (!codigo.trim()) {
      Alert.alert('Error', 'Ingresa el código de la asamblea');
      return;
    }

    setCargando(true);

    const { data, error } = await supabase
      .from('asambleas')
      .select('id, estado, hora_cierre_ingreso')
      .eq('codigo_acceso', codigo)
      .single();

    setCargando(false);

    if (error || !data) {
      Alert.alert('Código inválido', 'La asamblea no existe');
      return;
    }

    if (data.estado !== 'ABIERTA') {
      Alert.alert(
        'Asamblea cerrada',
        'Esta asamblea no está disponible'
      );
      return;
    }

    // Verificar si el ingreso está cerrado
    if (data.hora_cierre_ingreso) {
      const ahora = new Date();
      const horaCierre = new Date(data.hora_cierre_ingreso);
      
      if (ahora >= horaCierre) {
        Alert.alert(
          '⏰ Ingreso cerrado',
          'El tiempo de ingreso a esta asamblea ha finalizado. No se permiten nuevos registros.'
        );
        return;
      }
    }

    setAsambleaId(data.id);
    setStep(2);
  };

  // =========================
  // INGRESAR A ASAMBLEA
  // =========================
  const ingresarAsamblea = async () => {
    if (!numeroCasa || !nombreAsistente) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (esApoderado && !casaRepresentada) {
      Alert.alert(
        'Error',
        'Debes indicar la casa que representas'
      );
      return;
    }

    setCargando(true);

    console.log('🔍 Buscando vivienda con numero_casa:', numeroCasa);

    // 1️⃣ Obtener vivienda
    const { data: vivienda, error: errorVivienda } = await supabase
      .from('viviendas')
      .select('id, numero_casa')
      .eq('numero_casa', numeroCasa)
      .single();

    console.log('📦 Resultado consulta vivienda:', { vivienda, errorVivienda });

    if (!vivienda || errorVivienda) {
      setCargando(false);
      Alert.alert(
        'Error',
        `La vivienda ${numeroCasa} no existe en el sistema`
      );
      return;
    }

    // 2️⃣ insertar asistencia
    console.log('💾 Intentando insertar asistencia con datos:', {
      asamblea_id: asambleaId,
      vivienda_id: vivienda.id,
      nombre_asistente: nombreAsistente,
      es_apoderado: esApoderado,
      casa_representada: esApoderado ? casaRepresentada : null,
      estado_apoderado: esApoderado ? 'PENDIENTE' : null,
    });

    const { data: asistencia, error } = await supabase
      .from('asistencias')
      .insert({
        asamblea_id: asambleaId,
        vivienda_id: vivienda.id,
        nombre_asistente: nombreAsistente,
        es_apoderado: esApoderado,
        casa_representada: esApoderado ? casaRepresentada : null,
        estado_apoderado: esApoderado ? 'PENDIENTE' : null,
      })
      .select()
      .single();

    console.log('📤 Resultado inserción:', { asistencia, error });

    setCargando(false);

    if (error || !asistencia) {
      console.error('❌ Error completo:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Error',
        `No se pudo registrar la asistencia: ${error?.message || 'Error desconocido'}`
      );
      return;
    }

    // 3️⃣ Redirigir según el tipo de registro
    if (esApoderado) {
      // Si es apoderado, ir a sala de espera especial
      router.replace({
        pathname: '/residente/sala-espera-apoderado',
        params: {
          asambleaId,
          asistenciaId: asistencia.id,
          numeroCasa,
          casaRepresentada,
        },
      });
    } else {
      // Si no es apoderado, ir a sala de espera normal
      router.replace({
        pathname: '/residente/sala-espera',
        params: {
          asambleaId,
          asistenciaId: asistencia.id,
          numeroCasa,
        },
      });
    }
  };

  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
      {/* ================= PASO 1 ================= */}
      {step === 1 && (
        <View style={styles.card}>
          <ScaledText style={styles.title}>
            Ingresa el código de la asamblea
          </ScaledText>

          <TextInput
            value={codigo}
            onChangeText={setCodigo}
            placeholder="Ej: A1234"
            autoCapitalize="characters"
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={validarCodigo}
            disabled={cargando}
          >
            <ScaledText style={styles.buttonText}>
              {cargando ? 'Validando...' : 'Siguiente'}
            </ScaledText>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= PASO 2 ================= */}
      {step === 2 && (
        <View style={styles.card}>
          <ScaledText style={styles.title}>
            Datos del asistente
          </ScaledText>

          <TextInput
            placeholder="Número de casa"
            style={styles.input}
            value={numeroCasa}
            onChangeText={setNumeroCasa}
          />

          <TextInput
            placeholder="Nombre del asistente"
            style={styles.input}
            value={nombreAsistente}
            onChangeText={setNombreAsistente}
          />

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setEsApoderado(!esApoderado)}
          >
            <ScaledText style={styles.checkboxText}>
              {esApoderado ? '☑' : '☐'} ¿Es apoderado de otra casa?
            </ScaledText>
          </TouchableOpacity>

          {esApoderado && (
            <TextInput
              placeholder="Casa que representa"
              style={styles.input}
              value={casaRepresentada}
              onChangeText={setCasaRepresentada}
            />
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={ingresarAsamblea}
            disabled={cargando}
          >
            <ScaledText style={styles.buttonText}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </ScaledText>
          </TouchableOpacity>
        </View>
      )}
      
      {/* FAB de Accesibilidad */}
      <AccessibilityFAB />
      </ScrollView>
    </LinearGradient>
  );
}

