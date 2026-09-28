declare const __BUILD_IDENTIFIER__: string

/** Build-time identifier injected by Vite. `local` is an intentional dev fallback. */
export const buildIdentifier =
  typeof __BUILD_IDENTIFIER__ === "string" ? __BUILD_IDENTIFIER__ : "Build local";
