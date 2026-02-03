# Ejecutar migración para resultados

La columna `propuesta_resultados_id` no existe en tu base de datos. Necesitas ejecutarla:

## Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en https://supabase.com
2. Ve a "SQL Editor"
3. Copia y pega este código:

```sql
-- Agregar columna para mostrar resultados de una propuesta
ALTER TABLE asambleas 
ADD COLUMN IF NOT EXISTS propuesta_resultados_id UUID REFERENCES propuestas(id) ON DELETE SET NULL;

-- Agregar índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_asambleas_propuesta_resultados 
ON asambleas(propuesta_resultados_id);

-- Comentario explicativo
COMMENT ON COLUMN asambleas.propuesta_resultados_id IS 'ID de la propuesta cuyos resultados están siendo mostrados a los residentes';
```

4. Haz clic en "Run" o presiona Ctrl+Enter
5. Recarga la app y el botón "Mostrar a residentes" funcionará

## Opción 2: Desde terminal con psql (si tienes acceso directo)

```bash
psql "tu_connection_string" -f /workspaces/AsambleaAPP1/asamblea-app/db/migrations/2026-02-propuesta-resultados.sql
```

Reemplaza `tu_connection_string` con tu cadena de conexión de Supabase.
