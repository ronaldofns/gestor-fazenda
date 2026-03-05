import ExcelJS from "exceljs";
import { db } from "../db/dexieDB";

export interface ExportarPlanilhaParams {
  dados: Record<string, unknown>[];
  nomeArquivo: string;
  nomePlanilha?: string;
}

/** Faz download de um workbook Excel no browser */
async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  nomeArquivo: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo.includes(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta dados para Excel (.xlsx)
 */
export async function exportarParaExcel(
  params: ExportarPlanilhaParams,
): Promise<void> {
  try {
    const { dados, nomeArquivo: baseNome, nomePlanilha = "Dados" } = params;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(nomePlanilha);
    if (dados.length > 0) {
      const headers = Object.keys(dados[0]);
      const rows = [
        headers,
        ...dados.map((row) =>
          headers.map((h) => String(row[h] ?? "").replace(/\r?\n/g, " ")),
        ),
      ];
      sheet.addRows(rows);
    }
    await downloadWorkbook(workbook, baseNome);
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    throw new Error("Erro ao exportar para Excel. Tente novamente.");
  }
}

/**
 * Exporta dados para CSV
 */
export function exportarParaCSV(params: {
  dados: Record<string, unknown>[];
  nomeArquivo: string;
}) {
  try {
    const { dados, nomeArquivo: baseNome } = params;
    const headers = dados.length > 0 ? Object.keys(dados[0]) : [];
    const linhas = dados.map((row) =>
      headers.map((h) => String(row[h] ?? "").replace(/"/g, '""')),
    );
    const csvContent = [
      headers.join(","),
      ...linhas.map((linha) => linha.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const nomeArquivo = baseNome.includes(".csv")
      ? baseNome
      : `${baseNome}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", nomeArquivo);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao exportar para CSV:", error);
    throw new Error("Erro ao exportar para CSV. Tente novamente.");
  }
}

export interface ExportarBackupCompletoOptions {
  /** Se true (padrão), dispara o download do arquivo. Se false, só retorna o conteúdo (útil para backup automático). */
  triggerDownload?: boolean;
}

export interface ExportarBackupCompletoResult {
  jsonContent: string;
  nomeArquivo: string;
  metadados: {
    totalFazendas: number;
    totalRacas: number;
    totalCategorias: number;
    totalMatrizes: number;
    totalDesmamas: number;
    totalPesagens: number;
    totalVacinacoes: number;
    totalUsuarios: number;
    totalRolePermissions: number;
    totalAlertSettings: number;
    totalAppSettings: number;
    totalTiposAnimal: number;
    totalStatusAnimal: number;
    totalOrigens: number;
    totalAnimais: number;
    totalGenealogias: number;
    totalConfinamentos: number;
    totalConfinamentoAnimais: number;
    totalConfinamentoAlimentacao: number;
    totalTags: number;
    totalTagAssignments: number;
    totalOcorrenciaAnimais: number;
  };
}

/**
 * Exporta backup completo de todos os dados locais (inclui animais, confinamentos, tags, ocorrências, etc.)
 */
export async function exportarBackupCompleto(
  opts?: ExportarBackupCompletoOptions
): Promise<ExportarBackupCompletoResult> {
  try {
    const triggerDownload = opts?.triggerDownload !== false;

    const [
      fazendas,
      racas,
      categorias,
      matrizes,
      desmamas,
      pesagens,
      vacinacoes,
      usuarios,
      rolePermissions,
      alertSettings,
      appSettings,
      tiposAnimal,
      statusAnimal,
      origens,
      animais,
      genealogias,
      confinamentos,
      confinamentoAnimais,
      confinamentoAlimentacao,
      tags,
      tagAssignments,
      ocorrenciaAnimais,
    ] = await Promise.all([
      db.fazendas.toArray(),
      db.racas.toArray(),
      db.categorias.toArray(),
      db.matrizes.toArray(),
      db.desmamas.toArray(),
      db.pesagens.toArray(),
      db.vacinacoes.toArray(),
      db.usuarios.toArray(),
      db.rolePermissions.toArray(),
      db.alertSettings.toArray(),
      db.appSettings.toArray(),
      db.tiposAnimal.toArray(),
      db.statusAnimal.toArray(),
      db.origens.toArray(),
      db.animais.toArray(),
      db.genealogias.toArray(),
      db.confinamentos.toArray(),
      db.confinamentoAnimais.toArray(),
      db.confinamentoAlimentacao.toArray(),
      db.tags.toArray(),
      db.tagAssignments.toArray(),
      db.ocorrenciaAnimais.toArray(),
    ]);

    const backup = {
      versao: "3.0",
      dataBackup: new Date().toISOString(),
      dados: {
        fazendas,
        racas,
        categorias,
        matrizes,
        desmamas,
        pesagens,
        vacinacoes,
        usuarios,
        rolePermissions,
        alertSettings,
        appSettings,
        tiposAnimal,
        statusAnimal,
        origens,
        animais,
        genealogias,
        confinamentos,
        confinamentoAnimais,
        confinamentoAlimentacao,
        tags,
        tagAssignments,
        ocorrenciaAnimais,
      },
      metadados: {
        totalFazendas: fazendas.length,
        totalRacas: racas.length,
        totalCategorias: categorias.length,
        totalMatrizes: matrizes.length,
        totalDesmamas: desmamas.length,
        totalPesagens: pesagens.length,
        totalVacinacoes: vacinacoes.length,
        totalUsuarios: usuarios.length,
        totalRolePermissions: rolePermissions.length,
        totalAlertSettings: alertSettings.length,
        totalAppSettings: appSettings.length,
        totalTiposAnimal: tiposAnimal.length,
        totalStatusAnimal: statusAnimal.length,
        totalOrigens: origens.length,
        totalAnimais: animais.length,
        totalGenealogias: genealogias.length,
        totalConfinamentos: confinamentos.length,
        totalConfinamentoAnimais: confinamentoAnimais.length,
        totalConfinamentoAlimentacao: confinamentoAlimentacao.length,
        totalTags: tags.length,
        totalTagAssignments: tagAssignments.length,
        totalOcorrenciaAnimais: ocorrenciaAnimais.length,
      },
    };

    const jsonContent = JSON.stringify(backup, null, 2);
    const dataBackup = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const nomeArquivo = `backup_gestor_fazenda_${dataBackup}.json`;

    if (triggerDownload) {
      const blob = new Blob([jsonContent], { type: "application/json" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", nomeArquivo);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return {
      jsonContent,
      nomeArquivo,
      metadados: backup.metadados,
    };
  } catch (error) {
    console.error("Erro ao exportar backup:", error);
    throw new Error("Erro ao exportar backup completo. Tente novamente.");
  }
}

/**
 * Importa backup completo e restaura dados locais
 */
export async function importarBackup(
  arquivo: File,
): Promise<{ sucesso: boolean; mensagem: string; totais?: Record<string, number> }> {
  try {
    // Ler conteúdo do arquivo
    const conteudo = await arquivo.text();
    const backup = JSON.parse(conteudo);

    if (!backup.versao || !backup.dados) {
      throw new Error("Arquivo de backup inválido ou corrompido");
    }

    const { dados } = backup;
    const existentesAntes = {
      fazendas: await db.fazendas.count(),
      racas: await db.racas.count(),
      animais: await db.animais.count(),
      confinamentos: await db.confinamentos.count(),
    };
    const importados = {
      fazendas: 0,
      racas: 0,
      categorias: 0,
      matrizes: 0,
      desmamas: 0,
      pesagens: 0,
      vacinacoes: 0,
      usuarios: 0,
      rolePermissions: 0,
      alertSettings: 0,
      appSettings: 0,
      tiposAnimal: 0,
      statusAnimal: 0,
      origens: 0,
      animais: 0,
      genealogias: 0,
      confinamentos: 0,
      confinamentoAnimais: 0,
      confinamentoPesagens: 0,
      confinamentoAlimentacao: 0,
      tags: 0,
      tagAssignments: 0,
      ocorrenciaAnimais: 0,
    };

    // Importar fazendas
    if (Array.isArray(dados.fazendas)) {
      for (const fazenda of dados.fazendas) {
        const existe = await db.fazendas.get(fazenda.id);
        if (!existe) {
          await db.fazendas.put(fazenda);
          importados.fazendas++;
        }
      }
    }

    // Importar raças
    if (Array.isArray(dados.racas)) {
      for (const raca of dados.racas) {
        const existe = await db.racas.get(raca.id);
        if (!existe) {
          await db.racas.put(raca);
          importados.racas++;
        }
      }
    }

    // Importar categorias
    if (Array.isArray(dados.categorias)) {
      for (const categoria of dados.categorias) {
        const existe = await db.categorias.get(categoria.id);
        if (!existe) {
          await db.categorias.put(categoria);
          importados.categorias++;
        }
      }
    }

    // Importar matrizes
    if (Array.isArray(dados.matrizes)) {
      for (const matriz of dados.matrizes) {
        const existe = await db.matrizes.get(matriz.id);
        if (!existe) {
          await db.matrizes.put(matriz);
          importados.matrizes++;
        }
      }
    }

    // Nascimentos removidos do modelo; backups antigos com dados.nascimentos são ignorados.

    // Importar desmamas (backups antigos podem ter nascimentoId; normalizar para animalId)
    if (Array.isArray(dados.desmamas)) {
      for (const desmama of dados.desmamas) {
        const existe = await db.desmamas.get(desmama.id);
        if (!existe) {
          const normalizado = {
            ...desmama,
            animalId: desmama.animalId ?? (desmama as { nascimentoId?: string }).nascimentoId,
          };
          if (normalizado.animalId) {
            await db.desmamas.put(normalizado);
            importados.desmamas++;
          }
        }
      }
    }

    // Importar pesagens
    if (Array.isArray(dados.pesagens)) {
      for (const pesagem of dados.pesagens) {
        const existe = await db.pesagens.get(pesagem.id);
        if (!existe) {
          const normalizado = {
            ...pesagem,
            animalId: pesagem.animalId ?? (pesagem as { nascimentoId?: string }).nascimentoId,
          };
          if (normalizado.animalId) {
            await db.pesagens.put(normalizado);
            importados.pesagens++;
          }
        }
      }
    }

    // Importar vacinações
    if (Array.isArray(dados.vacinacoes)) {
      for (const vacinacao of dados.vacinacoes) {
        const existe = await db.vacinacoes.get(vacinacao.id);
        if (!existe) {
          const normalizado = {
            ...vacinacao,
            animalId: vacinacao.animalId ?? (vacinacao as { nascimentoId?: string }).nascimentoId,
          };
          if (normalizado.animalId) {
            await db.vacinacoes.put(normalizado);
            importados.vacinacoes++;
          }
        }
      }
    }

    // Importar usuários (com cuidado - não sobrescrever admin atual)
    if (Array.isArray(dados.usuarios)) {
      for (const usuario of dados.usuarios) {
        const existe = await db.usuarios.get(usuario.id);
        if (!existe) {
          await db.usuarios.put(usuario);
          importados.usuarios++;
        }
      }
    }

    // Importar rolePermissions
    if (Array.isArray(dados.rolePermissions)) {
      for (const perm of dados.rolePermissions) {
        const existe = await db.rolePermissions.get(perm.id);
        if (!existe) {
          await db.rolePermissions.put(perm);
          importados.rolePermissions++;
        }
      }
    }

    // Importar alertSettings
    if (Array.isArray(dados.alertSettings)) {
      for (const setting of dados.alertSettings) {
        const existe = await db.alertSettings.get(setting.id);
        if (!existe) {
          await db.alertSettings.put(setting);
          importados.alertSettings++;
        }
      }
    }

    if (Array.isArray(dados.appSettings)) {
      for (const setting of dados.appSettings) {
        await db.appSettings.put(setting);
        importados.appSettings++;
      }
    }

    // Tabelas do sistema de animais (backup v3.0 ou compatível)
    if (Array.isArray(dados.tiposAnimal)) {
      for (const item of dados.tiposAnimal) {
        const existe = await db.tiposAnimal.get(item.id);
        if (!existe) {
          await db.tiposAnimal.put(item);
          importados.tiposAnimal++;
        }
      }
    }
    if (Array.isArray(dados.statusAnimal)) {
      for (const item of dados.statusAnimal) {
        const existe = await db.statusAnimal.get(item.id);
        if (!existe) {
          await db.statusAnimal.put(item);
          importados.statusAnimal++;
        }
      }
    }
    if (Array.isArray(dados.origens)) {
      for (const item of dados.origens) {
        const existe = await db.origens.get(item.id);
        if (!existe) {
          await db.origens.put(item);
          importados.origens++;
        }
      }
    }
    if (Array.isArray(dados.animais)) {
      for (const item of dados.animais) {
        const existe = await db.animais.get(item.id);
        if (!existe) {
          await db.animais.put(item);
          importados.animais++;
        }
      }
    }
    if (Array.isArray(dados.genealogias)) {
      for (const item of dados.genealogias) {
        const existe = await db.genealogias.get(item.id);
        if (!existe) {
          await db.genealogias.put(item);
          importados.genealogias++;
        }
      }
    }
    if (Array.isArray(dados.confinamentos)) {
      for (const item of dados.confinamentos) {
        const existe = await db.confinamentos.get(item.id);
        if (!existe) {
          await db.confinamentos.put(item);
          importados.confinamentos++;
        }
      }
    }
    if (Array.isArray(dados.confinamentoAnimais)) {
      for (const item of dados.confinamentoAnimais) {
        const existe = await db.confinamentoAnimais.get(item.id);
        if (!existe) {
          await db.confinamentoAnimais.put(item);
          importados.confinamentoAnimais++;
        }
      }
    }
    // Ignorar dados.confinamentoPesagens: agora usamos apenas `pesagens` gerais
    if (Array.isArray(dados.confinamentoAlimentacao)) {
      for (const item of dados.confinamentoAlimentacao) {
        const existe = await db.confinamentoAlimentacao.get(item.id);
        if (!existe) {
          await db.confinamentoAlimentacao.put(item);
          importados.confinamentoAlimentacao++;
        }
      }
    }

    if (Array.isArray(dados.tags)) {
      for (const item of dados.tags) {
        const existe = await db.tags.get(item.id);
        if (!existe) {
          await db.tags.put(item);
          importados.tags++;
        }
      }
    }
    if (Array.isArray(dados.tagAssignments)) {
      for (const item of dados.tagAssignments) {
        const existe = await db.tagAssignments.get(item.id);
        if (!existe) {
          await db.tagAssignments.put(item);
          importados.tagAssignments++;
        }
      }
    }
    if (Array.isArray(dados.ocorrenciaAnimais)) {
      for (const item of dados.ocorrenciaAnimais) {
        const existe = await db.ocorrenciaAnimais.get(item.id);
        if (!existe) {
          await db.ocorrenciaAnimais.put(item);
          importados.ocorrenciaAnimais++;
        }
      }
    }

    const totalImportado = Object.values(importados).reduce(
      (acc, val) => acc + val,
      0,
    );

    if (totalImportado === 0) {
      return {
        sucesso: true,
        mensagem: "Backup válido, mas todos os dados já existem no sistema",
        totais: { existentesAntes, importados },
      };
    }

    return {
      sucesso: true,
      mensagem: `Backup importado com sucesso! ${totalImportado} registros adicionados`,
      totais: { existentesAntes, importados },
    };
  } catch (error) {
    console.error("Erro ao importar backup:", error);
    if (error instanceof SyntaxError) {
      return {
        sucesso: false,
        mensagem: "Erro: Arquivo JSON inválido",
      };
    }
    return {
      sucesso: false,
      mensagem:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao importar backup",
    };
  }
}
