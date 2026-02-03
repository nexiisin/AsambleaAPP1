import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/src/services/supabase';

export default function ResidenteScreen() {
  // paso 1 o 2
  const [step, setStep] = useState<1 | 2>(1);

  // asamblea
  const [codigo, setCodigo] = useState('');
  const [asambleaId, setAsambleaId] = useState<string | null>(null);

  // formulario
  const [nombrePropietario, setNombrePropietario] = useState('');
  const [apellidoPropietario, setApellidoPropietario] = useState('');
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
    if (
      !nombrePropietario ||
      !apellidoPropietario ||
      !numeroCasa ||
      !nombreAsistente
    ) {
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

    // 2️⃣ Obtener propietario de esa vivienda
    const { data: propietario, error: errorPropietario } = await supabase
      .from('propietarios')
      .select('primer_nombre, primer_apellido')
      .eq('vivienda_id', vivienda.id)
      .single();

    console.log('👤 Resultado consulta propietario:', { propietario, errorPropietario });

    if (!propietario || errorPropietario) {
      setCargando(false);
      Alert.alert(
        'Error',
        `No se encontró el propietario registrado para la casa ${numeroCasa}`
      );
      return;
    }

    // 3️⃣ Validar que nombre y apellido coincidan (case-insensitive)
    const nombreCoincide = propietario.primer_nombre?.toLowerCase().trim() === nombrePropietario.toLowerCase().trim();
    const apellidoCoincide = propietario.primer_apellido?.toLowerCase().trim() === apellidoPropietario.toLowerCase().trim();

    console.log('🔒 Validación:', {
      nombreBD: propietario.primer_nombre,
      nombreIngresado: nombrePropietario,
      nombreCoincide,
      apellidoBD: propietario.primer_apellido,
      apellidoIngresado: apellidoPropietario,
      apellidoCoincide
    });

    if (!nombreCoincide || !apellidoCoincide) {
      setCargando(false);
      Alert.alert(
        '❌ Datos incorrectos',
        `Verifica los datos e intenta nuevamente.`
      );
      return;
    }

    // 2️⃣ insertar asistencia
    const { data: asistencia, error } = await supabase
      .from('asistencias')
      .insert({
        asamblea_id: asambleaId,
        vivienda_id: vivienda.id,
        nombre_asistente: nombreAsistente,
        apellido_propietario: apellidoPropietario,
        es_apoderado: esApoderado,
        vivienda_representada_id: esApoderado
          ? vivienda.id
          : null,
      })
      .select()
      .single();

    setCargando(false);

    if (error || !asistencia) {
      Alert.alert(
        'Error',
        'No se pudo registrar la asistencia'
      );
      return;
    }

    // 3️⃣ ir a sala de espera
    router.replace({
      pathname: '/residente/sala-espera',
      params: {
        asambleaId,
        asistenciaId: asistencia.id,
        numeroCasa,
      },
    });
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
          <Text style={styles.title}>
            Ingresa el código de la asamblea
          </Text>

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
            <Text style={styles.buttonText}>
              {cargando ? 'Validando...' : 'Siguiente'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= PASO 2 ================= */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.title}>
            Datos del asistente
          </Text>

          <TextInput
            placeholder="Nombre del propietario"
            style={styles.input}
            value={nombrePropietario}
            onChangeText={setNombrePropietario}
          />

          <TextInput
            placeholder="Apellido del propietario"
            style={styles.input}
            value={apellidoPropietario}
            onChangeText={setApellidoPropietario}
          />

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
            <Text style={styles.checkboxText}>
              {esApoderado ? '☑' : '☐'} ¿Es apoderado de otra casa?
            </Text>
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
            <Text style={styles.buttonText}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>
    </LinearGradient>
  );
}

// =========================
// ESTILOS
// =========================
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420, // 🔑 clave para PC
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#166534',
  },
  input: {
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  checkbox: {
    marginVertical: 10,
  },
  checkboxText: {
    fontSize: 16,
  },
});
