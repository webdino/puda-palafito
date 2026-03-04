// biome-ignore-all lint: type augmentation file
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_SAVED_CONTENTS_MAX_COUNT: string;
  readonly WXT_EXPORT_FILE_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
