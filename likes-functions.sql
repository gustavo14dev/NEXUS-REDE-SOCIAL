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
