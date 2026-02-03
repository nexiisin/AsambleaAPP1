-- Agregar columna para mostrar resultados de una propuesta
ALTER TABLE asambleas 
ADD COLUMN IF NOT EXISTS propuesta_resultados_id UUID REFERENCES propuestas(id) ON DELETE SET NULL;

-- Agregar índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_asambleas_propuesta_resultados 
ON asambleas(propuesta_resultados_id);

-- Comentario explicativo
COMMENT ON COLUMN asambleas.propuesta_resultados_id IS 'ID de la propuesta cuyos resultados están siendo mostrados a los residentes';
