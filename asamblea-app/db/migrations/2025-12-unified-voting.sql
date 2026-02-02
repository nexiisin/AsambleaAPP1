-- =====================================================
-- MIGRACIÓN COMPLETA: Sistema de Votación con Estado Centralizado
-- Versión: 2.0 Unificada
-- Fecha: Diciembre 2025
-- =====================================================
-- Este script es IDEMPOTENTE (se puede ejecutar múltiples veces sin romper nada)
-- =====================================================

-- =====================================================
-- PASO 1: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PASO 2: TABLAS BASE (Si no existen)
-- =====================================================

-- Tabla Viviendas
CREATE TABLE IF NOT EXISTS public.viviendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_casa VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_viviendas_numero_casa ON public.viviendas(numero_casa);

-- Tabla Propietarios
CREATE TABLE IF NOT EXISTS public.propietarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivienda_id UUID NOT NULL REFERENCES public.viviendas(id) ON DELETE CASCADE,
  primer_nombre VARCHAR(100) NOT NULL,
  primer_apellido VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(vivienda_id)
);

CREATE INDEX IF NOT EXISTS idx_propietarios_vivienda ON public.propietarios(vivienda_id);
CREATE INDEX IF NOT EXISTS idx_propietarios_nombre ON public.propietarios(primer_nombre, primer_apellido);

-- Tabla Asambleas
CREATE TABLE IF NOT EXISTS public.asambleas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_acceso VARCHAR(10) NOT NULL UNIQUE,
  estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
  fecha_inicio TIMESTAMPTZ DEFAULT timezone('utc', now()),
  fecha_fin TIMESTAMPTZ,
  regla_aprobacion DECIMAL(3,2) NOT NULL DEFAULT 0.51,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_asambleas_codigo ON public.asambleas(codigo_acceso);
CREATE INDEX IF NOT EXISTS idx_asambleas_estado ON public.asambleas(estado);

-- Tabla Asistencias
CREATE TABLE IF NOT EXISTS public.asistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES public.asambleas(id) ON DELETE CASCADE,
  vivienda_id UUID NOT NULL REFERENCES public.viviendas(id) ON DELETE CASCADE,
  nombre_asistente VARCHAR(200) NOT NULL,
  fecha_registro TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (asamblea_id, vivienda_id)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_asamblea ON public.asistencias(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_vivienda ON public.asistencias(vivienda_id);

-- Tabla Propuestas
CREATE TABLE IF NOT EXISTS public.propuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES public.asambleas(id) ON DELETE CASCADE,
  titulo VARCHAR(500) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'ABIERTA', 'CERRADA')),
  resultado_aprobada BOOLEAN,
  votos_si INTEGER DEFAULT 0,
  votos_no INTEGER DEFAULT 0,
  total_votos INTEGER DEFAULT 0,
  porcentaje_si DECIMAL(5,2) DEFAULT 0,
  porcentaje_no DECIMAL(5,2) DEFAULT 0,
  fecha_apertura TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_propuestas_asamblea ON public.propuestas(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_propuestas_estado ON public.propuestas(estado);
CREATE INDEX IF NOT EXISTS idx_propuestas_orden ON public.propuestas(orden);

-- Tabla Votos
CREATE TABLE IF NOT EXISTS public.votos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id UUID NOT NULL REFERENCES public.propuestas(id) ON DELETE CASCADE,
  vivienda_id UUID NOT NULL REFERENCES public.viviendas(id) ON DELETE CASCADE,
  asistencia_id UUID NOT NULL REFERENCES public.asistencias(id) ON DELETE CASCADE,
  tipo_voto VARCHAR(2) NOT NULL CHECK (tipo_voto IN ('SI','NO')),
  fecha_voto TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (propuesta_id, vivienda_id)
);

CREATE INDEX IF NOT EXISTS idx_votos_propuesta ON public.votos(propuesta_id);
CREATE INDEX IF NOT EXISTS idx_votos_vivienda ON public.votos(vivienda_id);
CREATE INDEX IF NOT EXISTS idx_votos_tipo ON public.votos(tipo_voto);

-- Tabla Cronometro Debate (compatibilidad)
CREATE TABLE IF NOT EXISTS public.cronometro_debate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES public.asambleas(id) ON DELETE CASCADE,
  propuesta_id UUID REFERENCES public.propuestas(id) ON DELETE SET NULL,
  duracion_segundos INTEGER NOT NULL,
  tiempo_transcurrido INTEGER NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'DETENIDO' CHECK (estado IN ('ACTIVO', 'PAUSADO', 'DETENIDO')),
  timestamp_inicio TIMESTAMPTZ,
  timestamp_pausa TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(asamblea_id)
);

CREATE INDEX IF NOT EXISTS idx_cronometro_asamblea ON public.cronometro_debate(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_cronometro_estado ON public.cronometro_debate(estado);

-- =====================================================
-- PASO 3: AGREGAR COLUMNAS DE ESTADO CENTRALIZADO
-- =====================================================

ALTER TABLE public.asambleas 
ADD COLUMN IF NOT EXISTS estado_actual VARCHAR(20) DEFAULT 'ESPERA';

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'asambleas_estado_actual_check'
  ) THEN
    ALTER TABLE public.asambleas 
    ADD CONSTRAINT asambleas_estado_actual_check 
    CHECK (estado_actual IN ('ESPERA', 'DEBATE', 'VOTACION', 'RESULTADOS'));
  END IF;
END $$;

ALTER TABLE public.asambleas 
ADD COLUMN IF NOT EXISTS propuesta_activa_id UUID;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'asambleas_propuesta_activa_fkey'
  ) THEN
    ALTER TABLE public.asambleas 
    ADD CONSTRAINT asambleas_propuesta_activa_fkey 
    FOREIGN KEY (propuesta_activa_id) REFERENCES public.propuestas(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.asambleas 
ADD COLUMN IF NOT EXISTS cronometro_activo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cronometro_pausado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cronometro_inicio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cronometro_duracion_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cronometro_tiempo_pausado INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_asambleas_estado_actual ON public.asambleas(estado_actual);
CREATE INDEX IF NOT EXISTS idx_asambleas_propuesta_activa ON public.asambleas(propuesta_activa_id);

-- =====================================================
-- PASO 4: FUNCIONES DE NEGOCIO
-- =====================================================

CREATE OR REPLACE FUNCTION public.calcular_estadisticas_propuesta(propuesta_uuid UUID)
RETURNS TABLE (
  votos_si INTEGER,
  votos_no INTEGER,
  total_votos INTEGER,
  porcentaje_si DECIMAL(5,2),
  porcentaje_no DECIMAL(5,2),
  total_asistentes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE v.tipo_voto = 'SI')::INTEGER AS votos_si,
    COUNT(*) FILTER (WHERE v.tipo_voto = 'NO')::INTEGER AS votos_no,
    COUNT(*)::INTEGER AS total_votos,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE v.tipo_voto = 'SI')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END AS porcentaje_si,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE v.tipo_voto = 'NO')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END AS porcentaje_no,
    (
      SELECT COUNT(*)::INTEGER 
      FROM public.asistencias 
      WHERE asamblea_id = (SELECT asamblea_id FROM public.propuestas WHERE id = propuesta_uuid)
    ) AS total_asistentes
  FROM public.votos v
  WHERE v.propuesta_id = propuesta_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.iniciar_cronometro_debate(
  p_asamblea_id UUID,
  p_duracion_segundos INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE public.asambleas
  SET 
    estado_actual = 'DEBATE',
    cronometro_activo = true,
    cronometro_pausado = false,
    cronometro_tiempo_pausado = 0,
    cronometro_inicio = timezone('utc', now()),
    cronometro_duracion_segundos = p_duracion_segundos
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.pausar_cronometro(p_asamblea_id UUID)
RETURNS VOID AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_duracion INTEGER;
  v_tiempo_transcurrido INTEGER;
BEGIN
  SELECT cronometro_inicio, cronometro_duracion_segundos
  INTO v_inicio, v_duracion
  FROM public.asambleas
  WHERE id = p_asamblea_id AND cronometro_activo = true;

  IF v_inicio IS NOT NULL THEN
    v_tiempo_transcurrido := EXTRACT(EPOCH FROM (timezone('utc', now()) - v_inicio))::INTEGER;
    
    UPDATE public.asambleas
    SET 
      cronometro_pausado = true,
      cronometro_tiempo_pausado = v_tiempo_transcurrido
    WHERE id = p_asamblea_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reanudar_cronometro(p_asamblea_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tiempo_pausado INTEGER;
  v_duracion INTEGER;
BEGIN
  SELECT cronometro_tiempo_pausado, cronometro_duracion_segundos
  INTO v_tiempo_pausado, v_duracion
  FROM public.asambleas
  WHERE id = p_asamblea_id;

  UPDATE public.asambleas
  SET 
    cronometro_pausado = false,
    cronometro_inicio = timezone('utc', now()),
    cronometro_duracion_segundos = v_duracion - v_tiempo_pausado
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.detener_cronometro(p_asamblea_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.asambleas
  SET 
    cronometro_activo = false,
    cronometro_pausado = false,
    cronometro_tiempo_pausado = 0,
    cronometro_inicio = NULL,
    cronometro_duracion_segundos = 0,
    estado_actual = 'ESPERA'
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.iniciar_votacion(
  p_asamblea_id UUID,
  p_propuesta_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.propuestas
  SET estado = 'CERRADA',
      fecha_cierre = timezone('utc', now())
  WHERE asamblea_id = p_asamblea_id
    AND estado = 'ABIERTA'
    AND id != p_propuesta_id;

  UPDATE public.propuestas
  SET estado = 'ABIERTA',
      fecha_apertura = timezone('utc', now())
  WHERE id = p_propuesta_id;

  UPDATE public.asambleas
  SET 
    estado_actual = 'VOTACION',
    propuesta_activa_id = p_propuesta_id,
    cronometro_activo = false,
    cronometro_pausado = false
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql;

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

    UPDATE public.asambleas
    SET estado_actual = 'RESULTADOS',
        propuesta_activa_id = NULL
    WHERE id = p_asamblea_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.regresar_a_espera(p_asamblea_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.asambleas
  SET 
    estado_actual = 'ESPERA',
    propuesta_activa_id = NULL,
    cronometro_activo = false,
    cronometro_pausado = false,
    cronometro_tiempo_pausado = 0
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASO 5: TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_actualizar_estadisticas_voto()
RETURNS TRIGGER AS $$
DECLARE
  stats RECORD;
BEGIN
  SELECT * INTO stats FROM public.calcular_estadisticas_propuesta(NEW.propuesta_id);
  
  UPDATE public.propuestas
  SET 
    votos_si = stats.votos_si,
    votos_no = stats.votos_no,
    total_votos = stats.total_votos,
    porcentaje_si = stats.porcentaje_si,
    porcentaje_no = stats.porcentaje_no
  WHERE id = NEW.propuesta_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_voto_actualizar_stats ON public.votos;
CREATE TRIGGER trigger_voto_actualizar_stats
AFTER INSERT ON public.votos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_actualizar_estadisticas_voto();

-- =====================================================
-- PASO 6: VISTAS
-- =====================================================

CREATE OR REPLACE VIEW public.vista_estado_asamblea AS
SELECT 
  a.id AS asamblea_id,
  a.codigo_acceso,
  a.estado,
  a.estado_actual,
  a.propuesta_activa_id,
  a.cronometro_activo,
  a.cronometro_pausado,
  a.cronometro_inicio,
  a.cronometro_duracion_segundos,
  a.cronometro_tiempo_pausado,
  CASE 
    WHEN a.cronometro_activo AND NOT a.cronometro_pausado THEN
      GREATEST(
        0,
        a.cronometro_duracion_segundos -
        EXTRACT(EPOCH FROM (timezone('utc', now()) - a.cronometro_inicio))::INTEGER
      )
    WHEN a.cronometro_pausado THEN
      a.cronometro_duracion_segundos - a.cronometro_tiempo_pausado
    ELSE 0
  END AS cronometro_segundos_restantes,
  p.id AS propuesta_id,
  p.titulo,
  p.descripcion,
  p.estado AS propuesta_estado,
  p.votos_si,
  p.votos_no,
  p.total_votos,
  p.porcentaje_si,
  p.porcentaje_no,
  p.resultado_aprobada,
  (SELECT COUNT(*) FROM public.asistencias WHERE asamblea_id = a.id) AS total_asistentes
FROM public.asambleas a
LEFT JOIN public.propuestas p ON a.propuesta_activa_id = p.id;

-- =====================================================
-- PASO 7: ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.viviendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asambleas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronometro_debate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.viviendas;
CREATE POLICY "Enable read access for all users"
ON public.viviendas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.propietarios;
CREATE POLICY "Enable read access for all users"
ON public.propietarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.asambleas;
CREATE POLICY "Enable all access for all users"
ON public.asambleas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.asistencias;
CREATE POLICY "Enable all access for all users"
ON public.asistencias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.propuestas;
CREATE POLICY "Enable all access for all users"
ON public.propuestas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.votos;
CREATE POLICY "Enable all access for all users"
ON public.votos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.cronometro_debate;
CREATE POLICY "Enable all access for all users"
ON public.cronometro_debate FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PASO 8: DATOS DE EJEMPLO (OPCIONAL - Comentado)
-- =====================================================

/*
INSERT INTO public.viviendas (numero_casa) VALUES
  ('101'), ('102'), ('103'), ('104'), ('105'),
  ('201'), ('202'), ('203'), ('204'), ('205'),
  ('301'), ('302'), ('303'), ('304'), ('305')
ON CONFLICT (numero_casa) DO NOTHING;

INSERT INTO public.propietarios (vivienda_id, primer_nombre, primer_apellido)
SELECT id, 
  (ARRAY['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'Pedro', 'Laura', 'José', 'Isabel'])[floor(random() * 10 + 1)],
  (ARRAY['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores'])[floor(random() * 10 + 1)]
FROM public.viviendas
WHERE NOT EXISTS (SELECT 1 FROM public.propietarios LIMIT 1);
*/

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

-- =====================================================
-- HABILITAR REALTIME EN TODAS LAS TABLAS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.viviendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.propietarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asambleas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asistencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.propuestas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cronometro_debate;

DO $$ 
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '📊 Tablas: 7 (viviendas, propietarios, asambleas, asistencias, propuestas, votos, cronometro_debate)';
  RAISE NOTICE '🔧 Funciones: 8';
  RAISE NOTICE '⚡ Triggers: 1';
  RAISE NOTICE '👁️ Vistas: 1';
  RAISE NOTICE '🔒 RLS habilitado en todas las tablas';
  RAISE NOTICE '📡 Realtime habilitado en todas las tablas';
  RAISE NOTICE '📝 Sistema listo para usar';
END $$;

INSERT INTO public.viviendas (numero_casa) VALUES
  ('101'), ('102'), ('103'), ('104'), ('105'),
  ('201'), ('202'), ('203'), ('204'), ('205'),
  ('301'), ('302'), ('303'), ('304'), ('305')
ON CONFLICT (numero_casa) DO NOTHING;

INSERT INTO public.propietarios (vivienda_id, primer_nombre, primer_apellido)
SELECT id, 
  (ARRAY['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'Pedro', 'Laura', 'José', 'Isabel'])[floor(random() * 10 + 1)],
  (ARRAY['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores'])[floor(random() * 10 + 1)]
FROM public.viviendas
WHERE NOT EXISTS (SELECT 1 FROM public.propietarios LIMIT 1);

ALTER TABLE asambleas
ADD COLUMN hora_inicio timestamptz,
ADD COLUMN hora_cierre_ingreso timestamptz,
ADD COLUMN total_viviendas integer;
-- NOTE: siguiente línea "hora_cierre_ingreso = NOW()" es incorrecta SQL aislada; revisa antes de ejecutar manualmente

ALTER TABLE asistencias
ADD COLUMN es_apoderado boolean DEFAULT false,
ADD COLUMN vivienda_representada_id uuid NULL,
ADD COLUMN estado_apoderado text DEFAULT 'APROBADO';

ALTER TABLE asistencias
ADD COLUMN IF NOT EXISTS salida_autorizada boolean default false,
ADD COLUMN IF NOT EXISTS formulario_cierre_completado boolean default false,
ADD COLUMN IF NOT EXISTS motivo_salida text,
ADD COLUMN IF NOT EXISTS hora_salida timestamp;

ALTER TABLE asistencias
ADD COLUMN IF NOT EXISTS apellido_propietario text;
