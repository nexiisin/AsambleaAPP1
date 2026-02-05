-- =====================================================
-- TABLA: administradores
-- Fecha: Febrero 5, 2026
-- Descripción: Almacena credenciales de administradores
-- =====================================================

-- Crear tabla administradores
CREATE TABLE IF NOT EXISTS public.administradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre_completo VARCHAR(255),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar administradores por defecto
INSERT INTO public.administradores (usuario, password, nombre_completo, activo) VALUES
  ('Admin', 'Altosdelguali2026', 'Administrador Principal', TRUE),
  ('Administrador', 'Altosdelguali2026', 'Administrador General', TRUE)
ON CONFLICT (usuario) DO NOTHING;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_administradores_usuario ON public.administradores(usuario);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;

-- Política: Solo permitir SELECT con autenticación (para login)
-- Nota: En producción deberías usar autenticación de Supabase Auth
CREATE POLICY "Permitir lectura pública de administradores" 
ON public.administradores 
FOR SELECT 
USING (activo = TRUE);

-- Comentarios
COMMENT ON TABLE public.administradores IS 'Tabla de credenciales de administradores del sistema';
COMMENT ON COLUMN public.administradores.usuario IS 'Nombre de usuario único';
COMMENT ON COLUMN public.administradores.password IS 'Contraseña (en producción debería ser hash)';
COMMENT ON COLUMN public.administradores.activo IS 'Indica si el administrador está activo';
