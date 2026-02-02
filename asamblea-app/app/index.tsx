import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function Home() {
  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={styles.container}
    >
    <View style={styles.container}>
      {/* HEADER + BOTONES PRINCIPALES (TODO JUNTO) */}
      <View style={styles.main}>
        <Image
          source={require('./logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Altos del Guali</Text>

        <TouchableOpacity
          onPress={() => router.push('/residente')}
          style={[styles.button, styles.primary]}
        >
          <Text style={styles.buttonText}>Entrar como Residente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin')}
          style={[styles.button, styles.admin]}
        >
          <Text style={styles.buttonText}>Entrar como Administrador</Text>
        </TouchableOpacity>
      </View>

      {/* PQRS ABAJO */}
      <View style={styles.footer}>
        <Text style={styles.pqrsText}>¿Vienes por una solicitud o PQRS?</Text>

        <TouchableOpacity
          onPress={() => router.push('/pqrs')}
          style={[styles.button, styles.gray]}
        >
          <Text style={styles.pqrsButtonText}>Ir a PQRS</Text>
        </TouchableOpacity>
      </View>
    </View>
    </LinearGradient>
  );
}

const BUTTON_WIDTH = 280;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  main: {
   alignItems: 'center',
  },


  /* HEADER */
  header: {
    alignItems: 'center',
    marginTop: 40,
  },

  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#065f46',
     marginBottom: 29,// 👈 AQUÍ (≈ 1 cm visual)
  },

  /* CONTENIDO CENTRAL */
  centerContent: {
    alignItems: 'center',
    marginTop: 24//controla la distancia desde el título
  },


  /* FOOTER */
  footer: {
    alignItems: 'center',
    marginTop: 'auto', // 👈 CLAVE ABSOLUTA
    paddingBottom: 24,
  },

  /* BOTONES */
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    width: BUTTON_WIDTH,
    marginBottom: 14,
  },

  primary: {
    backgroundColor: '#16a34a',
  },

  admin: {
    backgroundColor: '#2563eb',
  },

  gray: {
    backgroundColor: '#9CA3AF',
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  pqrsText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 10,
  },

  pqrsButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
});
