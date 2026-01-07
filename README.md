# 🐄 Gestor Fazenda

Sistema completo de gestão de rebanho bovino com suporte offline-first, desenvolvido para funcionar mesmo sem conexão com a internet. Ideal para fazendas que precisam registrar nascimentos, desmamas e controlar o rebanho em áreas rurais com conectividade limitada.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19.0.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-3178c6)

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Como Usar](#-como-usar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Deploy](#-deploy)
- [Contribuindo](#-contribuindo)

## 🎯 Sobre o Projeto

O **Gestor Fazenda** é uma aplicação web progressiva (PWA) desenvolvida para gerenciar o rebanho bovino de forma eficiente e confiável. O sistema foi projetado com arquitetura **offline-first**, permitindo que os usuários continuem trabalhando mesmo em áreas sem conexão com a internet. Todos os dados são armazenados localmente e sincronizados automaticamente quando a conexão é restaurada.

### Principais Características

- ✅ **Funciona Offline**: Todos os dados são armazenados localmente usando IndexedDB
- ✅ **Sincronização Automática**: Sincroniza dados quando a conexão é restaurada
- ✅ **PWA**: Pode ser instalado como aplicativo no celular ou computador
- ✅ **Interface Responsiva**: Funciona perfeitamente em desktop, tablet e mobile
- ✅ **Performance Otimizada**: Paginação e filtros para lidar com grandes volumes de dados

## ✨ Funcionalidades

### 📊 Dashboard
- Visão geral do rebanho com métricas importantes
- Gráficos de nascimentos por mês
- Distribuição por sexo (machos/fêmeas)
- Nascimentos por fazenda
- Top raças mais comuns
- Taxa de mortandade
- Taxa de desmama

### 📝 Gestão de Nascimentos
- Cadastro completo de nascimentos com modal intuitivo
- Edição de registros existentes
- Filtros avançados:
  - Por fazenda
  - Por mês e ano
  - Por matriz ou brinco
- Paginação configurável (30, 50 ou 100 registros por página)
- Indicador visual para bezerros mortos
- Classificação: Vaca ou Novilha
- Registro de raça, sexo e observações

### 🏭 Gestão de Fazendas
- Cadastro e edição de fazendas
- Listagem ordenada alfabeticamente
- Validação de exclusão (impede excluir fazendas com nascimentos associados)
- Histórico de alterações com restauração de versões anteriores

### 🐮 Gestão de Matrizes
- Cadastro completo de matrizes (vacas/novilhas)
- Campos de identificação: identificador, fazenda, categoria, raça
- Registro de linhagem (pai e mãe)
- Data de nascimento e status ativo/inativo
- **Árvore genealógica**: Visualização interativa da linhagem até 5 gerações
- Busca de matrizes por identificador
- Resumo de performance: total de partos, vivos, mortos, média de peso
- Histórico de alterações com restauração

### 🐮 Gestão de Desmamas
- Cadastro de peso e data de desmama
- Vinculação automática com nascimentos
- Cálculo automático de taxa de desmama

### 📋 Gestão de Categorias
- Cadastro rápido de categorias
- Integração com cadastro de matrizes
- Histórico de alterações

### 📥 Importação de Planilhas
- Importação de dados via Excel (.xlsx, .xls) ou CSV
- Mapeamento automático de colunas
- Validação de dados antes da importação
- Preview dos dados antes de confirmar

### 🔄 Sincronização
- Sincronização automática a cada 30 segundos quando online
- Botão de sincronização manual
- Indicador visual de status (Online/Offline)
- Animação no botão durante sincronização
- Tratamento de conflitos (última atualização vence)
- Sincronização completa de todas as entidades (fazendas, raças, nascimentos, desmamas, matrizes, usuários, categorias, audit logs)

### 🔐 Autenticação
- Login seguro com Supabase Auth
- Proteção de rotas
- Sessão persistente
- Logout funcional

### 📜 Auditoria e Histórico
- Log completo de todas as alterações (create, update, delete)
- Registro de usuário e timestamp para cada ação
- Snapshot "antes" e "depois" de cada alteração
- Visualização de histórico de alterações em todas as entidades
- Restauração de versões anteriores
- Sincronização de logs de auditoria entre dispositivos

## 🛠 Tecnologias

### Frontend
- **React 19** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool moderna e rápida
- **React Router DOM** - Roteamento de páginas
- **Tailwind CSS** - Framework CSS utility-first
- **React Icons** - Biblioteca de ícones (Font Awesome, Material Design, Game Icons)

### Estado e Formulários
- **React Hook Form** - Gerenciamento de formulários performático
- **Zod** - Validação de schemas TypeScript-first
- **Zustand** - Gerenciamento de estado global leve

### Banco de Dados
- **Dexie.js** - Wrapper para IndexedDB (banco local)
- **Supabase** - Backend-as-a-Service (banco remoto)
- **PostgreSQL** - Banco de dados relacional (via Supabase)

### Sincronização e Cache
- **React Query** - Gerenciamento de cache e sincronização
- **LocalForage** - Wrapper para armazenamento local

### PWA
- **Vite PWA Plugin** - Configuração de Progressive Web App

### Utilitários
- **XLSX** - Leitura e escrita de arquivos Excel
- **UUID** - Geração de identificadores únicos

## 📦 Pré-requisitos

Antes de começar, você precisa ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- Conta no **Supabase** (para backend)

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/ronaldofns/gestor-fazenda.git
cd gestor-fazenda
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

4. **Execute as migrações do Supabase**

Acesse o painel do Supabase e execute as migrações SQL encontradas em `supabase/migrations/` na ordem numérica.

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Sim |

### Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Execute as migrações SQL na ordem:
   - `001_init.sql` - Criação das tabelas principais
   - `002_policies.sql` - Políticas de segurança (RLS)
   - `003_seeds.sql` - Dados iniciais (opcional)
   - `004_sync_tables.sql` - Tabelas de sincronização
   - `005_add_delete_policies.sql` - Políticas de exclusão
   - `006_add_racas_online.sql` - Tabela de raças
   - `007_add_morto_field.sql` - Campo de mortandade
   - `018_add_categoria_to_audits_and_fix_rls.sql` - Suporte a categorias e auditoria

3. Configure as políticas RLS (Row Level Security) conforme necessário

## 📖 Como Usar

### Primeiro Acesso

1. Acesse a aplicação
2. Faça login com suas credenciais do Supabase
3. Você será redirecionado para o Dashboard

### Cadastrando uma Fazenda

1. Clique em **"Fazendas"** no menu lateral
2. Clique em **"Nova Fazenda"**
3. Preencha o nome da fazenda
4. Clique em **"Salvar"**

### Cadastrando um Nascimento

1. Vá para a página **"Planilha"**
2. Clique em **"Novo Nascimento"**
3. Preencha os dados:
   - Fazenda
   - Mês e Ano
   - Matriz (ID da vaca/novilha)
   - Tipo (Vaca ou Novilha)
   - Sexo (M/F)
   - Raça (opcional)
   - Brinco (opcional)
   - Data de Nascimento (opcional)
   - Observações (opcional)
   - Status Morto (se aplicável)
4. Clique em **"Salvar"**

### Cadastrando uma Matriz

1. Clique em **"Matrizes"** no menu lateral
2. Clique em **"Nova Matriz"** ou clique no ícone de edição em uma matriz existente
3. Preencha os dados:
   - Identificador (número/ID da matriz)
   - Fazenda
   - Categoria (opcional)
   - Raça (opcional)
   - Data de Nascimento (opcional)
   - Pai (identificador do pai - opcional)
   - Mãe (identificador da mãe - opcional)
   - Status Ativo
4. Clique em **"Salvar"**

### Visualizando a Árvore Genealógica

1. Vá para a página **"Matrizes"**
2. Clique no ícone de árvore (🌳) ao lado da matriz desejada
3. A árvore genealógica será exibida mostrando:
   - A matriz selecionada no centro
   - Ancestrais até 5 gerações (pais, avós, bisavós, etc.)
   - Linhas paternas (azul) e maternas (rosa)
   - Busca de outras matrizes para visualizar suas árvores
   - Expansão/colapso de níveis

### Filtrando Dados

Na página Planilha, você pode filtrar por:
- **Fazenda**: Selecione uma fazenda específica ou "Todas"
- **Mês**: Selecione um mês específico ou "Todos"
- **Ano**: Digite o ano desejado
- **Matriz/Brinco**: Digite para buscar por matriz ou número de brinco

### Sincronização

- A sincronização acontece automaticamente a cada 30 segundos quando você está online
- Você também pode clicar no botão **"Sincronizar Agora"** na sidebar para forçar uma sincronização manual
- O indicador mostra se você está **Online** ou **Offline**

### Visualizando Histórico de Alterações

1. Em qualquer tela de listagem (Fazendas, Matrizes, Usuários, Planilha)
2. Clique no ícone de histórico (📜) ao lado do registro desejado
3. Visualize todas as alterações feitas no registro:
   - Data e hora de cada alteração
   - Usuário que fez a alteração
   - Tipo de ação (criação, atualização, exclusão)
   - Diferenças entre versões (diff)
4. Opcionalmente, restaure uma versão anterior clicando em **"Restaurar"**

### Limpando o Cache

Na sidebar, há um botão **"Limpar Cache"** que permite limpar:
- IndexedDB
- Local Storage
- Session Storage
- Cache do navegador

## 📁 Estrutura do Projeto

```
gestor-fazenda/
├── public/                 # Arquivos estáticos
│   ├── manifest.json      # Manifesto PWA
│   └── pwa-*.png          # Ícones PWA
├── src/
│   ├── api/               # Serviços de API
│   │   ├── supabaseClient.ts    # Cliente Supabase
│   │   └── syncService.ts       # Serviço de sincronização
│   ├── components/        # Componentes React
│   │   ├── Sidebar.tsx           # Menu lateral
│   │   ├── SyncStatus.tsx       # Indicador de sincronização
│   │   ├── ProtectedRoute.tsx   # Proteção de rotas
│   │   ├── ArvoreGenealogica.tsx # Árvore genealógica de matrizes
│   │   ├── HistoricoAlteracoes.tsx # Histórico de alterações
│   │   ├── MatrizModal.tsx      # Modal de cadastro de matrizes
│   │   └── ...
│   ├── db/                # Banco de dados local
│   │   ├── dexieDB.ts           # Configuração Dexie
│   │   ├── models.ts            # Modelos de dados
│   │   └── migration.ts         # Migrações locais
│   ├── hooks/             # Custom hooks
│   │   ├── useSync.ts           # Hook de sincronização
│   │   └── useOnline.ts         # Hook de verificação online
│   ├── routes/            # Páginas da aplicação
│   │   ├── Dashboard.tsx        # Dashboard principal
│   │   ├── Home.tsx             # Planilha de nascimentos
│   │   ├── Matrizes.tsx         # Gestão de matrizes
│   │   ├── ListaFazendas.tsx   # Gestão de fazendas
│   │   ├── ListaUsuarios.tsx   # Gestão de usuários
│   │   ├── Notificacoes.tsx    # Página de notificações
│   │   ├── Login.tsx            # Tela de login
│   │   └── ...
│   ├── utils/            # Utilitários
│   │   ├── importPlanilha.ts   # Importação de planilhas
│   │   ├── cleanDuplicates.ts  # Limpeza de duplicados
│   │   ├── uuid.ts             # Geração de UUIDs
│   │   ├── audit.ts            # Sistema de auditoria
│   │   ├── exportarDados.ts   # Exportação de dados
│   │   ├── gerarRelatorioPDF.ts # Geração de relatórios PDF
│   │   └── iconMapping.ts     # Mapeamento de ícones
│   ├── App.tsx            # Componente raiz
│   ├── main.tsx           # Entry point
│   └── index.css          # Estilos globais
├── supabase/
│   └── migrations/        # Migrações SQL do Supabase
├── index.html             # HTML principal
├── vite.config.ts         # Configuração do Vite
├── tailwind.config.ts     # Configuração do Tailwind
├── tsconfig.json          # Configuração TypeScript
└── package.json           # Dependências do projeto
```

## 📜 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev
```
Inicia o servidor de desenvolvimento na porta 5173

### Build de Produção
```bash
npm run build
```
Cria uma versão otimizada para produção na pasta `dist/`

### Preview da Build
```bash
npm run preview
```
Visualiza a build de produção localmente

## 🚢 Deploy

### Deploy no GitHub Pages

1. **Configure o repositório**
```bash
git init
git add .
git commit -m "feat: projeto inicial"
git branch -M main
git remote add origin https://github.com/ronaldofns/gestor-fazenda.git
git push -u origin main
```

2. **Configure o GitHub Actions** (opcional)
   - Crie um workflow para build e deploy automático

### Deploy no Vercel/Netlify

1. Conecte seu repositório GitHub
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Configure o build command: `npm run build`
4. Configure o publish directory: `dist`
5. Deploy!

### Deploy no Supabase

O Supabase também oferece hospedagem de aplicações estáticas:

1. Acesse o painel do Supabase
2. Vá em **Settings > Hosting**
3. Conecte seu repositório ou faça upload da pasta `dist/`

## 🤝 Contribuindo

Contribuições são sempre bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👤 Autor

**Ronaldo Filho**
- GitHub: [@ronaldofns](https://github.com/ronaldofns)

## 🙏 Agradecimentos

- Supabase pela infraestrutura de backend
- Comunidade React pela excelente documentação
- Todos os mantenedores das bibliotecas open-source utilizadas

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
