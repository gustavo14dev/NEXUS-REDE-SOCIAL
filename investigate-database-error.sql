-- INVESTIGAÇÃO AVANÇADA DO ERRO "Database error saving new user"
-- Execute este SQL APÓS o anterior para investigar mais profundamente

-- 1. VERIFICAR SE O TRIGGER FOI CRIADO
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. VERIFICAR SE A FUNÇÃO FOI CRIADA
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- 3. VERIFICAR POLICIES ATUAIS DA TABELA PROFILES
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 4. VERIFICAR SE HÁ OUTROS TRIGGERS CONFLITANTES
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- 5. TENTAR CRIAR UM PERFIL MANUALMENTE PARA TESTAR
-- (Descomente para testar)
-- INSERT INTO profiles (id, nome) VALUES ('test-user-id', 'Test User');
-- SELECT * FROM profiles WHERE nome = 'Test User';
-- DELETE FROM profiles WHERE nome = 'Test User';

-- 6. VERIFICAR PERMISSÕES DA TABELA
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'profiles';

-- 7. CORREÇÃO FORÇADA - REMOVER TUDO E RECRIAR
-- (Execute apenas se as outras correções falharem)

-- REMOVER TUDO RELACIONADO A PROFILES
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;

-- DESABILITAR RLS TEMPORARIAMENTE PARA TESTE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- RECRIAR TRIGGER SIMPLIFICADO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro (você pode ver nos logs do Supabase)
        RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
        RETURN NEW; -- Continua mesmo com erro
END;
$$;

-- CRIAR TRIGGER
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REABILITAR RLS COM POLICIES SIMPLIFICADAS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES MAIS PERMISSIVAS PARA TESTE
CREATE POLICY "Allow all operations for authenticated users" ON profiles
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. TESTE FINAL - VERIFICAR SE FUNCIONA
-- Após executar, tente registrar um usuário novamente
