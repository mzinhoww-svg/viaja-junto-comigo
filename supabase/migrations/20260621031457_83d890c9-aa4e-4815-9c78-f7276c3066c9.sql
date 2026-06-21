
-- Policy para agencies
CREATE POLICY agencies_member_read ON public.agencies
  FOR SELECT TO authenticated
  USING (id = public.current_agency_id() OR public.has_role(auth.uid(),'admin'));

-- Revogar EXECUTE de PUBLIC nas funções security definer
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_request_member(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_journey_steps(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_traveler_defaults() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_request_member(UUID) TO authenticated;
