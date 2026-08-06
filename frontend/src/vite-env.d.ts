/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected at frontend image build (e.g. "47+56d59b9"). */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
