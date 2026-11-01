import { migrateLegacy, validatePlan } from "./model";

export async function parsePlannerBackup(text) {
  const parsed = JSON.parse(text);
  if (parsed?.version === 3) return validatePlan(parsed);
  const { parseImportBackup } = await import("../services/storageRecovery");
  const recovered = parseImportBackup(text);
  if (!recovered.success)
    throw new Error(
      recovered.error || "No TYMVERA plan was found in this backup.",
    );
  return validatePlan(migrateLegacy(recovered.history, recovered.presets));
}
