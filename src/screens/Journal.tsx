import type { Journal } from "../journal/journal";

interface Props {
  journal: Journal;
}

export function JournalEcran({ journal }: Props) {
  return (
    <section className="card" aria-label="Journal d'activité">
      <h2>Journal (US22)</h2>
      {journal.lots.length === 0 && <p className="vide">Aucun événement pour l'instant.</p>}
      {journal.lots.map((lot) => (
        <details key={lot.date} open={lot.date === journal.lots[0]?.date}>
          <summary>{lot.date} — {lot.evenements.length} événement(s)</summary>
          <ul className="liste">
            {lot.evenements.map((e, i) => (
              <li className="ligne" key={i}>
                <time className="meta">{e.at}</time> <b>[{e.type}]</b> {e.message}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
