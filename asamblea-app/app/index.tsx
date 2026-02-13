import { View, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';
import { styles } from '@/src/styles/screens/home/index.styles';

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

