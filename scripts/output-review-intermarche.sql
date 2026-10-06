-- Fase 35 — revisão dos produtos Intermarché: aprova os 28 claros (macros coerentes com as kcal, nome inequívoco).
-- Ficam pendentes: bolacha relevo com mel e coco (kcal incoerente com os macros) e cappuccino sabor baunilha latte (não é claro se os valores são do pó ou da bebida preparada).
update food_products set verification_status = 'verified', verified_at = now()
where source_type = 'open_food_facts' and verification_status = 'pending' and ean in ('5604260265961', '5604260280506', '5604260283415', '5604260276042', '5604260283422', '5604260277636', '5604260276813', '5604260162789', '5604260269877', '5604260276721', '5604260277001', '5604260276738', '5604260056552', '5604260257485', '5604260257492', '5604260270989', '5604260283828', '5604260129409', '5604260167029', '3564700883013', '3564700415085', '0560590243466', '0560120078957', '0560460655092', '0560281571120', '0560590013274', '0560560603832', '0560020049262');

update food_products set internal_note = 'Valores nutricionais do pó ou da bebida preparada? Confirmar no rótulo.' where ean = '3564700838952';
