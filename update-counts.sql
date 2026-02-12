-- Apenas atualizar os contadores (colunas já existem)
-- Execute isso no SQL Editor do Supabase

-- Atualizar contador de likes
UPDATE posts 
SET likes_count = (
    SELECT COUNT(*) 
    FROM likes 
    WHERE likes.post_id = posts.id
);

-- Atualizar contador de comentários  
UPDATE posts 
SET comments_count = (
    SELECT COUNT(*) 
    FROM comments 
    WHERE comments.post_id = posts.id
);

-- Verificar resultado
SELECT id, likes_count, comments_count FROM posts ORDER BY created_at DESC LIMIT 5;
