-- Manual crypto checkout: customers submit their own order together with the
-- transaction hash they paid with, and an admin verifies it later. The previous
-- flow created orders inside `create_crypto_invoice` (service-role only), which
-- meant authenticated users had no INSERT privilege on `orders` at all.
--
-- 1. `transaction_hash` is the legacy duplicate of `txid`; give it a default so a
--    direct insert only has to supply the values the checkout form knows about.
ALTER TABLE public.orders ALTER COLUMN transaction_hash SET DEFAULT '';

-- 2. Fill the legacy column from the submitted TXID and derive the price from the
--    product instead of trusting whatever the browser sends.
CREATE OR REPLACE FUNCTION public.prepare_pending_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE product public.cards; clean_txid text := nullif(btrim(coalesce(NEW.txid, '')), '');
BEGIN
  IF NEW.id IS NULL THEN NEW.id := gen_random_uuid(); END IF;
  IF NEW.status IS NULL THEN NEW.status := 'pending'; END IF;

  IF clean_txid IS NOT NULL THEN
    IF clean_txid !~ '^[A-Za-z0-9]{20,200}$' THEN
      RAISE EXCEPTION 'Enter a valid transaction hash';
    END IF;
    NEW.txid := clean_txid;
    -- Older queries still read transaction_hash, so keep both in sync.
    NEW.transaction_hash := clean_txid;
  ELSIF coalesce(btrim(NEW.transaction_hash), '') = '' THEN
    NEW.transaction_hash := 'awaiting-payment:' || NEW.id;
  END IF;

  IF NEW.card_id IS NOT NULL THEN
    SELECT * INTO product FROM public.cards WHERE id = NEW.card_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;
    -- The product price is authoritative; the client cannot set the amount.
    NEW.amount_usd := product.price_in_usd;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS prepare_pending_order ON public.orders;
CREATE TRIGGER prepare_pending_order BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prepare_pending_order();

-- 3. Let a signed-in customer insert their own pending order (the migration
--    0001 grant was revoked, which is what broke the previous checkout).
GRANT INSERT ON public.orders TO authenticated;

DROP POLICY IF EXISTS "users create pending orders" ON public.orders;
CREATE POLICY "users create pending orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND delivery_details IS NULL
  AND crypto_method IN ('USDT-BEP20', 'USDT-SOLANA')
  AND txid IS NOT NULL
  AND length(btrim(txid)) BETWEEN 20 AND 200
);
