import { compteDepuisEmail } from "../domain/domaine";
import type { Account } from "../domain/types";
import { CLIENT_ID, JETON_CLE, SCOPES } from "./config";
import type { PortAuthentification } from "./port";

// Adaptateur OAuth réel (M2, ADR-12) : Google Identity Services (token client, flux implicite).
// Le jeton est conservé derrière le port de stockage (ADR-12), jamais en dur.
// Dépendances injectées (ADR-08) pour rester testable hors navigateur.

export interface DepsAuth {
  chargerGsi?: () => Promise<void>;
  demanderJeton?: (cb: (r: { access_token?: string; error?: string }) => void) => void;
  fetch?: typeof fetch;
  lireJeton?: () => string | null;
  ecrireJeton?: (jeton: string | null) => void;
}

export interface AuthReelle extends PortAuthentification {
  jetonActuel: () => string | null;
}

const GSI = "https://accounts.google.com/gsi/client";

export function adaptateurAuth(deps: DepsAuth = {}): AuthReelle {
  const chargerGsi = deps.chargerGsi ?? (() =>
    new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = GSI; s.async = true; s.defer = true;
      s.onload = () => res(); s.onerror = () => rej(new Error("chargement GSI impossible"));
      document.head.appendChild(s);
    }));
  const fetchFn = deps.fetch ?? fetch;
  const lireJeton = deps.lireJeton ?? (() => null);
  const ecrireJeton = deps.ecrireJeton ?? (() => {});

  const demanderJeton = deps.demanderJeton ?? ((cb) => {
    const w = window as any;
    const client = w.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES, callback: cb,
    });
    client.requestAccessToken({ prompt: "consent" });
  });

  async function emailDuJeton(jeton: string): Promise<string | null> {
    const r = await fetchFn("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.email === "string" ? j.email : null;
  }

  return {
    jetonActuel: () => lireJeton(),
    async connecter(): Promise<Account | null> {
      await chargerGsi();
      const jeton = await new Promise<string | null>((res) => {
        demanderJeton((r) => res(r.access_token ?? (r.error ? null : null)));
      });
      if (!jeton) return null;
      ecrireJeton(jeton);
      const email = await emailDuJeton(jeton);
      if (!email) return null;
      return compteDepuisEmail(email);
    },
    async deconnecter(): Promise<void> {
      const jeton = lireJeton();
      ecrireJeton(null);
      if (jeton) {
        try { await fetchFn(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(jeton)}`, { method: "POST" }); } catch { /* réseau indisponible : le jeton local est déjà effacé */ }
      }
    },
  };
}

export { JETON_CLE };
