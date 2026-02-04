-- 039_add_tipo_matriz_id_to_genealogias.sql
-- Adiciona coluna tipo_matriz_id na tabela genealogias_online

-- Adicionar coluna tipo_matriz_id (FK para tipos_animal_online)
ALTER TABLE public.genealogias_online
ADD COLUMN IF NOT EXISTS tipo_matriz_id INTEGER REFERENCES public.tipos_animal_online(id);

-- Comentário para documentação
COMMENT ON COLUMN public.genealogias_online.tipo_matriz_id IS 'Tipo da matriz/mãe no momento do nascimento (FK para tipos_animal_online)';
