import { APP_VERSION_M1 } from "../domaineConstantes";

export function App() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Objectifs</h1>
      <p>App v{APP_VERSION_M1} · schéma v9 — portage M1 en cours (domaine pur transplanté).</p>
    </main>
  );
}
