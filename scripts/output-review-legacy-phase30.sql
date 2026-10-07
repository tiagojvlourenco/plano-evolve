-- Fase 35 — aprova os 103 produtos migrados da Fase 30 que estavam pendentes.
-- Já estavam em produção no código (revistos à mão na altura) e os macros são coerentes com as kcal.
-- Ficam pendentes 3 com valores duvidosos: Feijão verde (Compal), Iogurte grego natural (Oikos) e Rebuçados de eucalipto e mentol 0% açúcar (Hacendado).
-- (Aplicado por id; este equivalente por nome dá o mesmo resultado.)
update food_products set verification_status = 'verified', verified_at = now()
where source_type = 'legacy_phase30' and verification_status = 'pending'
  and not (name = 'Feijão verde' and brand = 'Compal')
  and not (name = 'Iogurte grego natural' and brand = 'Oikos')
  and not (name = 'Rebuçados de eucalipto e mentol 0% açúcar' and brand = 'Hacendado');
