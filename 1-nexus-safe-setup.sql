-- Nexus Safe - Configuração de Segurança
-- Execute isso PRIMEIRO no SQL Editor do Supabase

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

-- Função para verificar se conteúdo contém palavras ofensivas (CORRIGIDA)
CREATE OR REPLACE FUNCTION contains_offensive_content(content TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    offensive_words TEXT[] := ARRAY['palavrão1', 'palavrão2', 'palavrão3'];
    word TEXT;
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
