-- Migration 050: add package_type column to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS package_type TEXT;
