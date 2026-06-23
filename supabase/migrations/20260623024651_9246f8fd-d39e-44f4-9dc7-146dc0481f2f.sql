
DROP POLICY IF EXISTS "branding_auth_read" ON storage.objects;
CREATE POLICY "branding_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_admin_write" ON storage.objects;
CREATE POLICY "branding_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND public.has_role(auth.uid(),'admin')
    AND (storage.foldername(name))[1] = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
CREATE POLICY "branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND public.has_role(auth.uid(),'admin')
    AND (storage.foldername(name))[1] = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;
CREATE POLICY "branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND public.has_role(auth.uid(),'admin')
    AND (storage.foldername(name))[1] = public.current_agency_id()::text
  );
