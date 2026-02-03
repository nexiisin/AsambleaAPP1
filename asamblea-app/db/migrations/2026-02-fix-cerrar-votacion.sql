-- Arreglar función cerrar_votacion para que vuelva a ESPERA en vez de RESULTADOS
-- Los resultados solo se deben mostrar cuando el admin presione el botón "Mostrar resultados"

CREATE OR REPLACE FUNCTION public.cerrar_votacion(p_asamblea_id UUID)
RETURNS VOID AS $$
DECLARE
  v_propuesta_id UUID;
  v_porcentaje_si DECIMAL(5,2);
  v_regla_aprobacion DECIMAL(3,2);
BEGIN
  SELECT propuesta_activa_id, regla_aprobacion
  INTO v_propuesta_id, v_regla_aprobacion
  FROM public.asambleas
  WHERE id = p_asamblea_id;

  IF v_propuesta_id IS NOT NULL THEN
    SELECT porcentaje_si INTO v_porcentaje_si
    FROM public.propuestas
    WHERE id = v_propuesta_id;

    UPDATE public.propuestas
    SET estado = 'CERRADA',
        fecha_cierre = timezone('utc', now()),
        resultado_aprobada = (v_porcentaje_si >= (v_regla_aprobacion * 100))
    WHERE id = v_propuesta_id;

    -- CAMBIO: Volver a ESPERA en vez de RESULTADOS
    -- Los resultados solo se muestran cuando el admin presiona "Mostrar resultados"
    UPDATE public.asambleas
    SET estado_actual = 'ESPERA',
        propuesta_activa_id = NULL,
        propuesta_resultados_id = NULL
    WHERE id = p_asamblea_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
