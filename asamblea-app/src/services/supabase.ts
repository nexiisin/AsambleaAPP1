/**
 * Base de datos / Supabase client
 *
 * Referencia de esquema y migración:
 * - db/migrations/2025-12-unified-voting.sql
 * - docs/db_schema.md
 *
 * Nota: para ejecutar la migración necesitas acceso a la DB (p. ej. desde Supabase SQL editor).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
