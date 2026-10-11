-- Tamanho da embalagem individual (dose) dos produtos perecíveis do Catálogo, a partir da coluna 'Embalagem' das listas lista-*.csv.
-- Gerado por scripts/generate-pack-sizes.js — 367 produtos (doses individuais de iogurte, bebida e queijo fresco). Só preenche linhas sem package_quantity.
-- Corre isto no SQL Editor do Supabase. Pode correr-se mais do que uma vez (não sobrescreve nada).

update food_products set package_quantity = 163, package_unit = 'ml' where ean = '22006820' and package_quantity is null; -- Iogurte líquido magro de morango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '22065339' and package_quantity is null; -- Pudim flan sabor baunilha
update food_products set package_quantity = 150, package_unit = 'g' where ean = '22065377' and package_quantity is null; -- Iogurte estilo grego natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '24068598' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '24069076' and package_quantity is null; -- Iogurte estilo grego stracciatella
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '4068706690570' and package_quantity is null; -- Bebida láctea proteica
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4068428038698' and package_quantity is null; -- Iogurte proteico de morango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4061458214087' and package_quantity is null; -- Iogurte com fruta de pêssego e maracujá
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4068706790164' and package_quantity is null; -- Skyr proteico de mirtilo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4068263001857' and package_quantity is null; -- Iogurte sem lactose natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710337576' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710335510' and package_quantity is null; -- Mozzarella di bufala campana DOP
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710440634' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8436537300238' and package_quantity is null; -- Bifidus com muesli e fibras
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8432022001703' and package_quantity is null; -- Skyr de morango
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002065735' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002105844' and package_quantity is null; -- Queijo fresco meio-gordo sem lactose
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601002106247' and package_quantity is null; -- Bebida de soja
update food_products set package_quantity = 158, package_unit = 'ml' where ean = '5601002109859' and package_quantity is null; -- Iogurte líquido de morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002061829' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002104861' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002061775' and package_quantity is null; -- Iogurte magro
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601002120090' and package_quantity is null; -- Queijo fresco magro
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8432022001925' and package_quantity is null; -- Sobremesa láctea sabor a amendoim
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002123626' and package_quantity is null; -- Queijo de cabra fresco
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312507628' and package_quantity is null; -- Iogurte Natural Meio-Gordo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601312502586' and package_quantity is null; -- Natural
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5600954500455' and package_quantity is null; -- Bebida biológica aveia
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5600954500493' and package_quantity is null; -- Bebida Biológica à base de Arroz e Amêndoa
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312505310' and package_quantity is null; -- Mythos Iogurte Estilo Grego Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312304517' and package_quantity is null; -- Mozzarella de Vaca
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312512059' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312516293' and package_quantity is null; -- Super Breakfast Maçã Aveia Canela
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312305132' and package_quantity is null; -- Mozzarella di Bufala Campana D.O.P.
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312305002' and package_quantity is null; -- Queijo Fresco -60% Gordura*
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312513513' and package_quantity is null; -- Skyr Aroma Morango
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312307082' and package_quantity is null; -- Queijo Fresco Magro
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5600954500417' and package_quantity is null; -- Bebida biológica arroz
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312303657' and package_quantity is null; -- Queijo Fresco
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312504559' and package_quantity is null; -- Frutos Vermelhos
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312515678' and package_quantity is null; -- Bifidus triple 0%
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503347' and package_quantity is null; -- Mythos Iogurte estilo Grego Maracujá
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503958' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Stracciatella
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312304982' and package_quantity is null; -- Queijo fresco Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312305989' and package_quantity is null; -- Burrata di Bufala
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312512462' and package_quantity is null; -- Manga Papaia
update food_products set package_quantity = 60, package_unit = 'g' where ean = '5601312503163' and package_quantity is null; -- Petit Queijinho Morango Morango Banana
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312508465' and package_quantity is null; -- Leite Meio-Gordo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5600954502497' and package_quantity is null; -- Natural Magro
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312511670' and package_quantity is null; -- Bebida de Amêndoa
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312507598' and package_quantity is null; -- Natural Açucarado
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312140931' and package_quantity is null; -- Flan Baunilha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503941' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Baunilha
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312091806' and package_quantity is null; -- 100% Sumo Pera Rocha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312306252' and package_quantity is null; -- Mozzarella di Bufala Campana D.O.P. Mini
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312304524' and package_quantity is null; -- Queijo Mozzarella -30% Gordura*
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503606' and package_quantity is null; -- Iogurte Aroma Coco
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312307075' and package_quantity is null; -- Queijo Fresco Tradicional Meio-Gordo
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312505082' and package_quantity is null; -- Cereais Integrais Bifidus
update food_products set package_quantity = 160, package_unit = 'ml' where ean = '5601312502791' and package_quantity is null; -- Melancia Melão
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312513490' and package_quantity is null; -- Skyr Aroma Frutos do Bosque
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312504214' and package_quantity is null; -- Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312508830' and package_quantity is null; -- Iogurte cereais mel e frutos secos
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503330' and package_quantity is null; -- Mythos Iogurte estilo Grego Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503965' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Maçã Canela
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312513070' and package_quantity is null; -- Mythos Iogurte estilo Grego manga
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312091837' and package_quantity is null; -- Néctar Maracujá Maçã e Manga
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312505860' and package_quantity is null; -- Skyr Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312509578' and package_quantity is null; -- Skyr Mirtilo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312509622' and package_quantity is null; -- SKYR Coco (Alto teor em proteína)
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312505891' and package_quantity is null; -- Skyr Marango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312508083' and package_quantity is null; -- Skyr Banana Canela
update food_products set package_quantity = 155, package_unit = 'ml' where ean = '5601312504337' and package_quantity is null; -- Frutos Vermelhos
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312515449' and package_quantity is null; -- Skyr Morango Banana
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312513537' and package_quantity is null; -- Skyr Aroma Banana
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312508472' and package_quantity is null; -- Leite Magro
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312022725' and package_quantity is null; -- 100% Sumo Maçã
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312516415' and package_quantity is null; -- Leite chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503767' and package_quantity is null; -- Iogurte Bifidus
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312506225' and package_quantity is null; -- Skyr Aroma Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312506232' and package_quantity is null; -- Skyr Aroma Frutos do Bosque
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5600954500912' and package_quantity is null; -- Natural Soja
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312090175' and package_quantity is null; -- Néctar Manga e Laranja
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312508076' and package_quantity is null; -- Skyr Aroma Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5600954501896' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312510680' and package_quantity is null; -- Bebida biológica Arroz
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312512042' and package_quantity is null; -- Iogurte Aroma Frutos Vermelhos
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312306238' and package_quantity is null; -- Ricotta di Bufala
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5604260265961' and package_quantity is null; -- Leite com chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5604260280506' and package_quantity is null; -- Iogurte estilo grego stracciatella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5604260283415' and package_quantity is null; -- Frutimax de ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5604260276813' and package_quantity is null; -- Iogurte grego de amora e framboesa
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '20028237' and package_quantity is null; -- Leite meio-gordo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20047696' and package_quantity is null; -- Iogurte de fruta
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20367343' and package_quantity is null; -- Iogurte grego
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20367350' and package_quantity is null; -- Iogurte com pedaços de morango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692193' and package_quantity is null; -- Skyr de morango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692209' and package_quantity is null; -- Skyr de framboesa
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20971236' and package_quantity is null; -- Mozzarella di bufala campana DOP
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40874999' and package_quantity is null; -- Skyr to go baunilha
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875002' and package_quantity is null; -- Skyr to go morango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875019' and package_quantity is null; -- Skyr to go mirtilo
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875026' and package_quantity is null; -- Skyr to go baunilha
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875033' and package_quantity is null; -- Skyr to go morango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875040' and package_quantity is null; -- Skyr to go mirtilo
update food_products set package_quantity = 170, package_unit = 'g' where ean = '40881348' and package_quantity is null; -- Iogurte líquido açucarado de morango e banana
update food_products set package_quantity = 170, package_unit = 'g' where ean = '40881454' and package_quantity is null; -- Iogurte líquido
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489114963' and package_quantity is null; -- Skyr
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489733591' and package_quantity is null; -- Iogurte Linea 0%
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489090069' and package_quantity is null; -- Iogurte natural açucarado sem lactose
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4056489516040' and package_quantity is null; -- Iogurte de morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '4056489011828' and package_quantity is null; -- Iogurte natural açucarado sem lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489996828' and package_quantity is null; -- Pudim proteico de baunilha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489507840' and package_quantity is null; -- Pudim de café colombiano
update food_products set package_quantity = 100, package_unit = 'g' where ean = '4056489110101' and package_quantity is null; -- Flan de baunilha e caramelo
update food_products set package_quantity = 90, package_unit = 'g' where ean = '4335619082083' and package_quantity is null; -- Petit to go de banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489095637' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 170, package_unit = 'g' where ean = '4056489011835' and package_quantity is null; -- Iogurte de morango sem lactose
update food_products set package_quantity = 150, package_unit = 'ml' where ean = '4056489181415' and package_quantity is null; -- Shot biológico de gengibre e curcuma
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000510501' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000511676' and package_quantity is null; -- Mousse de queijo com alho e ervas finas
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000213631' and package_quantity is null; -- Iogurte sabor coco 0%
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000213105' and package_quantity is null; -- Iogurtes 0% sabores
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001040337' and package_quantity is null; -- Bifidus 0% probióticos kiwi
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001036606' and package_quantity is null; -- Iogurte 0,0 sabores
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001007897' and package_quantity is null; -- Iogurtes sabores
update food_products set package_quantity = 130, package_unit = 'g' where ean = '8402001016547' and package_quantity is null; -- Frutas com iogurte
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000213020' and package_quantity is null; -- Iogurte sabor stracciatella
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '8402001000836' and package_quantity is null; -- Batido sabor morango
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514455' and package_quantity is null; -- Queijo fresco sem lactose
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000201461' and package_quantity is null; -- Iogurte de morango sem lactose
update food_products set package_quantity = 150, package_unit = 'ml' where ean = '8480000212375' and package_quantity is null; -- Iogurte líquido de ananás e coco
update food_products set package_quantity = 85, package_unit = 'g' where ean = '8480000514349' and package_quantity is null; -- Queijo fresco magro
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000212535' and package_quantity is null; -- Bifidus kiwi e framboesa
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000212429' and package_quantity is null; -- Iogurte sabor lima-limão
update food_products set package_quantity = 120, package_unit = 'g' where ean = '8480000210616' and package_quantity is null; -- Sobremesa de chocolate com proteínas
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000211200' and package_quantity is null; -- Maracujá
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001010484' and package_quantity is null; -- Iogurte com proteínas stracciatella 0%
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000212412' and package_quantity is null; -- Iogurte sabor morango e banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000213358' and package_quantity is null; -- Iogurte sem lactose tropical
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000679802' and package_quantity is null; -- Sobremesa de proteínas chocolate e natas
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514431' and package_quantity is null; -- Queijo fresco light
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514417' and package_quantity is null; -- Queijo fresco natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000211989' and package_quantity is null; -- Iogurtes sabor banana
update food_products set package_quantity = 130, package_unit = 'g' where ean = '5603697270937' and package_quantity is null; -- Sobremesa vegetal de coco
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601050206791' and package_quantity is null; -- Iogurte de banana, morango e tutti frutti
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601048534240' and package_quantity is null; -- Iogurte aromatizado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017236654' and package_quantity is null; -- Queijo Fresco
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017175892' and package_quantity is null; -- Queijo fresco sem lactose
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017236661' and package_quantity is null; -- Queijo fresco 0% gordura
update food_products set package_quantity = 140, package_unit = 'g' where ean = '5603722520570' and package_quantity is null; -- Quark proteico natural
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5603729555698' and package_quantity is null; -- Queijo fresco meio-gordo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5608671000203' and package_quantity is null; -- Queijo fresco de cabra
update food_products set package_quantity = 100, package_unit = 'g' where ean = '8437012799318' and package_quantity is null; -- Queijo fresco de cabra Bioburgos
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8433329072205' and package_quantity is null; -- Queijo fresco tipo Burgos 0% gordura
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8435257033709' and package_quantity is null; -- Iogurte de chocolate
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8435257032528' and package_quantity is null; -- Iogurte de chocolate
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8424818216071' and package_quantity is null; -- Queijo fresco Burgos 0% gordura
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017057082' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017730626' and package_quantity is null; -- Queijo fresco 0% gordura
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017211200' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017014122' and package_quantity is null; -- Iogurte Líquido Frutos Tropicais
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017104052' and package_quantity is null; -- Iogurte Líquido Morango Banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017107978' and package_quantity is null; -- Iogurte Líquido Lima Limão
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017294982' and package_quantity is null; -- Iogurte Líquido Morango
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017294999' and package_quantity is null; -- Iogurte Líquido Banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017037008' and package_quantity is null; -- Iogurte magro de morango e kiwi
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480017152299' and package_quantity is null; -- Iogurte grego com mel
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227048193' and package_quantity is null; -- Queijo fresco meio-gordo sem lactose
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601227019599' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227018745' and package_quantity is null; -- Queijo fresco light
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601227017595' and package_quantity is null; -- Iogurte magro de pêssego
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601227019582' and package_quantity is null; -- Iogurte aroma de coco
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601227030785' and package_quantity is null; -- Pudim de baunilha com molho de caramelo
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227018738' and package_quantity is null; -- Queijo Fresco meio gordo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503798' and package_quantity is null; -- Yogurt cereals
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047010853' and package_quantity is null; -- Pudim Proteico Sabor a Caramelo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011584' and package_quantity is null; -- Iogurte Ananás Magro Pedaços
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047019771' and package_quantity is null; -- Pudim Proteico Sabor a Caffe Latte
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047007532' and package_quantity is null; -- Iogurte Grego Magro Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011607' and package_quantity is null; -- Iogurte Mirtilo Magro Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011966' and package_quantity is null; -- Iogurte Natural Magro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011591' and package_quantity is null; -- Iogurte Cereais Magro Pedaços
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021248' and package_quantity is null; -- Iogurte Proteína Magro Bolacha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012178' and package_quantity is null; -- Iogurte Pêssego Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047010891' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047010983' and package_quantity is null; -- Estilo Skyr Islandês Maracujá
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047017951' and package_quantity is null; -- Pudim Proteico Sabor a Baunilha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011614' and package_quantity is null; -- Iogurte Morango Magro Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047001271' and package_quantity is null; -- Iogurte Natural Probióticos#
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009943647' and package_quantity is null; -- Queijo Mozzarella Pingo Doce de Leite de Búfala
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009993475' and package_quantity is null; -- Leite Chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011164' and package_quantity is null; -- Iogurte Coco Magro Aroma
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047016473' and package_quantity is null; -- Pudim de Chia
update food_products set package_quantity = 163, package_unit = 'ml' where ean = '5607047016770' and package_quantity is null; -- Magro Maracujá & Curcuma
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047018118' and package_quantity is null; -- Aveia com cacau
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009988914' and package_quantity is null; -- Burrata com Leite de Búfala
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009986774' and package_quantity is null; -- Queijo Mozzarela Mini
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047017197' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 60, package_unit = 'g' where ean = '5601009921799' and package_quantity is null; -- Petit Suisse Framboesa, Alperce e Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974320' and package_quantity is null; -- Iogurte morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047001165' and package_quantity is null; -- Iogurte Natural Líquido
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047010037' and package_quantity is null; -- Sem Lactose Magro
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047015612' and package_quantity is null; -- Magro Aroma Morango & Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011850' and package_quantity is null; -- Iogurte Frutos Vermelhos Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012086' and package_quantity is null; -- Iogurte Morango Magro Aroma
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047019788' and package_quantity is null; -- Pudim Proteico Sabor a Chocolate e Avelã
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047005996' and package_quantity is null; -- Super Smoothie vitamin love Manga Goji
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601009964826' and package_quantity is null; -- Queijo Fresco Magro com leite de Vaca
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011843' and package_quantity is null; -- Iogurte Morango Pedaços
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009993581' and package_quantity is null; -- Leite Achocolatado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011874' and package_quantity is null; -- Iogurte Ananás Pedaços
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601009964857' and package_quantity is null; -- Flan Baunilha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011638' and package_quantity is null; -- Iogurte Morango Aroma
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009978809' and package_quantity is null; -- Queijo Fresco Light#
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047002919' and package_quantity is null; -- Iogurte Magro Morango e Cereais
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012062' and package_quantity is null; -- Iogurte Biscuit Cremoso
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047010044' and package_quantity is null; -- Leite UHT Magro
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984923' and package_quantity is null; -- Iogurte Magro Aroma Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012055' and package_quantity is null; -- Iogurte Natural Açucarado Cremoso
update food_products set package_quantity = 60, package_unit = 'g' where ean = '5601009964543' and package_quantity is null; -- Mousse de Chocolate
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047018385' and package_quantity is null; -- Chia Maçã Manga Banana Maracujá Smoothie+
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009972265' and package_quantity is null; -- Queijo Fresco sem Lactose
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047020425' and package_quantity is null; -- Queijo fresco cabra
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047023136' and package_quantity is null; -- Quark Baunilha Proteína
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047023143' and package_quantity is null; -- Quark Framboesa Proteína
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692230' and package_quantity is null; -- Skyr Natural
update food_products set package_quantity = 110, package_unit = 'ml' where ean = '56052954' and package_quantity is null; -- Uma laranja
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312512530' and package_quantity is null; -- Leite com sabor a Chocolate
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312515050' and package_quantity is null; -- Leite com Chocolate
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601050036619' and package_quantity is null; -- Iogurte Grego Maçã Canela
update food_products set package_quantity = 145, package_unit = 'ml' where ean = '5601050033182' and package_quantity is null; -- Sabor Tutti-Frutti
update food_products set package_quantity = 151, package_unit = 'ml' where ean = '5603722521874' and package_quantity is null; -- Iogurte Líquido Magro Frutos Tropicais
update food_products set package_quantity = 156, package_unit = 'ml' where ean = '5603722515057' and package_quantity is null; -- Magro Morango
update food_products set package_quantity = 156, package_unit = 'ml' where ean = '5603722515095' and package_quantity is null; -- Magro Morango Kiwi
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601050031775' and package_quantity is null; -- Iogurte Grego Natural
update food_products set package_quantity = 156, package_unit = 'ml' where ean = '5603722515972' and package_quantity is null; -- Magro Frutos Silvestres
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5603722518423' and package_quantity is null; -- Iogurte com Pedaços de Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503514' and package_quantity is null; -- Iogurte Aroma Pack Poupança
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312512707' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Avelã Chocolate
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312504696' and package_quantity is null; -- Bolacha
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601158401746' and package_quantity is null; -- Iogurte com Pedaços Sem Lactose Morango
update food_products set package_quantity = 150, package_unit = 'ml' where ean = '5601312501558' and package_quantity is null; -- Iogurte líquido morango banana
update food_products set package_quantity = 150, package_unit = 'ml' where ean = '5601312501534' and package_quantity is null; -- Iogurte líquido morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312145493' and package_quantity is null; -- Pedaços
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312514497' and package_quantity is null; -- Mythos Iogurte estilo Grego Melão
update food_products set package_quantity = 72, package_unit = 'g' where ean = '5603722516191' and package_quantity is null; -- Queijo Fresco Magro
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601098444445' and package_quantity is null; -- Queijo Fresco Cabra
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312305033' and package_quantity is null; -- Queijo fresco Meio gordo
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312306108' and package_quantity is null; -- Queijo Fresco de Ovelha
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312513636' and package_quantity is null; -- + Proteína Mousse Sabor Baunilha
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5600954502541' and package_quantity is null; -- Mythos Sensação Estilo Grego Stracciatella
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601050037418' and package_quantity is null; -- Natur Pêssego e Maracujá
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312511458' and package_quantity is null; -- + Proteína Aroma Baunilha
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312142898' and package_quantity is null; -- Leite com Chocolate
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047001653' and package_quantity is null; -- Sem Lactose Meio Gordo
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047007310' and package_quantity is null; -- Sem Lactose Achocolatado
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009937103' and package_quantity is null; -- Leite UHT Meio Gordo
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601050036541' and package_quantity is null; -- Iogurte Grego Natural Super Preço
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601050023107' and package_quantity is null; -- Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4000980551314' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 155, package_unit = 'g' where ean = '5603722521225' and package_quantity is null; -- Iogurte Líquido Magro Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011867' and package_quantity is null; -- Iogurte Cereais Pedaços
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009977505' and package_quantity is null; -- Iogurte Líquido Cremoso Frutos Vermelhos
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021255' and package_quantity is null; -- Iogurte Proteína Magro Coco Sem Lactose
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974337' and package_quantity is null; -- Iogurte Morango Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011621' and package_quantity is null; -- Iogurte Coco Aroma
update food_products set package_quantity = 158, package_unit = 'ml' where ean = '5607047001288' and package_quantity is null; -- Iogurte Natural Líquido Probióticos
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047008805' and package_quantity is null; -- Estilo Grego caramelo salgado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009921874' and package_quantity is null; -- Iogurte cremoso com Pedaços no Fundo de Amora
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047015605' and package_quantity is null; -- Magro Aroma Morango & Banana
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009976928' and package_quantity is null; -- Iogurte Baunilha
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047015582' and package_quantity is null; -- Magro Aroma Frutos Vermelhos
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047003107' and package_quantity is null; -- Morango e Cereais Sem Lactose
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021217' and package_quantity is null; -- Iogurte Proteína Magro Baunilha Sem Lactose
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009982363' and package_quantity is null; -- Iogurte Magro Frutos Vermelhos
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984930' and package_quantity is null; -- Iogurte Magro aroma Tropical
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991792' and package_quantity is null; -- Iogurte sem Lactose Cereais
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009989065' and package_quantity is null; -- Iogurte Pedaços Magro Mirtilo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991761' and package_quantity is null; -- Iogurte sem Lactose Natural
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984916' and package_quantity is null; -- Iogurte Magro aroma Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009928989' and package_quantity is null; -- Iogurte Magro Natural
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8435257018034' and package_quantity is null; -- Magro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047008522' and package_quantity is null; -- Iogurte Proteico Magro cremoso Manga e Acerola
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011652' and package_quantity is null; -- Iogurte Banana Aroma
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047017289' and package_quantity is null; -- Iogurte sem lactose magro
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009988990' and package_quantity is null; -- Iogurte Magro Melancia
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5603722496516' and package_quantity is null; -- Fruta batida banana, laranja e bolacha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009986620' and package_quantity is null; -- Iogurte Grego Stracciatella
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009986743' and package_quantity is null; -- Iogurte Magro aroma Limão Laranja
update food_products set package_quantity = 230, package_unit = 'g' where ean = '5601009999040' and package_quantity is null; -- Manga Iogurte Líquido com Alto teor em Proteína 18 g por Garrafa
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047002926' and package_quantity is null; -- Iogurte Morango e Cereais Magro
update food_products set package_quantity = 230, package_unit = 'g' where ean = '5601009999033' and package_quantity is null; -- Iogurte Líquido com Alto teor em Proteína Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011645' and package_quantity is null; -- Iogurte Tropical Aroma
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601009936984' and package_quantity is null; -- Morango
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991785' and package_quantity is null; -- Iogurte sem Lactose Pedaços Ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009987535' and package_quantity is null; -- Iogurte Grego Lima Limão
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047016763' and package_quantity is null; -- Magro Maracujá & Curcuma
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009921911' and package_quantity is null; -- Iogurte Natural Batido com Açúcar
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012079' and package_quantity is null; -- Iogurte Baunilha Cremoso
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009962143' and package_quantity is null; -- Bifidus Natural
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047019351' and package_quantity is null; -- Iogurte Cremoso Café
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974290' and package_quantity is null; -- Iogurte Morango Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047008812' and package_quantity is null; -- Estilo Grego Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009996483' and package_quantity is null; -- Estilo Grego banana e stracciatella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009989041' and package_quantity is null; -- Iogurte Aroma Tropical
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012048' and package_quantity is null; -- Iogurte Morango e Nozes Cremoso
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009976683' and package_quantity is null; -- Iogurte Pedaços Magro Ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009929139' and package_quantity is null; -- Iogurte Aroma Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047019344' and package_quantity is null; -- Iogurte Cremoso Cookie
update food_products set package_quantity = 149, package_unit = 'ml' where ean = '5601050030396' and package_quantity is null; -- Stracciadictive
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601050029963' and package_quantity is null; -- Very strawberry morango
update food_products set package_quantity = 175, package_unit = 'ml' where ean = '5603722512698' and package_quantity is null; -- Momentos Refrescantes Baobá Cooler
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009992034' and package_quantity is null; -- Iogurte sem Lactose Maçã Magro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009996490' and package_quantity is null; -- Iogurte Grego Lima Limão
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009975792' and package_quantity is null; -- Iogurte sem Lactose Natural Açucarado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009929696' and package_quantity is null; -- Iogurte Pedaços Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009990320' and package_quantity is null; -- Petit Iogurte Tangerina, Cenoura e Mel
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009989003' and package_quantity is null; -- Iogurte Magro Melancia
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5602384000123' and package_quantity is null; -- Queijo Fresco Pasteurizado Magro
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5602384000024' and package_quantity is null; -- Queijo Fresco Pasteurizado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009950188' and package_quantity is null; -- Queijo Fresco Light
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009950171' and package_quantity is null; -- Queijo Fresco Meio Gordo
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601009980284' and package_quantity is null; -- Queijo Fresco Tradicional com leite de Vaca
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047011003' and package_quantity is null; -- Estilo Skyr Islandês Morango e Framboesa
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5603089000487' and package_quantity is null; -- Choco Power, Leite com Chocolate
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047018866' and package_quantity is null; -- Pudim de Semolina Proteica Sabor a Chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047020326' and package_quantity is null; -- Iogurte Grego Maracujá
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009990016' and package_quantity is null; -- Iogurte Morango e Framboesa Estilo Skyr Islandês
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047011010' and package_quantity is null; -- Estilo Skyr Islandês Kiwi e Spirulina
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009987542' and package_quantity is null; -- Iogurte Maracujá Estilo Skyr Islandês
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009986521' and package_quantity is null; -- Iogurte Natural Estilo Skyr Islandês
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012802' and package_quantity is null; -- Bifidus probióticos Espelta, Sementes e Nozes
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047015964' and package_quantity is null; -- Colagénio & Antioxidante
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012789' and package_quantity is null; -- Bifidus probióticos Quinoa e Sementes de Girassol
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601009950898' and package_quantity is null; -- Flan de Ovo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011898' and package_quantity is null; -- Sobremesa com sabor a Chocolate muito cremosa
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047018873' and package_quantity is null; -- Pudim de Semolina Proteica Sabor a Caramelo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009999118' and package_quantity is null; -- Iogurte Estilo Skyr Islandês Kiwi e Spirulina
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047069813' and package_quantity is null; -- Estilo Skyr Islandês Maracujá
update food_products set package_quantity = 117, package_unit = 'g' where ean = '5601009975747' and package_quantity is null; -- Tubitos
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009951765' and package_quantity is null; -- Sumo 100% Maçã
update food_products set package_quantity = 125, package_unit = 'ml' where ean = '5607047007976' and package_quantity is null; -- Maçã Romã Baga de Sabugueiro Limão Shot
update food_products set package_quantity = 125, package_unit = 'ml' where ean = '5607047007952' and package_quantity is null; -- Shot vitamin love Maçã, Laranja, Gengibre e Inulina
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047016640' and package_quantity is null; -- Sumo com Proteina Vegetal Frutos Vermelhos
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047012147' and package_quantity is null; -- Sumo 4 Veggie Maçã + Cenoura + Gengibre + Limão
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5601009984442' and package_quantity is null; -- Sumo Laranja Maçã de Alcobaça
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5601009951956' and package_quantity is null; -- Nectaríssimo Maracujá, Maçã e Manga
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009955985' and package_quantity is null; -- Chocolate, Bebida à Base de Soja
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047012031' and package_quantity is null; -- 5 Veggie Maçã + Cenoura + Pera + Beterraba Limão
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047013779' and package_quantity is null; -- Bebida à Base de Soja Chocolate
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047006023' and package_quantity is null; -- Linhaça uva Laranja Pêssego, Maçã Banana, Manga Maracujá Smoothie+
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009955992' and package_quantity is null; -- Original, Bebida à Base de Soja
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5607047003183' and package_quantity is null; -- Manga com Iogurte
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5607047011720' and package_quantity is null; -- Mirtilo Soja
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011904' and package_quantity is null; -- Sobremesa com sabor a Baunilha
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5601009996766' and package_quantity is null; -- Banana com Iogurte
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5607047016633' and package_quantity is null; -- Sumo com Proteína Whey Manga e Curcuma
update food_products set package_quantity = 250, package_unit = 'ml' where ean = '5601009984435' and package_quantity is null; -- Sumo Natural Maçã com Cenoura
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000860873' and package_quantity is null; -- Iogurtes 0% com fruta
update food_products set package_quantity = 175, package_unit = 'ml' where ean = '5603722512568' and package_quantity is null; -- Líquido morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489685937' and package_quantity is null; -- Iogurte proteico de coco
update food_products set package_quantity = 175, package_unit = 'g' where ean = '4056489724070' and package_quantity is null; -- Mousse Proteica Gusto Cioccolato
update food_products set package_quantity = 170, package_unit = 'g' where ean = '4056489382720' and package_quantity is null; -- Yogurt high protein
update food_products set package_quantity = 155, package_unit = 'g' where ean = '5603722521294' and package_quantity is null; -- Líquido, magro, ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8012900001317' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 140, package_unit = 'g' where ean = '5603722520532' and package_quantity is null; -- Proteína Quark Stracciatella
