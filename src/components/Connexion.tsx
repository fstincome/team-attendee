import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });
    setEnvoi(false);
    if (error) setErreur("Adresse e-mail ou mot de passe incorrect.");
  };

  return (
    <div className="min-h-screen bg-ink text-white font-body flex items-center justify-center px-6">
      <form
        onSubmit={soumettre}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink2/60 p-8"
      >
        <p className="text-[10px] uppercase tracking-[0.35em] text-gold">
          Bootcamp 2026
        </p>
        <h1 className="font-display text-2xl tracking-wide mt-1">
          Registre des présences
        </h1>
        <p className="text-xs text-white/50 mt-2">
          Accès réservé au responsable administratif et financier.
        </p>

        <label className="block mt-6 text-[10px] uppercase tracking-widest text-white/50">
          Adresse e-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-crimson"
        />

        <label className="block mt-4 text-[10px] uppercase tracking-widest text-white/50">
          Mot de passe
        </label>
        <input
          type="password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-crimson"
        />

        {erreur && (
          <p className="mt-4 text-xs text-crimson uppercase tracking-widest">
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="mt-6 w-full rounded-lg bg-crimson px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50"
        >
          {envoi ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
