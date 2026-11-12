import { createClient } from '@supabase/supabase-js';
import { config, diagnosticoConfig } from './config.js';

export const diagnostico = diagnosticoConfig();

/** Cliente único (chave anon). null quando a configuração está pendente ou insegura. */
export const supabase = diagnostico.ok
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: 'pkce',            // link de recuperação usa ?code=, sem conflitar com o roteador por hash
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
