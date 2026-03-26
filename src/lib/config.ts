export function getRotationConfig() {
  const rawFiles = parseInt(import.meta.env.WXT_ROTATION_FILE_COUNT || "5", 10);
  const rawLimit = parseInt(import.meta.env.WXT_ROTATION_RECORD_LIMIT || "200", 10);
  return {
    maxFiles: Number.isFinite(rawFiles) && rawFiles >= 1 ? rawFiles : 5,
    recordLimit: Number.isFinite(rawLimit) && rawLimit >= 1 ? rawLimit : 200,
  };
}
