# Estrutura do Projeto - Gestor Fazenda

## 📁 Estrutura de Diretórios

### `/src` - Código Fonte Principal
```
src/
├── api/                    # Serviços de API e sincronização
│   ├── supabaseClient.ts  # Cliente Supabase
│   └── syncService.ts     # Sincronização IndexedDB ↔ Supabase
│
├── components/            # Componentes React reutilizáveis
│   ├── ArvoreGenealogica.tsx
│   ├── Combobox.tsx
│   ├── ConfirmDialog.tsx
│   ├── FazendaModal.tsx
│   ├── HistoricoAlteracoes.tsx
│   ├── (IconButton.tsx foi removido - não estava sendo utilizado)
│   ├── InstallPrompt.tsx
│   ├── MatrizModal.tsx
│   ├── Modal.tsx
│   ├── ModalCategoria.tsx
│   ├── ModalRaca.tsx
│   ├── NascimentoModal.tsx
│   ├── OfflineIndicator.tsx
│   ├── ProtectedRoute.tsx
│   ├── PWAUpdatePrompt.tsx
│   ├── Sidebar.tsx
│   ├── SplashScreen.tsx
│   ├── SyncStatus.tsx      ✅ Utilizado em Sidebar.tsx
│   ├── Toast.tsx
│   ├── TopBar.tsx
│   └── UsuarioModal.tsx
│
├── db/                    # Banco de dados local (IndexedDB/Dexie)
│   ├── dexieDB.ts        # Configuração do Dexie
│   ├── migration.ts      # Migrações de dados
│   └── models.ts         # Interfaces TypeScript
│
├── hooks/                 # React Hooks customizados
│   ├── useAlertSettings.ts
│   ├── useAppSettings.ts
│   ├── useAuth.tsx
│   ├── useConfirmDialog.tsx
│   ├── useFavoritos.ts
│   ├── useInactivityTimeout.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useNotifications.ts
│   ├── useOnline.ts
│   ├── usePermissions.ts
│   ├── useSync.ts
│   └── useThemeColors.ts
│
├── routes/                # Páginas/Rotas da aplicação
│   ├── CadastroDesmama.tsx
│   ├── Dashboard.tsx
│   ├── Home.tsx
│   ├── ImportarPlanilha.tsx
│   ├── ListaFazendas.tsx
│   ├── ListaUsuarios.tsx
│   ├── Login.tsx
│   ├── Matrizes.tsx
│   ├── Notificacoes.tsx
│   ├── Perfil.tsx
│   ├── Permissoes.tsx
│   └── SetupInicial.tsx
│
└── utils/                 # Utilitários e helpers
    ├── atualizarDataNascimento.ts  ⚠️ NÃO UTILIZADO - pode ser removido
    ├── audit.ts
    ├── auth.ts
    ├── cleanDuplicates.ts
    ├── criarMatrizAutomatica.ts
    ├── exportarDados.ts
    ├── gerarRelatorioPDF.ts
    ├── iconMapping.ts
    ├── importPlanilha.ts
    ├── notificacoesLidas.ts
    ├── theme.ts
    ├── themeHelpers.ts
    ├── toast.ts
    ├── uuid.ts
    └── version.ts          ✅ Utilizado em Sidebar.tsx
```

### `/supabase/migrations` - Migrações do Banco de Dados
Todas as migrações SQL para criar e atualizar tabelas no Supabase.

**Nota:** O diretório `/database/migrations/` foi removido pois era uma duplicação antiga. Todas as migrações atuais estão em `/supabase/migrations/`.

## ✅ Sincronização IndexedDB ↔ Supabase

### Tabelas Sincronizadas (13 tabelas)

| IndexedDB | Supabase | Push | Pull | Status |
|-----------|----------|------|------|--------|
| fazendas | fazendas_online | ✅ | ✅ | ✅ |
| racas | racas_online | ✅ | ✅ | ✅ |
| categorias | categorias_online | ✅ | ✅ | ✅ |
| nascimentos | nascimentos_online | ✅ | ✅ | ✅ |
| desmamas | desmamas_online | ✅ | ✅ | ✅ |
| usuarios | usuarios_online | ✅ | ✅ | ✅ |
| matrizes | matrizes_online | ✅ | ✅ | ✅ |
| deletedRecords | - | ✅ | ❌ | ✅ (apenas push) |
| audits | audits_online | ✅ | ✅ | ✅ |
| notificacoesLidas | notificacoes_lidas_online | ✅ | ✅ | ✅ |
| alertSettings | alert_settings_online | ✅ | ✅ | ✅ |
| appSettings | app_settings_online | ✅ | ✅ | ✅ |
| rolePermissions | role_permissions_online | ✅ | ✅ | ✅ |

**TODAS AS TABELAS ESTÃO SINCRONIZADAS CORRETAMENTE**

## 🔧 Correções Aplicadas

1. ✅ Substituído `.add()` por `.put()` em todas as operações de pull
2. ✅ Adicionada validação de UUID antes de processar registros
3. ✅ Adicionado tratamento de erro para ConstraintError
4. ✅ Corrigido erro de permissões usando `.put()` ao invés de `.add()`

## 🗑️ Arquivos Removidos

1. **`src/components/IconButton.tsx`** ✅ REMOVIDO
   - Não era importado em nenhum arquivo
   - Foi removido para manter o código limpo

2. **`database/migrations/`** ✅ REMOVIDO
   - Era uma duplicação antiga de `supabase/migrations/`
   - Tinha apenas 3 arquivos antigos, enquanto `supabase/migrations/` tem 26 arquivos atualizados
   - Foi removido para evitar confusão

## ⚠️ Arquivos Não Utilizados (Mantidos para uso futuro)

1. **`src/utils/atualizarDataNascimento.ts`**
   - Não é importado em nenhum arquivo
   - Pode ser removido (ou mantido como utilitário para uso futuro)

3. **`database/migrations/`** (diretório)
   - Parece ser duplicado de `supabase/migrations/`
   - Verificar se é necessário antes de remover

## 📝 Recomendações

1. **Remover arquivos não utilizados** para manter o código limpo
2. **Verificar se `database/migrations/` é necessário** ou se pode ser removido
3. **Manter `atualizarDataNascimento.ts`** se for uma função utilitária que pode ser usada no futuro
4. **Documentar** qualquer arquivo que seja mantido intencionalmente para uso futuro
