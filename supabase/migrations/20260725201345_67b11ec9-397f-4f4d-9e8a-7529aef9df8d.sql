
CREATE TABLE IF NOT EXISTS public.ab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment text NOT NULL,
  variant text NOT NULL,
  event text NOT NULL CHECK (event IN ('view','convert')),
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ab_events_exp_idx ON public.ab_events(experiment, variant, event);

GRANT INSERT ON public.ab_events TO anon, authenticated;
GRANT SELECT ON public.ab_events TO authenticated;
GRANT ALL ON public.ab_events TO service_role;

ALTER TABLE public.ab_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ab_events_insert ON public.ab_events;
CREATE POLICY ab_events_insert ON public.ab_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS ab_events_admin_select ON public.ab_events;
CREATE POLICY ab_events_admin_select ON public.ab_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ab_results(_experiment text)
RETURNS TABLE(variant text, views bigint, converts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT e.variant,
      count(*) FILTER (WHERE e.event = 'view'),
      count(*) FILTER (WHERE e.event = 'convert')
    FROM public.ab_events e
    WHERE e.experiment = _experiment
    GROUP BY e.variant
    ORDER BY e.variant;
END; $$;
REVOKE EXECUTE ON FUNCTION public.ab_results(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ab_results(text) TO authenticated;
