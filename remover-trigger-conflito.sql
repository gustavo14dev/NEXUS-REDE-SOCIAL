-- SQL para remover APENAS o trigger conflitante (mantém as funções)

-- Remover apenas o trigger que causa conflito
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;

-- Remover a função do trigger (não as outras)
DROP FUNCTION IF EXISTS update_likes_count_trigger();

-- Verificar se removeu corretamente
SELECT 'Trigger removido com sucesso!' as status;
