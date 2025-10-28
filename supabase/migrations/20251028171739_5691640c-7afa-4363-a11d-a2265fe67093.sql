-- Create wastage tracking table
CREATE TABLE public.wastage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kiosk_id UUID NOT NULL,
  order_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;

-- Create policies for wastage
CREATE POLICY "Kiosks can view their own wastage"
ON public.wastage
FOR SELECT
USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can create their own wastage"
ON public.wastage
FOR INSERT
WITH CHECK (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all wastage"
ON public.wastage
FOR SELECT
USING (get_user_role(auth.uid()) = 'manager'::user_role);

CREATE POLICY "Managers can delete wastage"
ON public.wastage
FOR DELETE
USING (get_user_role(auth.uid()) = 'manager'::user_role);

-- Add index for better performance
CREATE INDEX idx_wastage_kiosk_id ON public.wastage(kiosk_id);
CREATE INDEX idx_wastage_order_id ON public.wastage(order_id);

-- Enable realtime for wastage table
ALTER PUBLICATION supabase_realtime ADD TABLE public.wastage;