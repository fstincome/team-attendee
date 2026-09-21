import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CANDIDATS,
  JOURS,
  FRAIS_PAR_PRESENCE,
} from "@/data/candidats";
import { genererPdfPresences } from "@/lib/pdf-presences";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registre des présences · Bootcamp 21–25 septembre 2026" },
      {
        name: "description",
        content:
          "Pointage quotidien des candidats du 21 au 25 septembre 2026, tableau de bord et export PDF des frais de déplacement.",
      },
      {
        property: "og:title",
        content: "Registre des présences · Bootcamp 2026",
      },
      {
        property: "og:description",
        content:
          "Pointage quotidien, tableau de bord et frais de déplacement de 5 000 BIF par présence.",
      },
    ],
  }),
  component: Index,
});

const cle = (candidatId: string, iso: string) => `${candidatId}|${iso}`;
const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|,/g, " ");

function Index() {
  const [presences, setPresences] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("candidat_id, jour");
      if (annule) return;
      if (error) setErreur("Impossible de charger les présences.");
      else
        setPresences(
          new Set((data ?? []).map((p) => cle(p.candidat_id, p.jour))),
        );
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  const basculer = async (candidatId: string, iso: string) => {
    const k = cle(candidatId, iso);
    const etaitPresent = presences.has(k);
    const suivant = new Set(presences);
    if (etaitPresent) suivant.delete(k);
    else suivant.add(k);
    setPresences(suivant);
    setErreur(null);

    const { error } = etaitPresent
      ? await supabase
          .from("presences")
          .delete()
          .eq("candidat_id", candidatId)
          .eq("jour", iso)
      : await supabase
          .from("presences")
          .insert({ candidat_id: candidatId, jour: iso });

    if (error) {
      setPresences(presences);
      setErreur("Enregistrement impossible, réessayez.");
    }
  };

  const stats = useMemo(() => {
    const total = presences.size;
    const parJour = JOURS.map((j) => ({
      ...j,
      total: CANDIDATS.filter((c) => presences.has(cle(c.id, j.iso))).length,
    }));
    const taux = Math.round(
      (total / (CANDIDATS.length * JOURS.length)) * 100 || 0,
    );
    return { total, parJour, taux, montant: total * FRAIS_PAR_PRESENCE };
  }, [presences]);

  return (
    <div className="min-h-screen bg-ink text-white font-body">
      <header className="relative overflow-hidden grain">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 10%, #ff2e4d 0%, #7c3aed 42%, #0b0b12 78%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, #0b0b12 92%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-20">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/60">
            <span>Registre des candidats</span>
            <span>Édition 2026</span>
          </div>
          <p className="mt-16 text-gold uppercase tracking-[0.4em] text-xs font-medium">
            Candidats acceptés
          </p>
          <h1 className="font-display leading-[0.82] text-[clamp(3.5rem,12vw,9rem)] mt-3">
            <span className="block text-white">PRÉSENCE</span>
            <span className="block text-crimson">REGISTRE</span>
          </h1>
          <p className="mt-6 max-w-md text-white/70 text-sm leading-relaxed">
            Suivi des présences du{" "}
            <span className="text-gold font-semibold">
              21 au 25 septembre 2026
            </span>
            . Une présence unique par jour, par candidat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-full border border-white/20 text-xs uppercase tracking-widest">
              5 jours
            </span>
            <span className="px-4 py-2 rounded-full border border-white/20 text-xs uppercase tracking-widest">
              {CANDIDATS.length} candidats
            </span>
            <span className="px-4 py-2 rounded-full bg-gold text-ink font-semibold text-xs uppercase tracking-widest">
              5 000 BIF / jour
            </span>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 -mt-8">
        <div className="rounded-2xl bg-ink2 border border-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <h2 className="font-display text-2xl tracking-wide">
              Sélection des présences
            </h2>
            <span className="text-xs text-white/50 uppercase tracking-widest">
              Cliquer = présent
            </span>
          </div>
          {erreur && (
            <p className="mb-4 text-xs text-crimson uppercase tracking-widest">
              {erreur}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 text-[11px] uppercase tracking-widest">
                  <th className="text-left font-medium pb-3 pr-4">Candidat</th>
                  {JOURS.map((j) => (
                    <th key={j.iso} className="text-center font-medium pb-3 px-2">
                      {j.num}
                    </th>
                  ))}
                  <th className="text-right font-medium pb-3 pl-4">Frais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {CANDIDATS.map((c) => {
                  const jours = JOURS.filter((j) =>
                    presences.has(cle(c.id, j.iso)),
                  ).length;
                  return (
                    <tr key={c.id}>
                      <td className="py-3 pr-4">
                        <span className="block font-semibold text-white">
                          {c.nom}
                        </span>
                        <span className="block text-[11px] text-white/40 uppercase tracking-widest">
                          {c.groupe}
                        </span>
                      </td>
                      {JOURS.map((j) => {
                        const actif = presences.has(cle(c.id, j.iso));
                        return (
                          <td key={j.iso} className="text-center px-2">
                            <button
                              type="button"
                              disabled={chargement}
                              aria-pressed={actif}
                              aria-label={`${c.nom} — ${j.jour} ${j.num}`}
                              onClick={() => basculer(c.id, j.iso)}
                              className={`inline-block size-5 rounded-full transition-colors ${
                                actif
                                  ? "bg-crimson hover:bg-gold"
                                  : "border border-white/25 hover:border-gold"
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="text-right pl-4 font-semibold text-gold whitespace-nowrap">
                        {fmt(jours * FRAIS_PAR_PRESENCE)} F
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 mt-16">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <h2 className="font-display text-4xl tracking-wide">
            Tableau de bord
          </h2>
          <span className="text-xs text-white/50 uppercase tracking-widest">
            Synthèse des présences
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-ink2 border border-white/10 p-5">
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Présences totales
            </p>
            <p className="font-display text-5xl mt-2 text-cyan">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl bg-ink2 border border-white/10 p-5">
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Taux de présence
            </p>
            <p className="font-display text-5xl mt-2 text-gold">
              {stats.taux}%
            </p>
          </div>
          <div className="rounded-xl bg-ink2 border border-white/10 p-5">
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Candidats
            </p>
            <p className="font-display text-5xl mt-2 text-white">
              {CANDIDATS.length}
            </p>
          </div>
          <div className="rounded-xl bg-ink2 border border-white/10 p-5">
            <p className="text-[11px] uppercase tracking-widest text-white/50">
              Frais de déplacement
            </p>
            <p className="font-display text-4xl mt-2 text-crimson">
              {fmt(stats.montant)} F
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              {stats.total} présences × 5 000 F
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          {stats.parJour.map((j) => (
            <div
              key={j.iso}
              className="rounded-xl bg-ink2 border border-white/10 p-5"
            >
              <p className="text-[11px] uppercase tracking-widest text-white/50">
                {j.jour} {j.num} sept.
              </p>
              <p className="font-display text-4xl mt-2 text-white">{j.total}</p>
              <p className="text-[11px] text-white/40 mt-1">
                {fmt(j.total * FRAIS_PAR_PRESENCE)} F
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 mt-16 mb-24">
        <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <p className="text-gold uppercase tracking-[0.3em] text-xs font-medium">
              Export
            </p>
            <h3 className="font-display text-3xl mt-2">
              Rapport PDF des présences
            </h3>
            <p className="text-white/60 text-sm mt-2 max-w-md">
              Génère un document PDF récapitulatif avec les frais de
              déplacement de 5 000 BIF par présence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => genererPdfPresences(presences)}
            className="shrink-0 px-8 py-4 rounded-full bg-gold text-ink font-display text-lg tracking-wide hover:bg-white transition-colors"
          >
            Générer le PDF
          </button>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-wrap justify-between gap-6 text-[11px] uppercase tracking-[0.25em] text-white/45">
            <span>Registre des présences</span>
            <span>21 – 25 septembre 2026</span>
            <span>Comptabilité — 5 000 BIF / jour</span>
            <span>Septembre 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
