-- CORREÇÃO DO BUG DE CONTAGEM DUPLICADA DE LIKES
-- Execute isso para corrigir o problema de contar 2x

-- Remover trigger que causa duplicação
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;

-- Manter apenas a função toggle_post_like que já atualiza corretamente
-- A função toggle_post_like já atualiza a contagem sozinha
-- Não precisamos do trigger adicional que estava causando a duplicação

-- Verificar se a função toggle_post_like está correta
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

        -- Atualizar contagem (recalcular do zero)
        UPDATE posts
        SET likes_count = (
            SELECT COUNT(*)
            FROM likes
            WHERE likes.post_id = posts.id
        )
        WHERE id = post_uuid;

        SELECT likes_count INTO new_count
        FROM posts
        WHERE id = post_uuid;

        RETURN QUERY SELECT FALSE, new_count;
    ELSE
        -- Adicionar like
        INSERT INTO likes(post_id, user_id)
        VALUES (post_uuid, user_uuid);

        -- Atualizar contagem (recalcular do zero)
        UPDATE posts
        SET likes_count = (
            SELECT COUNT(*)
            FROM likes
            WHERE likes.post_id = posts.id
        )
        WHERE id = post_uuid;

        SELECT likes_count INTO new_count
        FROM posts
        WHERE id = post_uuid;

        RETURN QUERY SELECT TRUE, new_count;
    END IF;
END;
$$;
