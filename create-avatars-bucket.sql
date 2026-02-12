-- Criar bucket 'avatars' no Supabase Storage
INSERT INTO storage.buckets (id, name, created_at, updated_at, public, file_size_limit, allowed_mime_types) 
VALUES (
    'avatars', 
    'avatars', 
    NOW(), 
    NOW(), 
    true, 
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
) 
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes (se houver)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Criar políticas de acesso simplificadas para o bucket avatars
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update avatars" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Allow public access to avatars" ON storage.objects
FOR SELECT USING (
    bucket_id = 'avatars'
);
