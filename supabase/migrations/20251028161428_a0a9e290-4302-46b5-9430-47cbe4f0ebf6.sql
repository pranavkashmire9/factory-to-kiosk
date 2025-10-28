-- Add image_url column to factory_inventory table
ALTER TABLE public.factory_inventory
ADD COLUMN image_url TEXT;

-- Add image_url column to kiosk_inventory table
ALTER TABLE public.kiosk_inventory
ADD COLUMN image_url TEXT;