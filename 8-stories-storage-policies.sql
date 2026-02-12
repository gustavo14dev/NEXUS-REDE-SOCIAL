-- Criar políticas RLS para o bucket stories no Supabase Storage

-- Remover políticas existentes se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público aos stories" ON storage.objects;

-- Política para permitir uploads de usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários vejam seus próprios arquivos
CREATE POLICY "Usuários podem ver seus próprios stories" ON storage.objects
FOR SELECT USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários atualizem seus próprios arquivos
CREATE POLICY "Usuários podem atualizar seus próprios stories" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários deletem seus próprios arquivos
CREATE POLICY "Usuários podem deletar seus próprios stories" ON storage.objects
FOR DELETE USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir acesso público aos arquivos (para visualização)
CREATE POLICY "Acesso público aos stories" ON storage.objects
FOR SELECT USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated'
);
