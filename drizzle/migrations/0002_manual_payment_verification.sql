ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS txid text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_txid_unique ON public.orders (lower(txid)) WHERE txid IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_crypto_invoice(p_user_id uuid, p_card_id uuid, p_method text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE product public.cards; invoice public.payment_invoices; new_order uuid := gen_random_uuid(); cents bigint; recipient_address text;
BEGIN
 IF p_method NOT IN ('USDT-BEP20','USDT-SOLANA') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 SELECT * INTO product FROM public.cards WHERE id = p_card_id;
 IF NOT FOUND OR product.stock_status = 'out_of_stock' OR product.price_in_usd <= 0 THEN RAISE EXCEPTION 'Card unavailable'; END IF;
 SELECT i.* INTO invoice FROM public.payment_invoices i JOIN public.orders o ON o.id=i.order_id
   WHERE i.user_id=p_user_id AND o.card_id=p_card_id AND i.method=p_method AND o.status='pending' AND o.txid IS NULL LIMIT 1;
 IF FOUND THEN RETURN to_jsonb(invoice); END IF;
 IF (SELECT count(*) FROM public.orders WHERE user_id=p_user_id AND status='pending' AND txid IS NULL) >= 3 THEN RAISE EXCEPTION 'Finish an existing payment before creating another'; END IF;
 cents := round(product.price_in_usd * 100);
 recipient_address := CASE WHEN p_method='USDT-BEP20' THEN '0x35aec7E35F65ea227e49fDd321709D52Ada389E4' ELSE '3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ' END;
 INSERT INTO public.orders(id,user_id,card_id,crypto_method,transaction_hash,amount_usd) VALUES(new_order,p_user_id,p_card_id,p_method,'awaiting-payment:' || new_order,product.price_in_usd);
 INSERT INTO public.payment_invoices(order_id,user_id,method,recipient,amount_units,amount_display,memo,expires_at)
   VALUES(new_order,p_user_id,p_method,recipient_address,(cents * CASE WHEN p_method='USDT-BEP20' THEN 10000000000000000::numeric ELSE 10000::numeric END)::text,to_char(cents::numeric/100,'FM999999999990.00'),new_order::text, now() + interval '7 days') RETURNING * INTO invoice;
 RETURN to_jsonb(invoice);
END $function$;

CREATE OR REPLACE FUNCTION public.submit_payment_proof(p_order_id uuid, p_txid text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE clean text := btrim(coalesce(p_txid,''));
BEGIN
 IF length(clean) < 20 OR length(clean) > 200 OR clean !~ '^[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Enter a valid transaction hash'; END IF;
 IF EXISTS (SELECT 1 FROM public.orders WHERE lower(txid)=lower(clean) AND id<>p_order_id) THEN RAISE EXCEPTION 'This transaction hash was already submitted'; END IF;
 UPDATE public.orders SET txid=clean, transaction_hash=clean, status='pending_approval'
   WHERE id=p_order_id AND user_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or already submitted'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_payment(p_order_id uuid, p_approve boolean, p_details text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders; unit public.card_units; details text := nullif(btrim(coalesce(p_details,'')),'');
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.status='completed' THEN RAISE EXCEPTION 'Order already completed'; END IF;
 IF NOT p_approve THEN
   UPDATE public.card_units SET reserved_order_id=NULL WHERE reserved_order_id=p_order_id AND delivered_at IS NULL;
   UPDATE public.orders SET status='failed' WHERE id=p_order_id;
   RETURN;
 END IF;
 IF details IS NULL THEN
   SELECT * INTO unit FROM public.card_units WHERE reserved_order_id=p_order_id AND delivered_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN
     SELECT * INTO unit FROM public.card_units WHERE card_id=o.card_id AND reserved_order_id IS NULL AND delivered_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
   END IF;
   IF unit.id IS NULL THEN RAISE EXCEPTION 'No stored card details for this product. Enter the card details to deliver.'; END IF;
   UPDATE public.card_units SET reserved_order_id=p_order_id, delivered_at=now() WHERE id=unit.id;
   details := unit.delivery_details;
 END IF;
 UPDATE public.orders SET status='completed', delivery_details=details WHERE id=p_order_id;
END $function$;
REVOKE ALL ON FUNCTION public.resolve_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_payment(uuid, boolean, text) TO authenticated;