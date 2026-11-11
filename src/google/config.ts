// Config Google (M2, ADR-12) — aucun secret dans le code source.
// Le client ID OAuth est fourni au build via la variable d'environnement
// VITE_OBJECTIFS_GOOGLE_CLIENT_ID (ex. .env.local, jamais committé — voir .gitignore).
// Sans client ID configuré, l'écran Google reste en simulation M1.
export const CLIENT_ID: string = (import.meta.env.VITE_OBJECTIFS_GOOGLE_CLIENT_ID as string | undefined) ?? "";

// appDataFolder (ADR-10) est invisible hors l'app ; Calendar pour la synchro US1/US8.
export const SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const JETON_CLE = "objectifs-google-jeton";

export function googleConfigure(): boolean {
  return CLIENT_ID.length > 0;
}
