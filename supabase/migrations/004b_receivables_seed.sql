-- Seed: données "Reste à percevoir" initiales
-- Remplacez l'email ci-dessous par le vôtre si nécessaire
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'bouramad900@gmail.com' limit 1;
  if v_user_id is null then
    raise notice 'Utilisateur non trouvé — ignoré';
    return;
  end if;

  insert into public.receivables (user_id, activity, client, invoice_ref, amount, status, service_date, description)
  values
    (v_user_id, 'freelance', 'Palomano',          'FC2606rdDp6z_05', 68.00,  'invoiced',   '2026-06-26', null),
    (v_user_id, 'freelance', 'Evenia',             'FC2606rdDp6z_06', 197.80, 'invoiced',   '2026-06-26', null),
    (v_user_id, 'freelance', 'Palomano',           null,              37.80,  'to_invoice', '2026-06-24', 'Prestation 24/06'),
    (v_user_id, 'freelance', 'Palomano',           null,              135.30, 'to_invoice', '2026-06-27', 'Prestation 27/06 (×2)'),
    (v_user_id, 'freelance', 'Palomano',           null,              117.60, 'to_invoice', '2026-06-28', 'Prestation 28/06'),
    (v_user_id, 'freelance', 'Inventaire et Cie',  null,              88.00,  'to_invoice', '2026-06-29', 'Prestation 29/06'),
    (v_user_id, 'freelance', 'Inventaire et Cie',  null,              88.00,  'to_invoice', '2026-07-01', 'Prestation 01/07')
  on conflict do nothing;
end;
$$;
