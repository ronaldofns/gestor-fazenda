# Script para Atualizar Brincos Vazios no Supabase

Este documento descreve como usar o script SQL para atualizar brincos vazios na tabela `animais_online`.

## 📋 Pré-requisitos

- Acesso ao Supabase SQL Editor
- Permissões para executar UPDATE na tabela `animais_online`

## 🚀 Como Usar

### Passo 1: Verificar Registros Afetados

Antes de executar o UPDATE, execute o primeiro SELECT do script para ver quantos registros serão afetados:

```sql
SELECT 
  id,
  uuid,
  brinco,
  nome,
  data_cadastro,
  created_at,
  'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS') as novo_brinco
FROM public.animais_online
WHERE deleted_at IS NULL
  AND (
    brinco IS NULL 
    OR TRIM(brinco) = '' 
    OR LENGTH(TRIM(brinco)) = 0
  )
ORDER BY created_at;
```

**Revise os resultados antes de prosseguir!**

### Passo 2: Executar o UPDATE

Após revisar os resultados, execute o UPDATE:

```sql
UPDATE public.animais_online
SET 
  brinco = 'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS'),
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND (
    brinco IS NULL 
    OR TRIM(brinco) = '' 
    OR LENGTH(TRIM(brinco)) = 0
  );
```

### Passo 3: Verificar Duplicatas

Execute este SELECT para verificar se há brincos temporários duplicados:

```sql
SELECT 
  brinco,
  COUNT(*) as quantidade,
  ARRAY_AGG(id ORDER BY id) as ids_afetados
FROM public.animais_online
WHERE deleted_at IS NULL
  AND brinco LIKE 'TEMP-%'
GROUP BY brinco
HAVING COUNT(*) > 1;
```

### Passo 4: Corrigir Duplicatas (se necessário)

Se houver duplicatas (animais criados no mesmo segundo), execute o bloco DO para corrigir:

```sql
DO $$
DECLARE
  rec RECORD;
  counter INTEGER;
BEGIN
  FOR rec IN 
    SELECT brinco, ARRAY_AGG(id ORDER BY id) as ids_array
    FROM public.animais_online
    WHERE deleted_at IS NULL
      AND brinco LIKE 'TEMP-%'
    GROUP BY brinco
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR i IN 2..array_length(rec.ids_array, 1) LOOP
      UPDATE public.animais_online
      SET 
        brinco = rec.brinco || '-' || counter,
        updated_at = NOW()
      WHERE id = rec.ids_array[i];
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;
```

### Passo 5: Verificação Final

Execute este SELECT para ver o resumo final:

```sql
SELECT 
  COUNT(*) FILTER (WHERE brinco LIKE 'TEMP-%') as brincos_temporarios,
  COUNT(*) FILTER (WHERE brinco IS NULL OR TRIM(brinco) = '') as brincos_vazios,
  COUNT(*) as total_animais_ativos
FROM public.animais_online
WHERE deleted_at IS NULL;
```

## 📝 Formato do Brinco Temporário

O brinco temporário segue o formato:
```
TEMP-YYYYMMDD-HHMMSS
```

Exemplo: `TEMP-20250128-143025`

Onde:
- `YYYYMMDD` = Data de criação (ano, mês, dia)
- `HHMMSS` = Hora de criação (hora, minuto, segundo)

## ⚠️ Importante

1. **Sempre execute o SELECT primeiro** para revisar os dados antes do UPDATE
2. **Faça backup** da tabela antes de executar o UPDATE (se possível)
3. O script **não afeta animais deletados** (`deleted_at IS NULL`)
4. Se houver animais criados no mesmo segundo, o script de correção de duplicatas adiciona um sufixo (`-1`, `-2`, etc.)

## 🔄 Após a Execução

Após atualizar os brincos temporários no Supabase, você pode:

1. Sincronizar os dados para o aplicativo local
2. Editar os animais manualmente para atualizar com os brincos reais
3. Usar o checkbox "Pendente de brincagem" no modal de edição para identificar animais que ainda precisam de brinco real
