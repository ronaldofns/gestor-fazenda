// Script de diagnóstico de sincronização de tags
// Execute este script no console do navegador após criar uma tag

(async () => {
  console.log('🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO DE TAGS\n');
  
  const { db } = await import('./src/db/dexieDB');
  const { pushPending, pullUpdates } = await import('./src/api/syncService');
  
  // 1. Verificar tags locais
  console.log('📊 1. TAGS LOCAIS:');
  const todasTags = await db.tags.toArray();
  console.log(`Total de tags: ${todasTags.length}`);
  console.table(todasTags.map(t => ({
    nome: t.name,
    cor: t.color,
    sincronizada: t.synced ? '✅' : '❌',
    deletada: t.deletedAt ? '🗑️ SIM' : 'NÃO',
    criada: new Date(t.createdAt).toLocaleString('pt-BR')
  })));
  
  // 2. Verificar tags pendentes
  const tagsPendentes = todasTags.filter(t => !t.synced);
  console.log(`\n📤 2. TAGS PENDENTES PARA SINCRONIZAR: ${tagsPendentes.length}`);
  if (tagsPendentes.length > 0) {
    console.table(tagsPendentes.map(t => ({
      nome: t.name,
      deletada: t.deletedAt ? 'SIM' : 'NÃO',
      createdBy: t.createdBy
    })));
  }
  
  // 3. Tentar sincronizar
  if (tagsPendentes.length > 0) {
    console.log('\n🚀 3. TENTANDO SINCRONIZAR...');
    try {
      await pushPending();
      console.log('✅ pushPending() executado com sucesso!');
      
      // Verificar novamente após sync
      const tagsAposSync = await db.tags.toArray();
      const aindaPendentes = tagsAposSync.filter(t => !t.synced);
      
      console.log(`\n📊 4. RESULTADO APÓS SYNC:`);
      console.log(`Tags sincronizadas: ${tagsAposSync.filter(t => t.synced).length}`);
      console.log(`Tags ainda pendentes: ${aindaPendentes.length}`);
      
      if (aindaPendentes.length > 0) {
        console.error('❌ PROBLEMA: Ainda há tags pendentes após sync!');
        console.table(aindaPendentes.map(t => ({
          nome: t.name,
          synced: t.synced,
          deletedAt: t.deletedAt,
          createdBy: t.createdBy
        })));
      } else {
        console.log('🎉 SUCESSO! Todas as tags foram sincronizadas!');
      }
    } catch (error) {
      console.error('❌ ERRO ao sincronizar:', error);
    }
  } else {
    console.log('ℹ️ Não há tags pendentes para sincronizar.');
  }
  
  // 5. Verificar no servidor
  console.log('\n🌐 5. BUSCANDO DO SERVIDOR...');
  try {
    await pullUpdates();
    console.log('✅ pullUpdates() executado com sucesso!');
    
    const tagsAposPull = await db.tags.toArray();
    console.log(`Total de tags após pull: ${tagsAposPull.length}`);
  } catch (error) {
    console.error('❌ ERRO ao buscar do servidor:', error);
  }
})();
