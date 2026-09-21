CREATE TABLE public.presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidat_id TEXT NOT NULL,
  jour DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidat_id, jour)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presences TO authenticated;
GRANT ALL ON public.presences TO service_role;

ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des presences" ON public.presences FOR SELECT USING (true);
CREATE POLICY "Ajout public des presences" ON public.presences FOR INSERT WITH CHECK (true);
CREATE POLICY "Suppression publique des presences" ON public.presences FOR DELETE USING (true);