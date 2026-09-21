import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CANDIDATS, JOURS, FRAIS_PAR_PRESENCE } from "@/data/candidats";
import { genererPdfPresences } from "@/lib/pdf-presences";
import { Connexion } from "@/components/Connexion";
import { PresenceLogo } from "@/components/PresenceLogo";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registre des présences · Bootcamp 21–25 septembre 2026" },
      {
        name: "description",
        content:
          "Pointage quotidien des candidats du 21 au 25 septembre 2026, liste des présences, tableau de bord et export PDF des frais de déplacement.",
      },
      { property: "og:title", content: "Registre des présences · Bootcamp 2026" },
      {
        property: "og:description",
        content:
          "Pointage par recherche de nom, liste des présences, tableau de bord et frais de déplacement configurables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cle = (candidatId: string, iso: string) => `${candidatId}|${iso}`;
const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|,/g, " ");
const nomDe = (id: string) => CANDIDATS.find((c) => c.id === id)?.nom ?? id;
const jourDe = (iso: string) => JOURS.find((j) => j.iso === iso);

type Onglet = "pointage" | "liste" | "bord" | "reglages";

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "pointage", label: "Pointage" },
  { id: "liste", label: "Liste des présences" },
  { id: "bord", label: "Tableau de bord" },
  { id: "reglages", label: "Réglages & PDF" },
];

function Index() {
  const [session, setSession] = useState<unknown | null>(null);
  const [authPret, setAuthPret] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPret(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthPret(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authPret) return <div className="min-h-screen bg-ink" />;
  if (!session) return <Connexion />;
  return <Registre />;
}

function Registre() {
  const [onglet, setOnglet] = useState<Onglet>("pointage");
  const [presences, setPresences] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [jour, setJour] = useState<string>(JOURS[0]!.iso);
  const [ouvert, setOuvert] = useState(false);
  const [frais, setFrais] = useState(FRAIS_PAR_PRESENCE);
  const [rechercheListe, setRechercheListe] = useState("");

  useEffect(() => {
    const stocke = localStorage.getItem("frais_par_presence");
    if (stocke && !Number.isNaN(Number(stocke))) setFrais(Number(stocke));
  }, []);

  const majFrais = (valeur: number) => {
    setFrais(valeur);
    localStorage.setItem("frais_par_presence", String(valeur));
  };

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

  const marquer = async (candidatId: string) => {
    const k = cle(candidatId, jour);
    setErreur(null);
    if (presences.has(k)) {
      setMessage(`${nomDe(candidatId)} est déjà marqué présent ce jour-là.`);
      return;
    }
    const precedent = presences;
    setPresences(new Set(precedent).add(k));
    const { error } = await supabase
      .from("presences")
      .insert({ candidat_id: candidatId, jour });
    if (error) {
      setPresences(precedent);
      setErreur("Enregistrement impossible, réessayez.");
      setMessage(null);
    } else {
      setMessage(
        `Présence enregistrée : ${nomDe(candidatId)} — ${jourDe(jour)?.jour} ${jourDe(jour)?.num} sept.`,
      );
    }
  };

  const retirer = async (candidatId: string, iso: string) => {
    const precedent = presences;
    const suivant = new Set(precedent);
    suivant.delete(cle(candidatId, iso));
    setPresences(suivant);
    setErreur(null);
    const { error } = await supabase
      .from("presences")
      .delete()
      .eq("candidat_id", candidatId)
      .eq("jour", iso);
    if (error) {
      setPresences(precedent);
      setErreur("Suppression impossible, réessayez.");
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
    return { total, parJour, taux, montant: total * frais };
  }, [presences, frais]);

  const presentsDuJour = CANDIDATS.filter((c) =>
    presences.has(cle(c.id, jour)),
  );

  const lignesListe = useMemo(() => {
    const q = rechercheListe.trim().toLowerCase();
    return CANDIDATS.flatMap((c) =>
      JOURS.filter((j) => presences.has(cle(c.id, j.iso))).map((j) => ({
        candidat: c,
        jour: j,
      })),
    )
      .filter(
        ({ candidat }) =>
          !q ||
          candidat.nom.toLowerCase().includes(q) ||
          candidat.groupe.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          a.jour.iso.localeCompare(b.jour.iso) ||
          a.candidat.nom.localeCompare(b.candidat.nom),
      );
  }, [presences, rechercheListe]);

  return (
    <div className="min-h-screen bg-ink text-white font-body">
      <header className="border-b border-white/10 bg-ink2/60 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
          <PresenceLogo />
          <nav className="flex flex-wrap gap-1 rounded-full border border-white/10 p-1">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest transition-colors ${
                  onglet === o.id
                    ? "bg-crimson text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-widest text-white/60 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {erreur && (
          <p className="mb-6 text-xs text-crimson uppercase tracking-widest">
            {erreur}
          </p>
        )}

        {onglet === "pointage" && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-ink2 border border-white/10 p-6">
              <h2 className="font-display text-2xl tracking-wide mb-1">
                Marquer une présence
              </h2>
              <p className="text-white/50 text-sm mb-6">
                Choisissez la journée, puis recherchez le nom du candidat.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {JOURS.map((j) => (
                  <button
                    key={j.iso}
                    type="button"
                    onClick={() => setJour(j.iso)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                      jour === j.iso
                        ? "bg-gold text-ink border-gold font-semibold"
                        : "border-white/15 text-white/70 hover:border-gold"
                    }`}
                  >
                    {j.jour} {j.num} sept.
                  </button>
                ))}
              </div>

              <Popover open={ouvert} onOpenChange={setOuvert}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={chargement}
                    className="w-full md:w-[420px] flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-ink px-4 py-3 text-left text-sm hover:border-gold transition-colors"
                  >
                    <span className="flex items-center gap-2 text-white/70">
                      <Search className="size-4" />
                      Rechercher un candidat…
                    </span>
                    <ChevronsUpDown className="size-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(420px,90vw)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Nom ou groupe…" />
                    <CommandList>
                      <CommandEmpty>Aucun candidat trouvé.</CommandEmpty>
                      <CommandGroup>
                        {CANDIDATS.map((c) => {
                          const deja = presences.has(cle(c.id, jour));
                          return (
                            <CommandItem
                              key={c.id}
                              value={`${c.nom} ${c.groupe}`}
                              onSelect={() => {
                                marquer(c.id);
                                setOuvert(false);
                              }}
                            >
                              <Check
                                className={`size-4 ${deja ? "opacity-100" : "opacity-0"}`}
                              />
                              <span className="flex-1">{c.nom}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.groupe}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {message && (
                <p className="mt-4 text-sm text-cyan">{message}</p>
              )}
            </div>

            <div className="rounded-2xl bg-ink2 border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h3 className="font-display text-xl tracking-wide">
                  Présents le {jourDe(jour)?.jour} {jourDe(jour)?.num} septembre
                </h3>
                <span className="text-xs uppercase tracking-widest text-white/50">
                  {presentsDuJour.length} / {CANDIDATS.length}
                </span>
              </div>
              {presentsDuJour.length === 0 ? (
                <p className="text-white/50 text-sm">
                  Aucune présence enregistrée pour cette journée.
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {presentsDuJour.map((c) => (
                    <li
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-semibold">{c.nom}</p>
                        <p className="text-[11px] uppercase tracking-widest text-white/40">
                          {c.groupe}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => retirer(c.id, jour)}
                        className="text-white/40 hover:text-crimson transition-colors"
                        aria-label={`Retirer ${c.nom}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {onglet === "liste" && (
          <section className="rounded-2xl bg-ink2 border border-white/10 p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
              <h2 className="font-display text-2xl tracking-wide">
                Liste des présences
              </h2>
              <input
                value={rechercheListe}
                onChange={(e) => setRechercheListe(e.target.value)}
                placeholder="Filtrer par nom ou groupe…"
                className="rounded-lg border border-white/15 bg-ink px-4 py-2 text-sm outline-none focus:border-gold w-full sm:w-72"
              />
            </div>
            {lignesListe.length === 0 ? (
              <p className="text-white/50 text-sm">Aucune présence à afficher.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 text-[11px] uppercase tracking-widest text-left">
                      <th className="pb-3 pr-4 font-medium">Journée</th>
                      <th className="pb-3 pr-4 font-medium">Candidat</th>
                      <th className="pb-3 pr-4 font-medium">Groupe</th>
                      <th className="pb-3 pr-4 font-medium text-right">Frais</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lignesListe.map(({ candidat, jour: j }) => (
                      <tr key={`${candidat.id}-${j.iso}`}>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {j.jour} {j.num} sept.
                        </td>
                        <td className="py-3 pr-4 font-semibold">{candidat.nom}</td>
                        <td className="py-3 pr-4 text-white/60">
                          {candidat.groupe}
                        </td>
                        <td className="py-3 pr-4 text-right text-gold whitespace-nowrap">
                          {fmt(frais)} F
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => retirer(candidat.id, j.iso)}
                            className="text-white/40 hover:text-crimson transition-colors"
                            aria-label={`Retirer ${candidat.nom}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {onglet === "bord" && (
          <section className="space-y-4">
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
                  {stats.total} présences × {fmt(frais)} F
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.parJour.map((j) => (
                <div
                  key={j.iso}
                  className="rounded-xl bg-ink2 border border-white/10 p-5"
                >
                  <p className="text-[11px] uppercase tracking-widest text-white/50">
                    {j.jour} {j.num} sept.
                  </p>
                  <p className="font-display text-4xl mt-2 text-white">
                    {j.total}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    {fmt(j.total * frais)} F
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-ink2 border border-white/10 p-6">
              <h3 className="font-display text-xl tracking-wide mb-4">
                Récapitulatif par candidat
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 text-[11px] uppercase tracking-widest">
                      <th className="text-left pb-3 pr-4 font-medium">Candidat</th>
                      {JOURS.map((j) => (
                        <th key={j.iso} className="pb-3 px-2 font-medium">
                          {j.num}
                        </th>
                      ))}
                      <th className="text-right pb-3 pl-4 font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {CANDIDATS.map((c) => {
                      const jours = JOURS.filter((j) =>
                        presences.has(cle(c.id, j.iso)),
                      ).length;
                      return (
                        <tr key={c.id}>
                          <td className="py-2 pr-4">{c.nom}</td>
                          {JOURS.map((j) => (
                            <td key={j.iso} className="text-center px-2">
                              {presences.has(cle(c.id, j.iso)) ? (
                                <span className="inline-block size-2.5 rounded-full bg-crimson" />
                              ) : (
                                <span className="inline-block size-2.5 rounded-full border border-white/20" />
                              )}
                            </td>
                          ))}
                          <td className="text-right pl-4 text-gold whitespace-nowrap">
                            {fmt(jours * frais)} F
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {onglet === "reglages" && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-ink2 border border-white/10 p-6">
              <h2 className="font-display text-2xl tracking-wide mb-1">
                Frais de déplacement
              </h2>
              <p className="text-white/50 text-sm mb-5">
                Montant versé par journée de présence. Modifiable à tout moment.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={frais}
                  onChange={(e) => majFrais(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/20 bg-ink px-4 py-3 text-lg font-display outline-none focus:border-gold w-48"
                />
                <span className="text-white/60 text-sm">BIF / présence</span>
              </div>
              <p className="mt-4 text-sm text-white/60">
                Total actuel :{" "}
                <span className="text-gold font-semibold">
                  {fmt(stats.montant)} BIF
                </span>{" "}
                pour {stats.total} présences.
              </p>
            </div>

            <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <p className="text-gold uppercase tracking-[0.3em] text-xs font-medium">
                  Export
                </p>
                <h3 className="font-display text-3xl mt-2">
                  Rapport PDF des présences
                </h3>
                <p className="text-white/60 text-sm mt-2 max-w-md">
                  Document récapitulatif avec les frais de {fmt(frais)} BIF par
                  présence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => genererPdfPresences(presences, frais)}
                className="shrink-0 px-8 py-4 rounded-full bg-gold text-ink font-display text-lg tracking-wide hover:bg-white transition-colors"
              >
                Générer le PDF
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
