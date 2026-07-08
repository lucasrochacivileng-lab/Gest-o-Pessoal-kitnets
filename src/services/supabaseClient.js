import { createClient } from '@supabase/supabase-js';

// Projeto Supabase do Gestão Residencial Rocha.
// A chave "anon" é pública por design (vai no bundle do site de qualquer forma);
// a proteção real dos dados é feita pelo login + RLS no banco.
const DEFAULT_URL = 'https://ngtazecajkiescyxlqou.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGF6ZWNhamtpZXNjeXhscW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjExOTgsImV4cCI6MjA5OTAzNzE5OH0.oZvzIBD8jyut6EXYpbHtFUeBi8qmN7S2G6SVsCwrEro';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

// Defina VITE_SUPABASE_DISABLE=true para forçar o modo local (localStorage) em desenvolvimento.
// Em testes (vitest) o modo local é sempre usado.
export const isSupabaseEnabled = Boolean(url && anonKey)
  && import.meta.env.VITE_SUPABASE_DISABLE !== 'true'
  && import.meta.env.MODE !== 'test';

export const supabase = isSupabaseEnabled ? createClient(url, anonKey) : null;
