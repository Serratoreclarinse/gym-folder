-- Atomically increments the invoice counter and returns the new number.
-- Replaces the read → increment → write pattern in the client which has a
-- race condition when two admin tabs open simultaneously (both read the same
-- last_number and produce duplicate invoice numbers).
CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  new_num int;
BEGIN
  UPDATE invoice_counter
  SET last_number = last_number + 1
  WHERE id = 1
  RETURNING last_number INTO new_num;
  RETURN new_num;
END;
$$;
