
-- =========================================================
-- Fase 4: Documentos (upload + revisão)
-- =========================================================

-- Storage policies para bucket privado "documents"
-- Path convention: <request_id>/<traveler_id>/<doc_id>-<filename>
CREATE POLICY "documents_obj_member_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_request_member((string_to_array(name,'/'))[1]::uuid)
);

CREATE POLICY "documents_obj_member_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_request_member((string_to_array(name,'/'))[1]::uuid)
);

CREATE POLICY "documents_obj_member_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_request_member((string_to_array(name,'/'))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_request_member((string_to_array(name,'/'))[1]::uuid)
);

CREATE POLICY "documents_obj_member_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_request_member((string_to_array(name,'/'))[1]::uuid)
);

-- RPC: cliente registra upload concluído
CREATE OR REPLACE FUNCTION public.submit_document(_doc_id uuid, _file_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid;
BEGIN
  SELECT t.request_id INTO _req
  FROM public.documents d
  JOIN public.travelers t ON t.id = d.traveler_id
  WHERE d.id = _doc_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'doc not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(btrim(_file_url),'') = '' THEN RAISE EXCEPTION 'file required'; END IF;

  UPDATE public.documents
     SET file_url = _file_url,
         status = 'received',
         uploaded_at = now(),
         version = version + 1,
         reject_reason = NULL,
         reviewed_by = NULL
   WHERE id = _doc_id
     AND status <> 'locked';
END; $$;

-- RPC: admin aprova ou rejeita
CREATE OR REPLACE FUNCTION public.review_document(_doc_id uuid, _approve boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT t.request_id, r.agency_id
    INTO _req, _agency
  FROM public.documents d
  JOIN public.travelers t ON t.id = d.traveler_id
  JOIN public.requests r ON r.id = t.request_id
  WHERE d.id = _doc_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'doc not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _approve THEN
    UPDATE public.documents
       SET status = 'approved',
           reject_reason = NULL,
           reviewed_by = auth.uid()
     WHERE id = _doc_id;
  ELSE
    UPDATE public.documents
       SET status = 'rejected',
           reject_reason = COALESCE(NULLIF(btrim(_reason),''),'Documento ilegível ou incompleto'),
           reviewed_by = auth.uid()
     WHERE id = _doc_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_document(uuid, boolean, text) TO authenticated;
