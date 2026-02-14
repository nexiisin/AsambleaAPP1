#!/usr/bin/env node
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function asInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'si', 'sí'].includes(normalized);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

class Metrics {
  constructor() {
    this.ops = new Map();
    this.failures = [];
    this.startTime = Date.now();
  }

  record(name, durationMs, ok, detail) {
    if (!this.ops.has(name)) {
      this.ops.set(name, { durations: [], ok: 0, failed: 0 });
    }
    const bucket = this.ops.get(name);
    bucket.durations.push(durationMs);
    if (ok) {
      bucket.ok += 1;
    } else {
      bucket.failed += 1;
      this.failures.push({ name, detail });
    }
  }

  summary() {
    const operations = {};
    let totalOk = 0;
    let totalFailed = 0;

    for (const [name, bucket] of this.ops.entries()) {
      const count = bucket.durations.length;
      const avg = count
        ? bucket.durations.reduce((acc, ms) => acc + ms, 0) / count
        : 0;

      operations[name] = {
        count,
        ok: bucket.ok,
        failed: bucket.failed,
        avgMs: Number(avg.toFixed(2)),
        p50Ms: Number(percentile(bucket.durations, 50).toFixed(2)),
        p95Ms: Number(percentile(bucket.durations, 95).toFixed(2)),
        maxMs: Number((Math.max(...bucket.durations, 0)).toFixed(2)),
      };

      totalOk += bucket.ok;
      totalFailed += bucket.failed;
    }

    const total = totalOk + totalFailed;
    return {
      startedAt: new Date(this.startTime).toISOString(),
      endedAt: new Date().toISOString(),
      totalOperations: total,
      totalOk,
      totalFailed,
      successRate: total ? Number(((totalOk / total) * 100).toFixed(2)) : 0,
      operations,
      failures: this.failures.slice(0, 50),
    };
  }
}

async function timed(metrics, opName, fn) {
  const started = performance.now();
  try {
    const result = await fn();
    metrics.record(opName, performance.now() - started, true);
    return result;
  } catch (error) {
    metrics.record(opName, performance.now() - started, false, error?.message || String(error));
    throw error;
  }
}

function logStage(title) {
  console.log(`\n========== ${title} ==========`);
}

function generarCodigoAsamblea() {
  return `ST${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function withRamp(items, rampSeconds, task) {
  const total = items.length;
  const rampMs = Math.max(0, rampSeconds) * 1000;
  const slotMs = total > 0 ? rampMs / total : 0;

  return Promise.all(
    items.map((item, index) =>
      (async () => {
        if (slotMs > 0) {
          await sleep(Math.round(index * slotMs));
        }
        return task(item, index);
      })()
    )
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`
Uso:
  npm run stress:web -- --asamblea-id <UUID> [opciones]
  npm run stress:web -- --codigo <CODIGO_ASAMBLEA> [opciones]
  npm run stress:web -- [opciones]   # crea asamblea automática

Opciones:
  --users <n>            Usuarios concurrentes (default: 164)
  --ramp-seconds <n>     Rampa de entrada en segundos (default: 15)
  --cleanup <bool>       Elimina propuesta y datos de prueba creados (default: false)
  --report-name <name>   Nombre del JSON de reporte (default: stress-report-<timestamp>.json)
  --vote-ratio-si <n>    Ratio de voto SI 0-100 (default: 55)

Variables de entorno:
  EXPO_PUBLIC_SUPABASE_URL o SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY o EXPO_PUBLIC_SUPABASE_ANON_KEY
`);
    process.exit(0);
  }

  const users = asInt(args.users ?? process.env.STRESS_USERS, 164);
  const rampSeconds = asInt(args['ramp-seconds'] ?? process.env.STRESS_RAMP_SECONDS, 15);
  const cleanup = asBool(args.cleanup ?? process.env.STRESS_CLEANUP, false);
  const voteRatioSi = asInt(args['vote-ratio-si'] ?? process.env.STRESS_VOTE_RATIO_SI, 55);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan variables: EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY/EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const metrics = new Metrics();
  const runId = `STRESS-${new Date().toISOString().replace(/[.:]/g, '-')}`;
  const stressNamePrefix = `${runId}-USR`;

  console.log('Configuración de prueba:');
  console.log(`- Run ID: ${runId}`);
  console.log(`- Usuarios concurrentes: ${users}`);
  console.log(`- Rampa: ${rampSeconds}s`);
  console.log(`- Cleanup: ${cleanup}`);

  let asambleaId = args['asamblea-id'] || process.env.STRESS_ASAMBLEA_ID || null;
  const codigo = args.codigo || process.env.STRESS_ASAMBLEA_CODIGO || null;
  let asambleaAutoCreada = false;
  let asambleaCodigoUsado = codigo || null;

  logStage('1) Resolver asamblea y viviendas objetivo');

  if (!asambleaId && !codigo) {
    const codigoNuevo = generarCodigoAsamblea();
    const horaInicio = new Date();
    const horaCierre = new Date(horaInicio.getTime() + 60 * 60 * 1000);

    const creada = await timed(metrics, 'admin.crearAsamblea', async () => {
      const { data, error } = await supabase
        .from('asambleas')
        .insert({
          codigo_acceso: codigoNuevo,
          estado: 'ABIERTA',
          hora_inicio: horaInicio.toISOString(),
          hora_cierre_ingreso: horaCierre.toISOString(),
        })
        .select('id, codigo_acceso')
        .single();

      if (error || !data) {
        throw new Error(`No se pudo crear asamblea automáticamente: ${error?.message || 'sin datos'}`);
      }

      return data;
    });

    asambleaId = creada.id;
    asambleaCodigoUsado = creada.codigo_acceso;
    asambleaAutoCreada = true;
    console.log(`Asamblea creada automáticamente: ${asambleaId} (código: ${asambleaCodigoUsado})`);
  }

  if (!asambleaId && codigo) {
    const asamblea = await timed(metrics, 'asamblea.resolveByCode', async () => {
      const { data, error } = await supabase
        .from('asambleas')
        .select('id, estado')
        .eq('codigo_acceso', codigo)
        .single();

      if (error || !data) {
        throw new Error(`No se encontró asamblea por código ${codigo}: ${error?.message || 'sin datos'}`);
      }

      return data;
    });

    asambleaId = asamblea.id;
  }

  const { data: viviendas, error: viviendasError } = await timed(metrics, 'viviendas.fetch', async () =>
    supabase
      .from('viviendas')
      .select('id, numero_casa')
      .order('numero_casa', { ascending: true })
      .limit(users)
  );

  if (viviendasError) {
    throw new Error(`No se pudieron cargar viviendas: ${viviendasError.message}`);
  }

  if (!viviendas || viviendas.length < users) {
    if (asambleaAutoCreada && asambleaId) {
      await timed(metrics, 'cleanup.asambleaAutoCreadaInsuficiente', async () => {
        const { error } = await supabase
          .from('asambleas')
          .delete()
          .eq('id', asambleaId);
        if (error) throw new Error(error.message);
      });
    }
    throw new Error(`No hay suficientes viviendas para simular ${users} usuarios. Disponibles: ${viviendas?.length || 0}`);
  }

  const hogares = viviendas.slice(0, users);

  logStage('2) Registro concurrente de asistencia (simula ingreso web)');

  const asistencias = await withRamp(hogares, rampSeconds, async (vivienda, idx) => {
    const userName = `${stressNamePrefix}-${String(idx + 1).padStart(3, '0')}`;

    await timed(metrics, 'residente.validarAsamblea', async () => {
      const { data, error } = await supabase
        .from('asambleas')
        .select('id, estado, hora_cierre_ingreso')
        .eq('id', asambleaId)
        .single();

      if (error || !data) throw new Error(error?.message || 'Asamblea inválida');
      if (data.estado !== 'ABIERTA') throw new Error(`Asamblea no abierta: ${data.estado}`);
      return data;
    });

    const { data, error } = await timed(metrics, 'residente.insertAsistencia', async () =>
      supabase
        .from('asistencias')
        .insert({
          asamblea_id: asambleaId,
          vivienda_id: vivienda.id,
          nombre_asistente: userName,
          es_apoderado: false,
          casa_representada: null,
          estado_apoderado: null,
        })
        .select('id, vivienda_id')
        .single()
    );

    if (!error && data) {
      return { asistenciaId: data.id, viviendaId: data.vivienda_id, inserted: true };
    }

    const duplicateLike = /duplicate|already exists|unique|violates/i.test(error?.message || '');
    if (!duplicateLike) {
      throw new Error(error?.message || 'Error insertando asistencia');
    }

    const existing = await timed(metrics, 'residente.selectAsistenciaExistente', async () => {
      const { data: existingRows, error: existingError } = await supabase
        .from('asistencias')
        .select('id, vivienda_id')
        .eq('asamblea_id', asambleaId)
        .eq('vivienda_id', vivienda.id)
        .limit(1);

      if (existingError || !existingRows?.length) {
        throw new Error(existingError?.message || 'No se encontró asistencia existente');
      }

      return existingRows[0];
    });

    return { asistenciaId: existing.id, viviendaId: existing.vivienda_id, inserted: false };
  });

  const insertedAsistenciaIds = asistencias.filter((x) => x.inserted).map((x) => x.asistenciaId);

  logStage('3) Simulación de sala de espera (lecturas concurrentes)');

  await withRamp(asistencias, Math.max(2, Math.floor(rampSeconds / 2)), async (item) => {
    await timed(metrics, 'residente.salaEspera.asamblea', async () => {
      const { error } = await supabase
        .from('asambleas')
        .select('id, propuesta_activa_id, propuesta_resultados_id, estado_actual, hora_cierre_ingreso')
        .eq('id', asambleaId)
        .single();

      if (error) throw new Error(error.message);
    });

    await timed(metrics, 'residente.salaEspera.asistencia', async () => {
      const { error } = await supabase
        .from('asistencias')
        .select('id, vivienda_id, es_apoderado, estado_apoderado, casa_representada')
        .eq('id', item.asistenciaId)
        .single();

      if (error) throw new Error(error.message);
    });
  });

  logStage('4) Admin crea propuesta e inicia votación');

  const propuesta = await timed(metrics, 'admin.crearPropuesta', async () => {
    const { data: last } = await supabase
      .from('propuestas')
      .select('orden')
      .eq('asamblea_id', asambleaId)
      .order('orden', { ascending: false })
      .limit(1)
      .single();

    const orden = (last?.orden ?? 0) + 1;
    const title = `${runId} - Propuesta Prueba 164 usuarios`;
    const { data, error } = await supabase
      .from('propuestas')
      .insert({
        asamblea_id: asambleaId,
        titulo: title,
        descripcion: 'Propuesta de stress test automático',
        estado: 'BORRADOR',
        orden,
      })
      .select('id, titulo')
      .single();

    if (error || !data) throw new Error(error?.message || 'No se pudo crear propuesta');
    return data;
  });

  await timed(metrics, 'admin.iniciarVotacion', async () => {
    const { error } = await supabase.rpc('iniciar_votacion', {
      p_asamblea_id: asambleaId,
      p_propuesta_id: propuesta.id,
    });

    if (error) throw new Error(error.message);
  });

  logStage('5) 164 usuarios votan en simultáneo');

  await withRamp(asistencias, rampSeconds, async (item, idx) => {
    await timed(metrics, 'residente.votacion.cargarPropuestaActiva', async () => {
      const { error } = await supabase
        .from('propuestas')
        .select('id, estado, titulo')
        .eq('asamblea_id', asambleaId)
        .eq('estado', 'ABIERTA')
        .order('fecha_apertura', { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);
    });

    const voto = idx % 100 < voteRatioSi ? 'SI' : 'NO';

    await timed(metrics, 'residente.votacion.registrarVotoRPC', async () => {
      const { data, error } = await supabase.rpc('registrar_voto', {
        p_propuesta_id: propuesta.id,
        p_vivienda_id: item.viviendaId,
        p_asistencia_id: item.asistenciaId,
        p_tipo_voto: voto,
        p_casa_representada_id: null,
      });

      if (error) throw new Error(error.message);
      if (data && data.success === false) throw new Error(data.error || 'RPC registrar_voto devolvió success=false');
    });
  });

  logStage('6) Admin cierra votación y publica resultados');

  await timed(metrics, 'admin.cerrarVotacion', async () => {
    const { error } = await supabase.rpc('cerrar_votacion', {
      p_asamblea_id: asambleaId,
    });

    if (error) throw new Error(error.message);
  });

  await timed(metrics, 'admin.mostrarResultados', async () => {
    const { error } = await supabase.rpc('mostrar_resultados', {
      p_asamblea_id: asambleaId,
      p_propuesta_id: propuesta.id,
    });

    if (error) throw new Error(error.message);
  });

  logStage('7) 164 usuarios consultan resultados');

  await withRamp(asistencias, Math.max(2, Math.floor(rampSeconds / 2)), async () => {
    await timed(metrics, 'residente.resultados.propuesta', async () => {
      const { error } = await supabase
        .from('propuestas')
        .select('id, estado, titulo')
        .eq('id', propuesta.id)
        .single();

      if (error) throw new Error(error.message);
    });

    await timed(metrics, 'residente.resultados.statsRPC', async () => {
      const { error } = await supabase.rpc('obtener_estadisticas_propuesta', {
        p_propuesta_id: propuesta.id,
      });

      if (error) throw new Error(error.message);
    });
  });

  logStage('8) Simulación de salida/cierre por asistentes');

  await withRamp(asistencias, rampSeconds, async (item) => {
    await timed(metrics, 'residente.salida.updateAsistencia', async () => {
      const { error } = await supabase
        .from('asistencias')
        .update({
          formulario_cierre_completado: true,
          salida_autorizada: true,
          hora_salida: new Date().toISOString(),
        })
        .eq('id', item.asistenciaId);

      if (error) throw new Error(error.message);
    });
  });

  if (cleanup) {
    logStage('9) Cleanup de datos de prueba');

    await timed(metrics, 'cleanup.votos', async () => {
      const { error } = await supabase
        .from('votos')
        .delete()
        .eq('propuesta_id', propuesta.id);
      if (error) throw new Error(error.message);
    });

    if (insertedAsistenciaIds.length) {
      await timed(metrics, 'cleanup.asistencias', async () => {
        const { error } = await supabase
          .from('asistencias')
          .delete()
          .in('id', insertedAsistenciaIds);
        if (error) throw new Error(error.message);
      });
    }

    await timed(metrics, 'cleanup.propuesta', async () => {
      const { error } = await supabase
        .from('propuestas')
        .delete()
        .eq('id', propuesta.id);
      if (error) throw new Error(error.message);
    });
  }

  const summary = metrics.summary();

  const reportDir = join(process.cwd(), 'reports');
  await mkdir(reportDir, { recursive: true });

  const reportName =
    args['report-name'] ||
    process.env.STRESS_REPORT_NAME ||
    `stress-report-${new Date().toISOString().replace(/[.:]/g, '-')}.json`;

  const reportPath = join(reportDir, reportName);
  const reportPayload = {
    runId,
    config: {
      users,
      rampSeconds,
      cleanup,
      voteRatioSi,
      asambleaId,
      codigo: asambleaCodigoUsado,
      asambleaAutoCreada,
    },
    summary,
  };

  await writeFile(reportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');

  const votarStats = summary.operations['residente.votacion.registrarVotoRPC'];
  const asistenciaStats = summary.operations['residente.insertAsistencia'];

  console.log('\n========== RESUMEN ==========' );
  console.log(`Operaciones totales: ${summary.totalOperations}`);
  console.log(`Tasa de éxito global: ${summary.successRate}%`);
  if (asistenciaStats) {
    console.log(
      `Asistencia p95: ${asistenciaStats.p95Ms}ms | avg: ${asistenciaStats.avgMs}ms | fallos: ${asistenciaStats.failed}`
    );
  }
  if (votarStats) {
    console.log(
      `Voto RPC p95: ${votarStats.p95Ms}ms | avg: ${votarStats.avgMs}ms | fallos: ${votarStats.failed}`
    );
  }
  console.log(`Reporte guardado en: ${reportPath}`);

  if (summary.totalFailed > 0) {
    console.log('\nPrimeros fallos detectados:');
    summary.failures.slice(0, 10).forEach((failure, idx) => {
      console.log(`${idx + 1}. [${failure.name}] ${failure.detail}`);
    });
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('\n❌ La prueba de estrés falló.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
