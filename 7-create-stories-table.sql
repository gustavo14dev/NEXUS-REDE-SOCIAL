-- Criar tabela de stories
CREATE TABLE IF NOT EXISTS stories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    views_count INTEGER DEFAULT 0
);

-- Políticas RLS para stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver apenas seus próprios stories
CREATE POLICY "Users can view own stories" ON stories
    FOR SELECT USING (auth.uid() = user_id);

-- Usuário pode inserir apenas seus próprios stories
CREATE POLICY "Users can insert own stories" ON stories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuário pode atualizar apenas seus próprios stories
CREATE POLICY "Users can update own stories" ON stories
    FOR UPDATE USING (auth.uid() = user_id);

-- Usuário pode deletar apenas seus próprios stories
CREATE POLICY "Users can delete own stories" ON stories
    FOR DELETE USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);

-- Função para limpar stories expirados (opcional - pode ser chamado por um job)
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM stories WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
