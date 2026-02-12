-- LIMPEZA TOTAL E RECRIAÇÃO COMPLETA
-- Execute este SQL PRIMEIRO para limpar tudo e depois execute os outros

-- REMOVER TUDO PARA RECOMEÇAR DO ZERO
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
DROP TRIGGER IF EXISTS trigger_check_comment_content ON comments;
DROP TRIGGER IF EXISTS trigger_check_post_content ON posts;
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS contains_offensive_content();
DROP FUNCTION IF EXISTS check_comment_content();
DROP FUNCTION IF EXISTS check_post_content();
DROP FUNCTION IF EXISTS update_likes_count_trigger();
DROP FUNCTION IF EXISTS count_post_likes(UUID);
DROP FUNCTION IF EXISTS update_post_likes_count(UUID);
DROP FUNCTION IF EXISTS check_user_like(UUID, UUID);
DROP FUNCTION IF EXISTS toggle_post_like(UUID, UUID);

-- REMOVER POLICIES
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Admin can view all reports" ON reports;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- REMOVER TABELAS SE EXISTIREM
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- LIMPAR CAMPOS DE profiles
-- ALTER TABLE profiles DROP COLUMN IF EXISTS birth_date;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS is_monitored;
