-- =====================================================
-- MIGRACIÓN: Agregar campos de apoderados a asistencias
-- Fecha: 2026-02-03
-- Descripción: Añade columnas necesarias para gestionar apoderados
-- =====================================================

-- Agregar columnas para gestión de apoderados
ALTER TABLE public.asistencias 
ADD COLUMN IF NOT EXISTS es_apoderado BOOLEAN DEFAULT FALSE;

ALTER TABLE public.asistencias 
ADD COLUMN IF NOT EXISTS casa_representada VARCHAR(20);

ALTER TABLE public.asistencias 
ADD COLUMN IF NOT EXISTS estado_apoderado VARCHAR(20) CHECK (estado_apoderado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO'));

-- Crear índice para búsquedas de apoderados
CREATE INDEX IF NOT EXISTS idx_asistencias_apoderado ON public.asistencias(es_apoderado, estado_apoderado);

-- Comentarios para documentación
COMMENT ON COLUMN public.asistencias.es_apoderado IS 'Indica si el asistente es apoderado de otra vivienda';
COMMENT ON COLUMN public.asistencias.casa_representada IS 'Número de casa que el apoderado representa';
COMMENT ON COLUMN public.asistencias.estado_apoderado IS 'Estado de la solicitud de apoderado: PENDIENTE, APROBADO, RECHAZADO';
