import { db } from '../db/dexieDB';
import { showToast } from './toast';

/**
 * Script para atualizar a data de nascimento nos registros que não possuem data.
 * Usa o primeiro dia do mês correspondente ao mês e ano do registro.
 * 
 * Exemplo: mês 01 (Janeiro) e ano 2025 -> 01/01/2025
 */
export async function atualizarDataNascimento() {
  try {
    // Buscar todos os nascimentos sem data de nascimento
    const nascimentosSemData = await db.nascimentos
      .filter(n => {
        // Verifica se dataNascimento está vazio, null, undefined ou string vazia
        const data = n.dataNascimento;
        return !data || (typeof data === 'string' && data.trim() === '');
      })
      .toArray();

    if (nascimentosSemData.length === 0) {
      showToast({
        type: 'info',
        title: 'Nenhum registro encontrado',
        message: 'Todos os nascimentos já possuem data de nascimento.'
      });
      return { atualizados: 0, total: 0 };
    }

    let atualizados = 0;
    const now = new Date().toISOString();

    for (const nascimento of nascimentosSemData) {
      // Validar que tem mês e ano válidos
      if (!nascimento.mes || nascimento.mes < 1 || nascimento.mes > 12) {
        console.warn(`Nascimento ${nascimento.id} tem mês inválido: ${nascimento.mes}`);
        continue;
      }

      if (!nascimento.ano || nascimento.ano < 2000 || nascimento.ano > 2100) {
        console.warn(`Nascimento ${nascimento.id} tem ano inválido: ${nascimento.ano}`);
        continue;
      }

      // Criar data: primeiro dia do mês/ano
      // Formato: DD/MM/YYYY (formato usado no sistema)
      const mesFormatado = nascimento.mes.toString().padStart(2, '0');
      const dataNascimento = `01/${mesFormatado}/${nascimento.ano}`;

      // Atualizar o registro
      await db.nascimentos.update(nascimento.id, {
        dataNascimento,
        updatedAt: now,
        synced: false // Marcar como não sincronizado para que seja enviado ao servidor
      });

      atualizados++;
    }

    showToast({
      type: 'success',
      title: 'Atualização concluída',
      message: `${atualizados} de ${nascimentosSemData.length} registros foram atualizados com sucesso.`
    });

    return {
      atualizados,
      total: nascimentosSemData.length
    };
  } catch (error) {
    console.error('Erro ao atualizar datas de nascimento:', error);
    showToast({
      type: 'error',
      title: 'Erro ao atualizar',
      message: 'Ocorreu um erro ao atualizar as datas de nascimento. Verifique o console para mais detalhes.'
    });
    throw error;
  }
}


