Resumen del esquema de base de datos (migración 2.0 Unificada)

Archivo de migración: db/migrations/2025-12-unified-voting.sql

Tablas principales:
- `viviendas` — viviendas registradas (`id`, `numero_casa`, `created_at`).
- `propietarios` — propietario por vivienda (`vivienda_id`, `primer_nombre`, `primer_apellido`).
- `asambleas` — asambleas (`codigo_acceso`, `estado` {'ABIERTA','CERRADA'}, `estado_actual` {'ESPERA','DEBATE','VOTACION','RESULTADOS'}, `propuesta_activa_id`, cronómetro fields).
- `asistencias` — registros de asistencia por asamblea/vivienda.
- `propuestas` — propuestas con estados (`BORRADOR`,`ABIERTA`,`CERRADA`), conteo de votos y porcentajes.
- `votos` — votos por propuesta y vivienda.
- `cronometro_debate` — tabla complementaria para seguimiento de debates.

Funciones y lógica relevante:
- Funciones PL/pgSQL para iniciar/pausar/reanudar/detener cronómetro.
- `iniciar_votacion` / `cerrar_votacion` / `regresar_a_espera` para centralizar `estado_actual` en la tabla `asambleas`.
- Trigger `trigger_voto_actualizar_stats` para recalcular estadísticas al insertar votos.

Vistas y utilidades:
- `vista_estado_asamblea` — vista que combina estado centralizado, propuesta activa y métricas (votos, porcentaje, tiempo restante).

Notas operativas:
- El script habilita RLS (Row Level Security) y publica tablas para Realtime (Supabase).
- La migración es idempotente; revisar manualmente las líneas marcadas como nota antes de ejecutar si se aplica fuera de Supabase.

Siguientes acciones posibles:
- Aplicar la migración en la base de datos Supabase (requiere acceso del proyecto).
- Mapear estas columnas/funciones en el cliente (endpoints RPC o consultas) si quieres que la app use `iniciar_votacion`, `cerrar_votacion`, etc.
