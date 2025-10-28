-- Create storage policies for clockin-photos bucket
CREATE POLICY "Kiosks can upload their own clock photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clockin-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Kiosks can view their own clock photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'clockin-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public can view clock photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'clockin-photos');