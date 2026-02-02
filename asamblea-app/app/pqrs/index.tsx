import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

const FORM_URL = 'https://forms.gle/TU_FORM_AQUI';

export default function PQRS() {
  const openForm = () => {
    Linking.openURL(FORM_URL);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Solicitudes y PQRS</Text>

        <Text style={styles.subtitle}>
          Selecciona el tipo de solicitud
        </Text>

        {[
          '🧾 Solicitar un documento',
          '⚠️ Registrar una queja',
          '💡 Enviar una sugerencia',
          '🛠 Reportar una novedad',
          '❓ Otra solicitud',
        ].map((text) => (
          <TouchableOpacity
            key={text}
            style={styles.button}
            onPress={openForm}
          >
            <Text style={styles.buttonText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 420, // 🔥 MISMO TAMAÑO QUE HOME
    alignItems: 'center',
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111827',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },

  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 12,
  },

  buttonText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#111827',
    fontWeight: '500',
  },
});
