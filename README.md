# Gestor Fazenda

Sistema de gestão para fazendas de gado, desenvolvido como PWA (Progressive Web App) com sincronização offline/online.

## 🚀 Características

- **PWA**: Funciona offline e pode ser instalado como app
- **Sincronização**: Sincronização bidirecional entre IndexedDB (local) e Supabase (servidor)
- **Multi-usuário**: Sistema de permissões por roles (admin, gerente, peão, visitante)
- **Tema Dinâmico**: Cores personalizáveis e modo escuro
- **Gestão Completa**: 
  - Fazendas
  - Matrizes
  - Nascimentos
  - Desmamas
  - Raças e Categorias
  - Usuários e Permissões
  - Notificações e Alertas
  - Dashboard com estatísticas

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Banco Local**: Dexie.js (IndexedDB)
- **Backend**: Supabase (PostgreSQL)
- **Roteamento**: React Router
- **Formulários**: React Hook Form + Zod

## 📦 Instalação

```bash
npm install
npm run dev
```

## 📚 Documentação

Para documentação técnica detalhada, consulte a pasta [`docs/`](./docs/README.md).

## 📄 Licença

Este projeto é privado.
