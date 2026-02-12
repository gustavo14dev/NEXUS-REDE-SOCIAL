-- Fix para atualizar contadores de likes e comentários nos posts
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

-- Verificar se as colunas existem (se não, execute primeiro)
-- ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0;
-- ALTER TABLE posts ADD COLUMN comments_count INTEGER DEFAULT 0;
