import type { Account } from "../domain/types";

// Ports Google (prépa M2, ADR-10/12) — interfaces seules au M1 ; adaptateurs réels (OAuth, Drive appDataFolder, Calendar) au M2.
// Aucun secret dans le code : les jetons restent derrière le port de stockage (ADR-12).

export interface PortAuthentification {
  connecter(email: string, nom?: string): Promise<Account | null>;
  deconnecter(): Promise<void>;
}

export interface PortDrive {
  lireDistant(cle: string): Promise<string | null>;
  ecrireDistant(cle: string, valeur: string): Promise<void>;
}

export interface PortCalendar {
  rappelsRituels(activer: boolean): Promise<void>;
}
