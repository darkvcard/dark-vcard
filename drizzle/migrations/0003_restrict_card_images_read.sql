DROP POLICY IF EXISTS "card images public read" ON storage.objects;
CREATE POLICY "admin read card images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));