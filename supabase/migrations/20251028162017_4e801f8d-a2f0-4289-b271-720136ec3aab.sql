-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for item images bucket
CREATE POLICY "Anyone can view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Managers can upload item images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "Managers can update item images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "Managers can delete item images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);