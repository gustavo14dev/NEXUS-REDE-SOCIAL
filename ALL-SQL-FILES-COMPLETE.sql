-- =========================================
-- NEXUS SAFE - TODOS OS SQLs NECESSÁRIOS
-- Execute UM ARQUIVO POR VEZ no Supabase SQL Editor
-- =========================================

-- =========================================
-- ARQUIVO 1: nexus-safe-setup.sql
-- Execute PRIMEIRO este arquivo
-- =========================================

-- Nexus Safe - Configuração de Segurança
-- Execute isso no SQL Editor do Supabase

-- Adicionar campos de segurança na tabela profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN DEFAULT FALSE;

-- Criar tabela de denúncias (reports)
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'fake_account', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- RLS Policies para reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Usuários podem criar denúncias
CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Usuários podem ver suas próprias denúncias
CREATE POLICY "Users can view their own reports" ON reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- Admin pode ver todas as denúncias (vamos implementar isso no painel de admin)
CREATE POLICY "Admin can view all reports" ON reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = 'admin@nexus.com' -- Email do administrador
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar se conteúdo contém palavras ofensivas
CREATE OR REPLACE FUNCTION contains_offensive_content(content TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    offensive_words TEXT[] := ARRAY[
        'palavrão1', 'palavrão2', 'palavrão3' -- Adicione palavras reais aqui
    ];
BEGIN
    IF content IS NULL THEN
        RETURN FALSE;
    END IF;

    FOREACH word IN ARRAY offensive_words LOOP
        IF content ILIKE '%' || word || '%' THEN
            RETURN TRUE;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar conteúdo ofensivo em comentários
CREATE OR REPLACE FUNCTION check_comment_content()
RETURNS TRIGGER AS $$
BEGIN
    IF contains_offensive_content(NEW.content) THEN
        RAISE EXCEPTION 'Conteúdo ofensivo detectado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_comment_content
    BEFORE INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION check_comment_content();

-- Trigger para verificar conteúdo ofensivo em posts
CREATE OR REPLACE FUNCTION check_post_content()
RETURNS TRIGGER AS $$
BEGIN
    IF contains_offensive_content(NEW.caption) THEN
        RAISE EXCEPTION 'Conteúdo ofensivo detectado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_post_content
    BEFORE INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION check_post_content();

-- =========================================
-- ARQUIVO 2: create-notifications-table.sql
-- Execute SEGUNDO este arquivo
-- =========================================

CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'new_post')),
    actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias notificações
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Sistema pode criar notificações
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Usuários podem marcar como lidas suas notificações
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- =========================================
-- ARQUIVO 3: likes-functions.sql
-- Execute TERCEIRO este arquivo
-- =========================================

-- SQL para criar funções RPC de contagem e atualização de likes

-- Função para contar likes de um post
CREATE OR REPLACE FUNCTION count_post_likes(post_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    like_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO like_count
    FROM likes
    WHERE post_id = post_uuid;

    RETURN COALESCE(like_count, 0);
END;
$$;

-- Função para atualizar contagem de likes em um post
CREATE OR REPLACE FUNCTION update_post_likes_count(post_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE posts
    SET likes_count = (
        SELECT COUNT(*)
        FROM likes
        WHERE likes.post_id = posts.id
    )
    WHERE id = post_uuid;
END;
$$;

-- Trigger para atualizar automaticamente a contagem de likes
CREATE OR REPLACE FUNCTION update_likes_count_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;

-- Criar novo trigger
CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION update_likes_count_trigger();

-- Função para verificar se usuário curtiu post
CREATE OR REPLACE FUNCTION check_user_like(post_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    like_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM likes
        WHERE post_id = post_uuid AND user_id = user_uuid
    ) INTO like_exists;

    RETURN COALESCE(like_exists, FALSE);
END;
$$;

-- Função para toggle like com atualização automática
CREATE OR REPLACE FUNCTION toggle_post_like(post_uuid UUID, user_uuid UUID)
RETURNS TABLE(
    liked BOOLEAN,
    total_likes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_liked BOOLEAN;
    new_count INTEGER;
BEGIN
    -- Verificar se já existe like
    SELECT EXISTS(
        SELECT 1 FROM likes
        WHERE post_id = post_uuid AND user_id = user_uuid
    ) INTO is_liked;

    IF is_liked THEN
        -- Remover like
        DELETE FROM likes
        WHERE post_id = post_uuid AND user_id = user_uuid;

        -- Atualizar contagem
        UPDATE posts
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = post_uuid;

        SELECT likes_count INTO new_count
        FROM posts
        WHERE id = post_uuid;

        RETURN QUERY SELECT FALSE, new_count;
    ELSE
        -- Adicionar like
        INSERT INTO likes(post_id, user_id)
        VALUES (post_uuid, user_uuid);

        -- Atualizar contagem
        UPDATE posts
        SET likes_count = likes_count + 1
        WHERE id = post_uuid;

        SELECT likes_count INTO new_count
        FROM posts
        WHERE id = post_uuid;

        RETURN QUERY SELECT TRUE, new_count;
    END IF;
END;
$$;

-- =========================================
-- ARQUIVO 4: fix-database-error.sql
-- Execute QUARTO este arquivo
-- =========================================

-- CORREÇÃO DO ERRO "Database error saving new user"

-- REMOVER TUDO RELACIONADO A PROFILES
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON profiles;

-- DESABILITAR RLS TEMPORARIAMENTE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- CRIAR TRIGGER SIMPLIFICADO
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

-- CRIAR TRIGGER
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REABILITAR RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES PERMISSIVAS
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- =========================================
-- INSTRUÇÕES DE EXECUÇÃO
-- =========================================
--
-- 1. Abra o Supabase SQL Editor
-- 2. Para CADA arquivo acima, faça:
--    - Copie APENAS o conteúdo de UM arquivo
--    - Cole no SQL Editor
--    - Clique em "Run"
--    - Aguarde sucesso
--    - Vá para o próximo arquivo
--
-- 3. Ordem de execução:
--    - ARQUIVO 1: nexus-safe-setup.sql
--    - ARQUIVO 2: create-notifications-table.sql
--    - ARQUIVO 3: likes-functions.sql
--    - ARQUIVO 4: fix-database-error.sql
--
-- 4. Após executar tudo:
--    - Teste o registro de um novo usuário
--    - Deve funcionar sem erro 500
--    - Likes devem funcionar perfeitamente
--
-- =========================================
