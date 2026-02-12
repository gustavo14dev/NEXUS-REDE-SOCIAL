-- CORREÇÃO DO ERRO "Database error saving new user"
-- Execute isso ÚLTIMO no SQL Editor do Supabase

-- REMOVER TUDO RELACIONADO A PROFILES PARA LIMPAR
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON profiles;

-- DESABILITAR RLS TEMPORARIAMENTE PARA RECRIAR
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- CRIAR TRIGGER SIMPLIFICADO PARA CRIAR PERFIS AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, birth_date, is_monitored)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- CRIAR TRIGGER PARA EXECUTAR APÓS INSERÇÃO DE USUÁRIO
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REABILITAR RLS COM POLICIES CORRETAS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES PARA PERFIS
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
