-- Política RLS simplificada para bucket stories

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios stories" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público aos stories" ON storage.objects;

-- Política simples: qualquer usuário autenticado pode acessar o bucket stories
CREATE POLICY "Stories upload policy" ON storage.objects
FOR ALL USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated'
);

-- Alternativa: política específica para INSERT
CREATE POLICY "Stories insert policy" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated'
);

-- Política para SELECT (visualização)
CREATE POLICY "Stories select policy" ON storage.objects
FOR SELECT USING (
    bucket_id = 'stories' AND 
    auth.role() = 'authenticated'
);
