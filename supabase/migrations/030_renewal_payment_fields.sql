-- Add payment tracking fields to renewal_requests
ALTER TABLE public.renewal_requests
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'full')),
  ADD COLUMN IF NOT EXISTS amount_paid    DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS balance_due_date DATE,
  ADD COLUMN IF NOT EXISTS receipt_url   TEXT;
