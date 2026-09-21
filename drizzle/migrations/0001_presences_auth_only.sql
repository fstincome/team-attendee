DROP POLICY IF EXISTS "Lecture publique des presences" ON public.presences;
DROP POLICY IF EXISTS "Insertion publique des presences" ON public.presences;
DROP POLICY IF EXISTS "Suppression publique des presences" ON public.presences;

REVOKE ALL ON public.presences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presences TO authenticated;
GRANT ALL ON public.presences TO service_role;

CREATE POLICY "Lecture par utilisateurs connectes" ON public.presences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertion par utilisateurs connectes" ON public.presences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Suppression par utilisateurs connectes" ON public.presences FOR DELETE TO authenticated USING (true);