import { db } from "../db/dexieDB";

async function buildGenealogiaPayload(local: any) {
  const animal = local.animalId ? await db.animais.get(local.animalId) : null;

  const matriz = local.matrizId ? await db.matrizes.get(local.matrizId) : null;

  const tipoMatriz = local.tipoMatrizId
    ? await db.tiposAnimal.get(local.tipoMatrizId)
    : null;

  const reprodutor = local.reprodutorId
    ? await db.animais.get(local.reprodutorId)
    : null;

  if (!animal?.remoteId)
    throw new Error(`Genealogia ${local.id}: animal sem remoteId`);

  if (!matriz?.remoteId)
    throw new Error(`Genealogia ${local.id}: matriz sem remoteId`);

  return {
    uuid: local.id,
    animal_id: animal.remoteId, // ✅ INT
    matriz_id: matriz.remoteId, // ✅ INT
    tipo_matriz_id: tipoMatriz?.remoteId ?? null,
    reprodutor_id: reprodutor?.remoteId ?? null,
    avo_materna: local.avoMaterna,
    avo_paterna: local.avoPaterna,
    avo_materno: local.avoPaternoMaterno,
    avo_paterno: local.avoPaternoPatro,
    geracoes: local.geracoes,
    observacoes: local.observacoes,
    created_at: local.createdAt,
    updated_at: local.updatedAt,
    deleted_at: local.deletedAt,
  };
}

export const syncPayloadBuilders = {
  genealogia: buildGenealogiaPayload,
};
