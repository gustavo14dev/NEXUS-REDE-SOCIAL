// Configuração central do Supabase
const SUPABASE_URL = 'https://gyjpzcidcrchcabmyntm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tupmfS1YbbY18iz2Oo4Ayg_v3nbCcxF';

// Inicialização global do Supabase - usar nome diferente
let supabaseClient;
try {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase inicializado com sucesso');
    } else {
        console.warn('Supabase CDN não carregado');
    }
} catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
}

// Exportar para uso global
window.supabaseClient = supabaseClient;
