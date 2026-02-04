import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';

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

        <ScaledText style={styles.title}>Altos del Guali</ScaledText>

        <TouchableOpacity
          onPress={() => router.push('/residente')}
          style={[styles.button, styles.primary]}
        >
          <ScaledText style={styles.buttonText}>Entrar como Residente</ScaledText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin')}
          style={[styles.button, styles.admin]}
        >
          <ScaledText style={styles.buttonText}>Entrar como Administrador</ScaledText>
        </TouchableOpacity>
      </View>

      {/* PQRS ABAJO */}
      <View style={styles.footer}>
        <ScaledText style={styles.pqrsText}>¿Vienes por una solicitud o PQRS?</ScaledText>

        <TouchableOpacity
          onPress={() => router.push('/pqrs')}
          style={[styles.button, styles.gray]}
        >
          <ScaledText style={styles.pqrsButtonText}>Ir a PQRS</ScaledText>
        </TouchableOpacity>
      </View>
    </View>
    <AccessibilityFAB />
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
