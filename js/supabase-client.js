// ==========================================
// CONEXÃO CENTRALIZADA COM O SUPABASE
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://rqpvyrmnuicxzhmzlhec.supabase.co'; // <-- Cole sua URL real
export const SUPABASE_ANON_KEY = 'sb_publishable_vIA61NRoeg2QU5jwxczBpQ_egpvK09R'; // <-- Cole sua chave real

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);