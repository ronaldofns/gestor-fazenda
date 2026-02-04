# Funcionalidades para Gerir Fazendas

Referência das funcionalidades do **Gestor Fazenda** para gestão completa de rebanho e fazendas.

---

## Visão geral

O sistema cobre:

- **Cadastros**: fazendas, animais, matrizes, raças, categorias, tipos/status/origens.
- **Operações por animal**: desmama, pesagem, vacinação, alteração de status (venda, morte, transferência).
- **Visão gerencial**: dashboard, relatórios, notificações e alertas.
- **Multi-usuário**: usuários, perfis, permissões por tela e por ação.
- **Infraestrutura**: sincronização online/offline, backup, PWA, notificações push.

---

## 1. Cadastros principais

| Funcionalidade | Onde | Permissões |
|----------------|------|------------|
| **Fazendas** | Menu **Fazendas** → Lista de fazendas. Criar, editar, histórico, tags. | `ver_fazendas` (ver), `gerenciar_fazendas` (criar/editar) |
| **Animais** | Menu **Animais** → Lista com filtros (brinco, tipo, status, sexo, raça, fazenda, tags). Criar/editar animal, genealogia, timeline, desmama/pesagem/vacina no modal. | `ver_planilha`, `cadastrar_animal`, `editar_animal`, `excluir_animal` |
| **Matrizes** | Integradas ao cadastro de animais (tipo matriz) e à genealogia. Nascimentos históricos via entidade Nascimento. | Conforme permissões de animais/planilha |

---

## 2. Operações por animal

Todas acessíveis pelo **modal do animal** (abrir um animal na tela Animais):

| Operação | Uso | Permissões |
|----------|-----|------------|
| **Desmama** | Registrar data e peso da desmama. | `cadastrar_desmama`, `editar_desmama`, `excluir_desmama` |
| **Pesagem** | Registrar data e peso (com opção de usar peso da balança, se configurada). | `cadastrar_pesagem`, `editar_pesagem`, `excluir_pesagem` |
| **Vacinação** | Registrar vacina, data de aplicação e vencimento. | `cadastrar_vacina`, `editar_vacina`, `excluir_vacina` |
| **Status** | Alterar status (Ativo, Vendido, Morto, Transferido, etc.) e datas de saída/valor. | Conforme edição de animal |

---

## 3. Cadastros auxiliares

| Onde | O que |
|------|--------|
| **Configurações → Raças e Categorias** | Listar, criar e editar **Raças** e **Categorias** (usadas em animais/matrizes). Permissões: `gerenciar_racas`, `gerenciar_categorias`. |
| **Modal do animal** | Botão "Nova raça" (se tiver `gerenciar_racas`) abre cadastro rápido de raça. |
| **Modal do animal** | Tipos de animal, Status e Origens são cadastrados em modais rápidos (TipoAnimalModal, StatusAnimalModal) ou podem ser gerenciados via banco/configurações. |

---

## 4. Dashboard

- **Menu Dashboard**: visão por fazenda (filtro), métricas do rebanho, evolução no tempo, distribuição por tipo/status/fazenda, alertas.
- Exportar PDF/Excel (requer `exportar_dados`).
- Permissão: `ver_dashboard`.

---

## 5. Relatórios

- **Menu Relatórios**: gráficos (evolução do rebanho, tipos, por fazenda), filtros por período.
- Exportar PDF/Excel (requer `exportar_dados`).
- Permissão: `gerar_relatorios`.

---

## 6. Notificações e alertas

- **Menu Notificações**: lista de notificações (desmama atrasada, matriz improdutiva, peso crítico, vacinas vencidas, mortalidade, etc.) e marcar como lidas.
- **Alertas no Dashboard**: banner com resumo dos alertas ativos.
- **Configurações → Alertas**: parâmetros (limite meses desmama, janela mortalidade, limiar).
- Permissão: `ver_notificacoes`.

---

## 7. Usuários e permissões

- **Menu Usuários**: listar, criar, editar e desativar usuários. Associar à fazenda e definir perfil (admin, gerente, peão, visitante). Visível com `ver_usuarios` ou `gerenciar_usuarios`; alterações exigem `gerenciar_usuarios`.
- **Menu Permissões** (admin): definir permissões por perfil (roles). Telas e ações são controladas por permissões (ver_*, cadastrar_*, editar_*, excluir_*, etc.).

---

## 8. Configurações

- **Alertas**: limites e janelas para notificações.
- **Sincronização**: intervalo automático.
- **Aparência**: tema (claro/escuro), cor primária.
- **Backup**: backup automático local e restauração.
- **Tags**: gerenciar tags do sistema (TagsManager).
- **App (PWA)**: instalação, notificações no navegador (push).
- **Balança**: conexão Web Bluetooth para leitura de peso (uso na pesagem).
- **Raças e Categorias**: listagem e cadastro de raças e categorias.

---

## 9. Sincronização

- **Menu Sincronização**: status online/offline, fila de pendências, envio/recebimento com Supabase, conflitos.
- Sincronização automática em segundo plano (intervalo configurável).
- Modo offline: dados salvos localmente (IndexedDB) e enviados quando a conexão voltar.
- Permissão: `ver_sincronizacao`.

---

## 10. Outros

- **Perfil**: dados do usuário logado e alteração de senha.
- **Histórico de alterações**: disponível em Fazendas e Animais (auditoria por entidade).
- **Tags**: em fazendas e animais; filtros por tag na tela Animais.
- **Exportação de dados**: Excel/CSV em Animais, PDF/Excel no Dashboard e Relatórios (requer `exportar_dados`).
- **Notificações push**: inscrição em Configurações → App (PWA); envio via script/servidor (ver `docs/NOTIFICACOES_PUSH_SERVIDOR.md`).

---

## Permissões disponíveis (resumo)

- **Visualização**: `ver_dashboard`, `ver_notificacoes`, `ver_sincronizacao`, `ver_planilha`, `ver_fazendas`, `ver_usuarios`
- **Gerenciamento**: `gerenciar_usuarios`, `gerenciar_fazendas`, `gerenciar_racas`, `gerenciar_categorias`
- **Animais**: `cadastrar_animal`, `editar_animal`, `excluir_animal`
- **Desmama**: `cadastrar_desmama`, `editar_desmama`, `excluir_desmama`
- **Pesagem**: `cadastrar_pesagem`, `editar_pesagem`, `excluir_pesagem`
- **Vacina**: `cadastrar_vacina`, `editar_vacina`, `excluir_vacina`
- **Relatórios e exportação**: `gerar_relatorios`, `exportar_dados`

Roles padrão (admin, gerente, peão, visitante) têm conjuntos de permissões definidos em **Permissões** e no código (`usePermissions`, `dexieDB`).
