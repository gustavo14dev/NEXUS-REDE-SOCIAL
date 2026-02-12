-- Criar tabela de notificações para o Nexus
-- Execute isso no SQL Editor do Supabase

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
CREATE INDEX idx_notifications_unread ON notifications(user_id, read);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias notificações
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem marcar suas notificações como lidas
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Sistema pode criar notificações
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Função para criar notificação de like
CREATE OR REPLACE FUNCTION create_like_notification(
    p_user_id UUID,
    p_actor_id UUID,
    p_post_id UUID
)
RETURNS void AS $$
BEGIN
    -- Não criar notificação se o usuário curtir seu próprio post
    IF p_user_id != p_actor_id THEN
        INSERT INTO notifications (user_id, type, actor_id, post_id, content)
        VALUES (
            p_user_id,
            'like',
            p_actor_id,
            p_post_id,
            'curtiu seu post'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para criar notificação de comentário
CREATE OR REPLACE FUNCTION create_comment_notification(
    p_user_id UUID,
    p_actor_id UUID,
    p_post_id UUID,
    p_comment_content TEXT
)
RETURNS void AS $$
BEGIN
    -- Não criar notificação se o usuário comentar em seu próprio post
    IF p_user_id != p_actor_id THEN
        INSERT INTO notifications (user_id, type, actor_id, post_id, content)
        VALUES (
            p_user_id,
            'comment',
            p_actor_id,
            p_post_id,
            'comentou: ' || LEFT(p_comment_content, 50) || CASE WHEN LENGTH(p_comment_content) > 50 THEN '...' ELSE '' END
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificação de like
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER AS $$
BEGIN
    -- Obter o dono do post
    DECLARE
        post_owner_id UUID;
    BEGIN
        SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
        
        -- Criar notificação
        PERFORM create_like_notification(post_owner_id, NEW.user_id, NEW.post_id);
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_like_notification
    AFTER INSERT ON likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_like();

-- Trigger para notificação de comentário
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
    -- Obter o dono do post
    DECLARE
        post_owner_id UUID;
    BEGIN
        SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
        
        -- Criar notificação
        PERFORM create_comment_notification(post_owner_id, NEW.user_id, NEW.post_id, NEW.content);
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_notification
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_comment();
