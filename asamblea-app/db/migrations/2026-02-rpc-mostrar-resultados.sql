-- Crear función RPC para mostrar resultados a residentes
-- Esto evita problemas de permisos (RLS) desde el cliente

CREATE OR REPLACE FUNCTION public.mostrar_resultados(
  p_asamblea_id UUID,
  p_propuesta_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Actualizar la asamblea para mostrar resultados
  UPDATE public.asambleas
  SET 
    estado_actual = 'RESULTADOS',
    propuesta_resultados_id = p_propuesta_id,
    propuesta_activa_id = NULL
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.mostrar_resultados TO authenticated;
GRANT EXECUTE ON FUNCTION public.mostrar_resultados TO anon;
