-- DIAGNÓSTICO E CORREÇÃO DO ERRO "Database error saving new user"

-- Execute este SQL no Supabase para diagnosticar e corrigir o problema

-- 1. VERIFICAR SE HÁ TRIGGERS PROBLEMÁTICOS
SELECT
    event_object_schema,
    event_object_table,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('profiles', 'auth.users')
ORDER BY event_object_table, trigger_name;

-- 2. VERIFICAR POLICIES RLS QUE PODEM ESTAR BLOQUEANDO
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 3. VERIFICAR SE A TABELA PROFILES EXISTE E SUA ESTRUTURA
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. CRIAR OU CORRIGIR TRIGGER PARA CRIAR PERFIS AUTOMATICAMENTE
-- (Este trigger é executado quando um usuário se registra)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, avatar_url, birth_date, is_monitored)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', ''),
        NULL,
        CASE
            WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL
            THEN (NEW.raw_user_meta_data->>'birth_date')::DATE
            ELSE NULL
        END,
        CASE
            WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL
                 AND EXTRACT(YEAR FROM AGE((NEW.raw_user_meta_data->>'birth_date')::DATE)) < 13
            THEN TRUE
            ELSE FALSE
        END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 5. REMOVER TRIGGER ANTIGO SE EXISTIR
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 6. CRIAR TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. VERIFICAR E CORRIGIR POLICIES RLS PARA PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- REMOVER POLICIES ANTIGAS QUE PODEM ESTAR CONFLITANDO
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- CRIAR POLICIES CORRETAS
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 8. VERIFICAR SE HÁ ERROS NO LOG DO BANCO
-- Execute este query separadamente para ver erros recentes:
-- SELECT * FROM postgres_log
-- WHERE message LIKE '%error%'
-- ORDER BY log_time DESC
-- LIMIT 10;

-- 9. TESTAR SE O TRIGGER FUNCIONA
-- (Este código testa se conseguimos criar um perfil manualmente)
-- INSERT INTO profiles (id, nome) VALUES ('test-uuid', 'Test User');
-- DELETE FROM profiles WHERE nome = 'Test User';

-- 10. VERIFICAR SE O USUÁRIO PODE CRIAR PERFIS
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT ALL ON profiles TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
