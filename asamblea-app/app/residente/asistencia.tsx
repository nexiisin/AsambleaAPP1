import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { descargarComprobanteAsistencia } from '@/src/services/pdf-asistencia';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { styles } from '@/src/styles/screens/residente/asistencia.styles';

export default function ResidenteAsistencia() {
  const { asambleaId } = useLocalSearchParams<{ asambleaId: string }>();

  // formulario
  const [numeroCasa, setNumeroCasa] = useState('');
  const [nombreAsistente, setNombreAsistente] = useState('');
  const [esApoderado, setEsApoderado] = useState(false);
  const [casaRepresentada, setCasaRepresentada] = useState('');
  const [cargando, setCargando] = useState(false);

  const ingresarAsamblea = async () => {
    // Este formulario registra la SALIDA (cierre) de la asistencia.
    if (!numeroCasa || !nombreAsistente) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (esApoderado && !casaRepresentada) {
      Alert.alert('Error', 'Debes indicar la casa que representas');
      return;
    }

    setCargando(true);

    // obtener vivienda
    const { data: vivienda } = await supabase
      .from('viviendas')
      .select('id')
      .eq('numero_casa', numeroCasa)
      .single();

    if (!vivienda) {
      setCargando(false);
      Alert.alert('Error', 'La vivienda no existe en el sistema');
      return;
    }

    try {
      // buscar asistencia existente para esta vivienda y asamblea
      const { data: existente } = await supabase
        .from('asistencias')
        .select('*')
        .eq('asamblea_id', asambleaId)
        .eq('vivienda_id', vivienda.id)
        .single();

      const { data: propietario } = await supabase
        .from('propietarios')
        .select('primer_nombre, primer_apellido')
        .eq('vivienda_id', vivienda.id)
        .single();

      const payload: any = {
        nombre_asistente: nombreAsistente,
        es_apoderado: esApoderado,
        vivienda_representada_id: esApoderado ? vivienda.id : null,
        formulario_cierre_completado: true,
        salida_autorizada: true,
        hora_salida: new Date().toISOString(),
      };

      if (existente && existente.id) {
        // actualizar registro existente marcando salida
        const { error: updateError } = await supabase
          .from('asistencias')
          .update(payload)
          .eq('id', existente.id);

        if (updateError) {
          console.error('Error actualizando asistencia (salida):', updateError);
          Alert.alert('Error', 'No se pudo registrar la salida');
          setCargando(false);
          return;
        }
      } else {
        // no hay registro de entrada: insertar uno nuevo marcado como salida
        const insertData: any = {
          asamblea_id: asambleaId,
          vivienda_id: vivienda.id,
          nombre_asistente: nombreAsistente,
          es_apoderado: esApoderado,
          vivienda_representada_id: esApoderado ? vivienda.id : null,
          formulario_cierre_completado: true,
          salida_autorizada: true,
          hora_salida: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from('asistencias')
          .insert(insertData);

        if (insertError) {
          console.error('Error insertando asistencia (salida):', insertError);
          Alert.alert('Error', 'No se pudo registrar la salida');
          setCargando(false);
          return;
        }
      }

      setCargando(false);
      
      const finalizarSalida = (mensaje: string) => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            window.alert(mensaje);
          }
          router.replace('/');
          return;
        }

        Alert.alert(
          '✅ Salida Registrada',
          mensaje,
          [
            {
              text: 'Aceptar',
              onPress: () => router.replace('/'),
            }
          ]
        );
      };

      // Generar y descargar el comprobante de asistencia automáticamente
      try {
        await descargarComprobanteAsistencia({
          nombreAsistente: nombreAsistente,
          nombrePropietario: propietario?.primer_nombre || '',
          apellidoPropietario: propietario?.primer_apellido || '',
          numeroCasa: numeroCasa,
          casaRepresentada: esApoderado ? casaRepresentada : undefined,
          esApoderado: esApoderado,
          fecha: new Date().toISOString(),
        });

        // Mostrar mensaje de confirmación y redirigir a pantalla principal
        finalizarSalida('Tu comprobante de asistencia ha sido descargado. ¡Gracias por acompañarnos en la asamblea!');
      } catch (pdfError) {
        console.error('Error descargando comprobante:', pdfError);
        // Si falla el PDF, igualmente sacar al usuario a la pantalla principal
        finalizarSalida('Tu salida ha sido registrada correctamente. ¡Gracias por acompañarnos en la asamblea!');
      }
    } catch (e) {
      console.error('Error registrando salida:', e);
      setCargando(false);
      Alert.alert('Error', 'Ocurrió un error al registrar la salida');
    }
  };

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Registro para cierre de asamblea</Text>

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

          <TouchableOpacity style={styles.checkbox} onPress={() => setEsApoderado(!esApoderado)}>
            <Text style={styles.checkboxText}>{esApoderado ? '☑' : '☐'} ¿Es apoderado de otra casa?</Text>
          </TouchableOpacity>

          {esApoderado && (
            <TextInput
              placeholder="Casa que representa"
              style={styles.input}
              value={casaRepresentada}
              onChangeText={setCasaRepresentada}
            />
          )}

          <TouchableOpacity style={styles.button} onPress={ingresarAsamblea} disabled={cargando}>
            <Text style={styles.buttonText}>{cargando ? 'Saliendo...' : 'Salir'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AccessibilityFAB />
    </LinearGradient>
  );
}

