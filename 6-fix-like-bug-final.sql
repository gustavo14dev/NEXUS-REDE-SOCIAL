-- CORREÇÃO DEFINITIVA DO BUG DE LIKES
-- Execute isso para corrigir a contagem de uma vez por todas

-- Remover TUDO relacionado a likes para começar do zero
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;
DROP FUNCTION IF EXISTS toggle_post_like(UUID, UUID);
DROP FUNCTION IF EXISTS update_likes_count_trigger();
DROP FUNCTION IF EXISTS count_post_likes(UUID);
DROP FUNCTION IF EXISTS update_post_likes_count(UUID);

-- Função simples e correta para toggle de likes
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
    current_count INTEGER;
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
        
        -- Retornar FALSE com contagem atualizada
        SELECT COUNT(*) INTO current_count
        FROM likes
        WHERE post_id = post_uuid;
        
        RETURN QUERY SELECT FALSE, current_count;
    ELSE
        -- Adicionar like
        INSERT INTO likes(post_id, user_id)
        VALUES (post_uuid, user_uuid);
        
        -- Retornar TRUE com contagem atualizada
        SELECT COUNT(*) INTO current_count
        FROM likes
        WHERE post_id = post_uuid;
        
        RETURN QUERY SELECT TRUE, current_count;
    END IF;
END;
$$;

-- Remover completamente a coluna likes_count da tabela posts para evitar conflitos
-- Vamos calcular dinamicamente sempre
ALTER TABLE posts DROP COLUMN IF EXISTS likes_count;
