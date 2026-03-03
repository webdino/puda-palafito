// biome-ignore-all lint: type augmentation file
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_SAVED_CONTENTS_MAX_COUNT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
