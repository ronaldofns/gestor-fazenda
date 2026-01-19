# Guia de Backup Automático

Sistema de backup automático agendado com histórico e notificações.

---

## 🎯 O que é o Backup Automático?

O Backup Automático cria cópias periódicas de todos os seus dados locais (IndexedDB) sem intervenção manual, garantindo que você sempre tenha um backup recente em caso de problemas.

---

## 🚀 Como Ativar

1. Clique no botão **"Backup Auto"** no TopBar
2. Na seção **"Configurações"**, ative o toggle **"Backup Automático"**
3. Configure a frequência desejada
4. Pronto! O sistema cuidará do resto

---

## ⚙️ Configurações Disponíveis

### Frequência de Backup
Escolha o intervalo entre backups automáticos:
- **A cada 1 hora** - Para uso intenso
- **A cada 3 horas** - Recomendado para uso moderado
- **A cada 6 horas** - Bom equilíbrio
- **A cada 12 horas** - Duas vezes por dia
- **Diariamente (24h)** - Recomendado (padrão)
- **A cada 2 dias** - Uso esporádico
- **Semanalmente** - Backup mínimo

### Notificações
- ✅ **Notificar em caso de sucesso** - Receba confirmação de backup realizado
- ✅ **Notificar em caso de falha** - Seja alertado se houver problemas

### Histórico Máximo
- Configure quantos backups manter no histórico (5-50)
- Padrão: 10 backups
- Backups mais antigos são automaticamente removidos

---

## 📊 Status em Tempo Real

O painel de Backup Automático mostra:

### Card de Status
- **Estado:** Ativo ou Desabilitado
- **Próximo em:** Tempo restante até o próximo backup
- **Último:** Data e hora do último backup realizado

### Card de Estatísticas
- **Total:** Quantidade total de backups no histórico
- **Sucesso:** Backups realizados com sucesso
- **Falhas:** Backups que falharam

---

## 📜 Histórico de Backups

Cada entrada no histórico mostra:
- ✅ Status (sucesso ou falha)
- 📅 Data e hora do backup
- 💾 Tamanho do arquivo
- 📄 Nome do arquivo gerado
- ❌ Mensagem de erro (se aplicável)

### Gerenciar Histórico
- 🗑️ **Remover item:** Clique no X ao lado de cada backup
- 🧹 **Limpar tudo:** Botão "Limpar Histórico" remove todos os registros

---

## 🎬 Backup Manual

Mesmo com backup automático ativo, você pode forçar um backup imediato:
1. Clique em **"Executar Backup Agora"**
2. Aguarde o processo (geralmente < 5 segundos)
3. O backup será adicionado ao histórico

**Uso recomendado:**
- Antes de fazer alterações importantes
- Antes de importar dados externos
- Após cadastrar muitos registros

---

## 💾 O que é incluído no Backup?

O backup completo inclui **TODAS** as tabelas do IndexedDB:
- ✅ Fazendas
- ✅ Raças
- ✅ Categorias
- ✅ Matrizes
- ✅ Nascimentos
- ✅ Desmamas
- ✅ Pesagens
- ✅ Vacinações
- ✅ Usuários
- ✅ Permissões (rolePermissions)
- ✅ Configurações de Alerta (alertSettings)
- ✅ Configurações do App (appSettings)

**Formato:** JSON estruturado (versão 2.0)

---

## 📁 Onde os Backups são Salvos?

Os backups automáticos **NÃO** são baixados automaticamente. Apenas o histórico é mantido.

Para **fazer download** de um backup:
1. Use o botão **"Exportar Backup"** no menu do usuário (TopBar)
2. Ou vá para a página de Sincronização

**Motivo:** Evitar downloads automáticos excessivos e manter o controle do usuário.

---

## 🔄 Restaurar um Backup

Para restaurar dados de um backup:
1. Clique em **"Importar Backup"** no menu do usuário (TopBar)
2. Selecione o arquivo JSON do backup
3. Confirme a importação
4. Os dados serão mesclados com os existentes

**⚠️ IMPORTANTE:**
- A importação **mescla** dados (não substitui)
- Registros duplicados são tratados automaticamente
- Faça backup antes de importar (precaução)

---

## 🛡️ Segurança

### Dados Locais
- Backups são salvos apenas no dispositivo
- **Nenhum dado é enviado para servidores externos**
- Você tem controle total sobre seus backups

### Privacidade
- Backups contêm dados sensíveis (nascimentos, matrizes, etc)
- Mantenha os arquivos de backup em local seguro
- Não compartilhe backups publicamente

---

## 📊 Metadados do Backup

Cada backup inclui metadados úteis:
```json
{
  "versao": "2.0",
  "dataBackup": "2026-01-19T10:30:00.000Z",
  "metadados": {
    "totalFazendas": 5,
    "totalMatrizes": 120,
    "totalNascimentos": 450,
    "totalDesmamas": 380,
    "totalPesagens": 890,
    "totalVacinacoes": 230
  },
  "dados": {
    // ... todos os dados
  }
}
```

---

## 💡 Melhores Práticas

### 1. Defina Frequência Adequada
- **Uso intenso:** 3-6 horas
- **Uso moderado:** 12-24 horas (recomendado)
- **Uso esporádico:** 2-7 dias

### 2. Mantenha Histórico Suficiente
- Mínimo: 5 backups
- Recomendado: 10-20 backups
- Permite recuperar de problemas recentes

### 3. Faça Download Periódico
- Baixe backups importantes manualmente
- Recomendado: semanal ou mensal
- Armazene em local seguro (nuvem, HD externo)

### 4. Teste a Restauração
- Teste importar um backup em ambiente de teste
- Garante que o processo funciona quando necessário

### 5. Antes de Ações Críticas
Execute backup manual antes de:
- Importar planilhas grandes
- Fazer limpezas massivas
- Atualizar o sistema
- Sincronizar após muito tempo offline

---

## 🔔 Notificações

### Sucesso
Quando habilitada, você verá:
- 🟢 Toast verde confirmando o backup
- Data e hora do backup
- Indicação no histórico

### Falha
Quando habilitada, você verá:
- 🔴 Toast vermelho alertando sobre erro
- Mensagem de erro específica
- Registro no histórico com detalhes

**Recomendação:** Manter ambas habilitadas para estar sempre informado.

---

## 📈 Estatísticas

O painel mostra estatísticas úteis:
- **Total de backups:** Quantidade no histórico
- **Sucesso:** Percentual de sucesso
- **Falhas:** Quantidade de falhas
- **Tamanho médio:** Tamanho típico dos backups

Use estas métricas para:
- Monitorar a saúde do sistema
- Identificar problemas recorrentes
- Planejar espaço de armazenamento

---

## ⚠️ Solução de Problemas

### Backup não está executando
1. Verifique se o toggle está **Ativo**
2. Confirme que o navegador não está em modo privado
3. Verifique se há espaço em disco
4. Tente executar manualmente

### Muitas falhas no histórico
1. Verifique espaço em disco
2. Verifique permissões do navegador
3. Limpe o histórico e tente novamente
4. Reduza a frequência se o problema persistir

### Backup muito grande
Backups grandes (>10MB) podem indicar:
- Muitos registros no sistema (normal)
- Possível duplicação de dados (executar limpeza)

### Notificações não aparecem
1. Verifique se as notificações estão habilitadas nas configurações
2. Verifique permissões de notificação do navegador
3. Veja o histórico para confirmar se o backup foi executado

---

## 🔮 Funcionalidades Futuras

Planejado para próximas versões:
- [ ] Backup automático para nuvem (Google Drive, Dropbox)
- [ ] Compressão de backups
- [ ] Backup incremental (apenas mudanças)
- [ ] Restauração seletiva (escolher tabelas específicas)
- [ ] Agendamento por horário específico
- [ ] Múltiplos perfis de backup

---

## 📞 Suporte

Em caso de problemas:
1. Verifique o histórico de backups para mensagens de erro
2. Tente executar backup manual
3. Consulte a documentação técnica
4. Entre em contato com o suporte técnico

---

**Versão:** 0.3.0  
**Última atualização:** 19/01/2026
