CREATE TABLE public.card_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
 delivery_details text NOT NULL CHECK (length(trim(delivery_details)) > 0),
 reserved_order_id uuid UNIQUE REFERENCES public.orders(id),
 delivered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_units TO authenticated;
GRANT ALL ON public.card_units TO service_role;
ALTER TABLE public.card_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage private units" ON public.card_units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.payment_invoices (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 user_id uuid NOT NULL,
 method text NOT NULL CHECK (method IN ('USDT-BEP20','USDT-SOLANA')),
 recipient text NOT NULL,
 amount_units text NOT NULL CHECK (amount_units ~ '^[0-9]+$'),
 amount_display text NOT NULL,
 memo text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
 verification_state text NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending','paid','completed','review')),
 transaction_ref text UNIQUE,
 paid_at timestamptz,
 last_checked_at timestamptz,
 last_error text,
 scan_cursor text
);
GRANT SELECT ON public.payment_invoices TO authenticated;
GRANT ALL ON public.payment_invoices TO service_role;
ALTER TABLE public.payment_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read invoices" ON public.payment_invoices FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX payment_pending_idx ON public.payment_invoices(verification_state, created_at);
REVOKE INSERT ON public.orders FROM authenticated;
CREATE OR REPLACE FUNCTION public.create_crypto_invoice(p_user_id uuid, p_card_id uuid, p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE product public.cards; invoice public.payment_invoices; unit_id uuid; new_order uuid := gen_random_uuid(); cents bigint; offset_cents integer; recipient_address text;
BEGIN
 IF p_method NOT IN ('USDT-BEP20','USDT-SOLANA') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 PERFORM pg_advisory_xact_lock(560006);
 SELECT * INTO product FROM public.cards WHERE id = p_card_id FOR UPDATE;
 IF NOT FOUND OR product.stock_status = 'out_of_stock' OR product.price_in_usd <= 0 THEN RAISE EXCEPTION 'Card unavailable'; END IF;
 IF EXISTS (SELECT 1 FROM public.payment_invoices i JOIN public.orders o ON o.id=i.order_id WHERE i.user_id=p_user_id AND o.card_id=p_card_id AND i.method=p_method AND i.expires_at>now() AND o.status='pending') THEN
   SELECT i.* INTO invoice FROM public.payment_invoices i JOIN public.orders o ON o.id=i.order_id WHERE i.user_id=p_user_id AND o.card_id=p_card_id AND i.method=p_method AND i.expires_at>now() AND o.status='pending' LIMIT 1;
   RETURN to_jsonb(invoice);
 END IF;
 IF (SELECT count(*) FROM public.payment_invoices WHERE user_id=p_user_id AND expires_at>now() AND verification_state='pending') >= 3 THEN RAISE EXCEPTION 'Finish an existing payment before creating another'; END IF;
 SELECT id INTO unit_id FROM public.card_units WHERE card_id=p_card_id AND reserved_order_id IS NULL AND delivered_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF unit_id IS NULL THEN RAISE EXCEPTION 'No instant-delivery cards available. Please contact support.'; END IF;
 cents := round(product.price_in_usd * 100);
 IF p_method='USDT-BEP20' THEN
  SELECT n INTO offset_cents FROM generate_series(1,99) n WHERE NOT EXISTS (SELECT 1 FROM public.payment_invoices WHERE method=p_method AND amount_units=((cents+n)*10000000000000000::numeric)::text AND expires_at + interval '10 minutes'>now()) ORDER BY random() LIMIT 1;
  IF offset_cents IS NULL THEN RAISE EXCEPTION 'All payment amounts are reserved. Try again later.'; END IF;
  cents := cents + offset_cents;
  recipient_address := '0x35aec7E35F65ea227e49fDd321709D52Ada389E4';
 ELSE recipient_address := '3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ'; END IF;
 INSERT INTO public.orders(id,user_id,card_id,crypto_method,transaction_hash,amount_usd) VALUES(new_order,p_user_id,p_card_id,p_method,'awaiting-payment:' || new_order,product.price_in_usd);
 INSERT INTO public.payment_invoices(order_id,user_id,method,recipient,amount_units,amount_display,memo) VALUES(new_order,p_user_id,p_method,recipient_address,(cents * CASE WHEN p_method='USDT-BEP20' THEN 10000000000000000::numeric ELSE 10000::numeric END)::text,to_char(cents::numeric/100,'FM999999999990.00'),new_order::text) RETURNING * INTO invoice;
 UPDATE public.card_units SET reserved_order_id=new_order WHERE id=unit_id;
 RETURN to_jsonb(invoice);
END $$;
REVOKE ALL ON FUNCTION public.create_crypto_invoice(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_crypto_invoice(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.fulfill_crypto_invoice(p_order_id uuid, p_transaction_ref text, p_paid_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invoice public.payment_invoices; unit public.card_units; current_status public.order_status;
BEGIN
 SELECT * INTO invoice FROM public.payment_invoices WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF invoice.transaction_ref IS NOT NULL AND invoice.transaction_ref <> p_transaction_ref THEN RAISE EXCEPTION 'Invoice already paid'; END IF;
 IF p_paid_at<invoice.created_at OR p_paid_at>invoice.expires_at THEN RAISE EXCEPTION 'Payment outside invoice window'; END IF;
 SELECT status INTO current_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF current_status='completed' THEN RETURN true; END IF;
 IF current_status='failed' THEN RETURN false; END IF;
 UPDATE public.payment_invoices SET transaction_ref=p_transaction_ref,paid_at=p_paid_at,verification_state='paid',last_error=NULL WHERE order_id=p_order_id;
 SELECT * INTO unit FROM public.card_units WHERE reserved_order_id=p_order_id AND delivered_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.card_units SET delivered_at=now() WHERE id=unit.id;
 UPDATE public.orders SET status='completed',transaction_hash=p_transaction_ref,delivery_details=unit.delivery_details WHERE id=p_order_id;
 UPDATE public.payment_invoices SET verification_state='completed' WHERE order_id=p_order_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.fulfill_crypto_invoice(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_crypto_invoice(uuid,text,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.sync_manual_payment_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status<>'completed' THEN
   UPDATE public.card_units SET delivered_at=coalesce(delivered_at,now()) WHERE reserved_order_id=NEW.id;
   UPDATE public.payment_invoices SET verification_state='completed' WHERE order_id=NEW.id;
 ELSIF NEW.status='failed' AND OLD.status<>'failed' THEN
   UPDATE public.payment_invoices SET verification_state='review' WHERE order_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_manual_payment_resolution AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_manual_payment_resolution();