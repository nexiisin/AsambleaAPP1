import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { ScaledText } from '@/src/components/ScaledText';
import { styles } from '@/src/styles/screens/pqrs/index.styles';

const FORMULARIOS = {
  documento: 'https://docs.google.com/forms/d/e/1FAIpQLScGGDYB2ccY6trDeM8G7R_oG-dIIIoz3d8igCHfjYKnUE5G6w/viewform?usp=header',
  quejasSugerencias: 'https://docs.google.com/forms/d/e/1FAIpQLSdV2e3Ieoc_fqbUNqQhDgAhHoLcANen-goSK9VqW0OSie0o1A/viewform?usp=header',
  novedad: 'https://docs.google.com/forms/d/e/1FAIpQLSfRJpzFqvdj45Knjr5DfD7AJCzER7NKnAr8uN5jP_XH7z3EWw/viewform?usp=publish-editor',
  otra: 'https://docs.google.com/forms/d/e/1FAIpQLSc2PLHA1u20wOlKdKvsR7yYuq47gZFkMxYjQoP2a9JPOqRkkg/viewform',
};

const BOTONES = [
  { texto: '🧾 Solicitar un documento', key: 'documento' },
  { texto: '💡 Sugerencia/Queja/Felicitacion', key: 'quejasSugerencias' },
  { texto: '🛠 Reportar una novedad', key: 'novedad' },
  { texto: '❓ Otra solicitud', key: 'otra' },
];

export default function PQRS() {
  const abrirFormulario = (key: string) => {
    const url = FORMULARIOS[key as keyof typeof FORMULARIOS];
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <LinearGradient colors={['#5fba8b', '#d9f3e2']} style={styles.container}>
      <View style={styles.card}>
        <ScaledText style={styles.title}>Solicitudes y PQRS</ScaledText>

        <ScaledText style={styles.subtitle}>
          Selecciona el tipo de solicitud
        </ScaledText>

        {BOTONES.map((boton) => (
          <TouchableOpacity
            key={boton.key}
            style={styles.button}
            onPress={() => abrirFormulario(boton.key)}
          >
            <ScaledText style={styles.buttonText}>{boton.texto}</ScaledText>
          </TouchableOpacity>
        ))}
      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}

