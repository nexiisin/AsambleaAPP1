import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import { AccessibilityFAB } from '@/src/components/AccessibilityFAB';
import { useResponsive } from '@/src/hooks/useResponsive';
import { styles } from '@/src/styles/screens/admin/asambleas.styles';

type Asamblea = {
  id: string;
  codigo_acceso: string;
  estado: string;
};

const PANEL_WIDTH_MOBILE = 520;
const PANEL_WIDTH_DESKTOP = 900;

export default function AsambleasList() {
  const { isDesktop } = useResponsive();
  const PANEL_WIDTH = isDesktop ? PANEL_WIDTH_DESKTOP : PANEL_WIDTH_MOBILE;
  const [asambleas, setAsambleas] = useState<Asamblea[]>([]);

  const cargarAsambleas = async () => {
    const { data } = await supabase
      .from('asambleas')
      .select('id, codigo_acceso, estado')
      .order('created_at', { ascending: false });

    if (data) setAsambleas(data);
  };

  useEffect(() => {
    cargarAsambleas();
  }, []);

  return (
    <LinearGradient
      colors={['#5fba8b', '#d9f3e2']}
      style={styles.page}
    >
      <View style={[styles.panel, { maxWidth: PANEL_WIDTH }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Asambleas existentes</Text>

        {asambleas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Por el momento no hay ninguna asamblea</Text>
          </View>
        ) : (
          <FlatList
            data={asambleas}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
            const estadoColor = item.estado === 'CERRADA' ? '#dc2626' : '#16a34a';

            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: estadoColor }]}
                onPress={() =>
                  router.push({
                    pathname: '/admin/asamblea',
                    params: { asambleaId: item.id },
                  })
                }
              >
                <Text style={styles.cardTitle}>
                  Código: {item.codigo_acceso}
                </Text>
                <Text style={[styles.cardText, { color: estadoColor }]}> 
                  Estado: {item.estado}
                </Text>
              </TouchableOpacity>
            );
          }}
            />
        )}

      </View>
      <AccessibilityFAB />
    </LinearGradient>
  );
}

