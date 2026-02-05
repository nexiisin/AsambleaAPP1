-- =====================================================
-- FUNCIÓN RPC: Registrar voto (optimizado)
-- Fecha: Febrero 5, 2026
-- Descripción: Verifica y registra voto en UNA sola llamada
-- =====================================================

CREATE OR REPLACE FUNCTION public.registrar_voto(
  p_propuesta_id UUID,
  p_vivienda_id UUID,
  p_asistencia_id UUID,
  p_tipo_voto VARCHAR,
  p_casa_representada_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_voto_id UUID;
  v_voto_rep_id UUID;
  v_ya_votado BOOLEAN := FALSE;
  v_ya_votado_rep BOOLEAN := FALSE;
BEGIN
  -- Verificar si ya existe voto para vivienda principal
  SELECT EXISTS(
    SELECT 1 FROM votos 
    WHERE propuesta_id = p_propuesta_id 
    AND vivienda_id = p_vivienda_id
  ) INTO v_ya_votado;

  -- Si ya votó, retornar error
  IF v_ya_votado THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Ya existe un voto para esta vivienda en esta propuesta'
    );
  END IF;

  -- Insertar voto para vivienda principal
  INSERT INTO votos (propuesta_id, vivienda_id, asistencia_id, tipo_voto)
  VALUES (p_propuesta_id, p_vivienda_id, p_asistencia_id, p_tipo_voto)
  RETURNING id INTO v_voto_id;

  -- Si es apoderado con casa representada, insertar voto para esa casa también
  IF p_casa_representada_id IS NOT NULL THEN
    -- Verificar si ya existe voto para casa representada
    SELECT EXISTS(
      SELECT 1 FROM votos 
      WHERE propuesta_id = p_propuesta_id 
      AND vivienda_id = p_casa_representada_id
    ) INTO v_ya_votado_rep;

    IF NOT v_ya_votado_rep THEN
      INSERT INTO votos (propuesta_id, vivienda_id, asistencia_id, tipo_voto)
      VALUES (p_propuesta_id, p_casa_representada_id, p_asistencia_id, p_tipo_voto)
      RETURNING id INTO v_voto_rep_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'voto_id', v_voto_id,
    'voto_representado_id', v_voto_rep_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicación:
-- 1. Verifica si ya existe voto (1 check)
-- 2. Inserta el voto si no existe (1 insert)
-- 3. Si es apoderado, verifica y inserta voto representado (todo en la misma función)
-- 4. TOTAL: 1 RPC call (en lugar de 3 queries separadas)
-- RESULTADO: Reducción de queries de 3×164 = 492 a 164 RPC calls
