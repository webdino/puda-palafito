// biome-ignore-all lint: type augmentation file
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_ROTATION_FILE_COUNT: string;
  readonly WXT_ROTATION_RECORD_LIMIT: string;
  readonly WXT_EXPORT_FILE_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
