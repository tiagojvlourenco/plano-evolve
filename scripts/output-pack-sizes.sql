-- Tamanho da embalagem individual (dose) dos produtos perecíveis do Catálogo, a partir da coluna 'Embalagem' das listas lista-*.csv.
-- Gerado por scripts/generate-pack-sizes.js — 522 produtos (doses de 10 a 200 g/ml). Só preenche linhas sem package_quantity.
-- Corre isto no SQL Editor do Supabase. Pode correr-se mais do que uma vez (não sobrescreve nada).

update food_products set package_quantity = 163, package_unit = 'ml' where ean = '22006820' and package_quantity is null; -- Iogurte líquido magro de morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '22016645' and package_quantity is null; -- Queijo fresco granulado (cottage)
update food_products set package_quantity = 100, package_unit = 'g' where ean = '22065339' and package_quantity is null; -- Pudim flan sabor baunilha
update food_products set package_quantity = 150, package_unit = 'g' where ean = '22065377' and package_quantity is null; -- Iogurte estilo grego natural
update food_products set package_quantity = 110, package_unit = 'g' where ean = '22093820' and package_quantity is null; -- Tempeh de soja marinado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '24068598' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '24069076' and package_quantity is null; -- Iogurte estilo grego stracciatella
update food_products set package_quantity = 200, package_unit = 'g' where ean = '40495156' and package_quantity is null; -- Aveia com chocolate de leite
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4047247990158' and package_quantity is null; -- Queijo cottage
update food_products set package_quantity = 200, package_unit = 'g' where ean = '2002070069886' and package_quantity is null; -- Pudim proteico de caramelo
update food_products set package_quantity = 180, package_unit = 'g' where ean = '2002070036123' and package_quantity is null; -- Iogurte de coco com mirtilos
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4068263057045' and package_quantity is null; -- Queijo de ovelha com alho negro
update food_products set package_quantity = 150, package_unit = 'g' where ean = '2002070043855' and package_quantity is null; -- Queijo cheddar em fatias
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4068428038698' and package_quantity is null; -- Iogurte proteico de morango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4061458214087' and package_quantity is null; -- Iogurte com fruta de pêssego e maracujá
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4068706790164' and package_quantity is null; -- Skyr proteico de mirtilo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4068263001857' and package_quantity is null; -- Iogurte sem lactose natural
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '3596710423903' and package_quantity is null; -- Leite de coco
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710337576' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710335510' and package_quantity is null; -- Mozzarella di bufala campana DOP
update food_products set package_quantity = 200, package_unit = 'g' where ean = '3254560171541' and package_quantity is null; -- Ponta de Brie
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8432022001710' and package_quantity is null; -- Queijo fresco cottage
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3596710440634' and package_quantity is null; -- Mozzarella
update food_products set package_quantity = 200, package_unit = 'g' where ean = '3254560321434' and package_quantity is null; -- Queijo de cabra Sainte-Maure
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5201301540768' and package_quantity is null; -- Queijo feta da Grécia
update food_products set package_quantity = 180, package_unit = 'g' where ean = '8437004770318' and package_quantity is null; -- Rolo de queijo de cabra
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8410379913924' and package_quantity is null; -- Queijo de cabra para barrar
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601002093073' and package_quantity is null; -- Natas culinárias
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8432022001703' and package_quantity is null; -- Skyr de morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002121332' and package_quantity is null; -- Queijo emmental ralado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002100214' and package_quantity is null; -- Queijo flamengo fatias
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002065735' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601002103161' and package_quantity is null; -- Requeijão de vaca
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002114631' and package_quantity is null; -- Requeijão de ovelha de Seia
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002105844' and package_quantity is null; -- Queijo fresco meio-gordo sem lactose
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601002113207' and package_quantity is null; -- Natas culinárias sem lactose
update food_products set package_quantity = 125, package_unit = 'g' where ean = '3254560028722' and package_quantity is null; -- Palets bretões de manteiga
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8410379913887' and package_quantity is null; -- Queijo para barrar sem lactose
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002108470' and package_quantity is null; -- Fiambre da perna extra fatias finas
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601002109859' and package_quantity is null; -- Iogurte líquido de morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002109095' and package_quantity is null; -- Queijo mozzarella fatias
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002121516' and package_quantity is null; -- Requeijão de ovelha de Serpa
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002061829' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002110787' and package_quantity is null; -- Queijo edam fatias
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002124531' and package_quantity is null; -- Fiambre de peito de peru fatias finas
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002118721' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002104472' and package_quantity is null; -- Queijo flamengo fatias
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002104861' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 120, package_unit = 'ml' where ean = '3274661021682' and package_quantity is null; -- Bombom sabor a natas com chocolate negro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601002061775' and package_quantity is null; -- Iogurte magro
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002115607' and package_quantity is null; -- Queijo de cabra fatias
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002115591' and package_quantity is null; -- Queijo cheddar fatias
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002114693' and package_quantity is null; -- Requeijão Serra da Estrela DOP
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002110121' and package_quantity is null; -- Queijo de cabra fresco
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601002120090' and package_quantity is null; -- Queijo fresco magro
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601002123626' and package_quantity is null; -- Queijo de cabra fresco
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002116420' and package_quantity is null; -- Queijo mozzarella ralado
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002093417' and package_quantity is null; -- Queijo edam fatias light
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601002114549' and package_quantity is null; -- Natas culinárias
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002108463' and package_quantity is null; -- Fiambre da perna extra fatias
update food_products set package_quantity = 75, package_unit = 'g' where ean = '5601002113825' and package_quantity is null; -- Fiambre da perna extra em cubos
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601002124524' and package_quantity is null; -- Fiambre de peito de frango
update food_products set package_quantity = 140, package_unit = 'g' where ean = '5601002113504' and package_quantity is null; -- Presunto 9 meses
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601002113474' and package_quantity is null; -- Fiambre da perna extra fatias
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312507628' and package_quantity is null; -- Iogurte Natural Meio-Gordo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601312106791' and package_quantity is null; -- Super Breakfast Maçã, Quark, Morango, Banana e Aveia
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306399' and package_quantity is null; -- Fiambre Perna Extra
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601312182832' and package_quantity is null; -- Húmus Clássico
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312505310' and package_quantity is null; -- Mythos Iogurte Estilo Grego Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312512059' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312147169' and package_quantity is null; -- Queijo Cabra Fatiado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306832' and package_quantity is null; -- Queijo Gouda
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306795' and package_quantity is null; -- Queijo Flamengo Fatiado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312305002' and package_quantity is null; -- Queijo Fresco -60% Gordura*
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312103004' and package_quantity is null; -- Molho de Soja Continente
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312513513' and package_quantity is null; -- Skyr Aroma Morango
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312307082' and package_quantity is null; -- Queijo Fresco Magro
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307471' and package_quantity is null; -- Presunto Serrano
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312303657' and package_quantity is null; -- Queijo Fresco
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312303503' and package_quantity is null; -- Queijo Flamengo Fatiado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306405' and package_quantity is null; -- Fiambre da Perna Extra Fatias Finíssimas
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312306863' and package_quantity is null; -- Queijo Cheddar
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312139072' and package_quantity is null; -- Molho Bechamel
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307167' and package_quantity is null; -- Queijo Mozzarella
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307433' and package_quantity is null; -- Queijo Feta DOP
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312306825' and package_quantity is null; -- Queijo Emmental
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306382' and package_quantity is null; -- Fiambre Pá
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503347' and package_quantity is null; -- Mythos Iogurte estilo Grego Maracujá
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503958' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Stracciatella
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601312182849' and package_quantity is null; -- Húmus Beterraba
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312304982' and package_quantity is null; -- Queijo fresco Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307013' and package_quantity is null; -- Queijo Flamengo Fatiado
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307488' and package_quantity is null; -- Presunto
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312305958' and package_quantity is null; -- Queijo Brie
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312065500' and package_quantity is null; -- Palitos de Chocolate de Leite
update food_products set package_quantity = 175, package_unit = 'g' where ean = '5601312002833' and package_quantity is null; -- Presunto
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312303954' and package_quantity is null; -- Queijo da Ilha Ralado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312305156' and package_quantity is null; -- Queijo Grana Padano
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312508465' and package_quantity is null; -- Leite Meio-Gordo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601312307297' and package_quantity is null; -- Beira Baixa Presunto
update food_products set package_quantity = 130, package_unit = 'g' where ean = '5601312101215' and package_quantity is null; -- Cones De Milho Queijo E Bacon
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503941' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Baunilha
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312091806' and package_quantity is null; -- 100% Sumo Pera Rocha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306849' and package_quantity is null; -- Fiambre Pá
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312306252' and package_quantity is null; -- Mozzarella di Bufala Campana D.O.P. Mini
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503606' and package_quantity is null; -- Iogurte Aroma Coco
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312100157' and package_quantity is null; -- Tempero de Sumo de Limão
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312307075' and package_quantity is null; -- Queijo Fresco Tradicional Meio-Gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307204' and package_quantity is null; -- Queijo para Massas
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312306207' and package_quantity is null; -- Requeijão Magro -30% Gordura*
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312513490' and package_quantity is null; -- Skyr Aroma Frutos do Bosque
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307198' and package_quantity is null; -- Queijo para Gratinar Flamengo Emmental
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601312182825' and package_quantity is null; -- Húmus Oriental
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601312049630' and package_quantity is null; -- Pota e Polvo em Molho de Tomate
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307211' and package_quantity is null; -- Queijo para Pizza
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503330' and package_quantity is null; -- Mythos Iogurte estilo Grego Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503965' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Maçã Canela
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306467' and package_quantity is null; -- Fiambre Perna Extra
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312513070' and package_quantity is null; -- Mythos Iogurte estilo Grego manga
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312067863' and package_quantity is null; -- Molho Piripíri
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312304487' and package_quantity is null; -- Queijo fatiado Gouda
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312304012' and package_quantity is null; -- Queijo Ralado Clássico
update food_products set package_quantity = 130, package_unit = 'g' where ean = '5601312304319' and package_quantity is null; -- Queijo fresco de cabra
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312505860' and package_quantity is null; -- Skyr Natural
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312509578' and package_quantity is null; -- Skyr Mirtilo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312509622' and package_quantity is null; -- SKYR Coco (Alto teor em proteína)
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312505891' and package_quantity is null; -- Skyr Marango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307440' and package_quantity is null; -- Queijo para Pizza -30% Gordura Mozzarella
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312508083' and package_quantity is null; -- Skyr Banana Canela
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312515449' and package_quantity is null; -- Skyr Morango Banana
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312513537' and package_quantity is null; -- Skyr Aroma Banana
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312508472' and package_quantity is null; -- Leite Magro
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312022725' and package_quantity is null; -- 100% Sumo Maçã
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503767' and package_quantity is null; -- Iogurte Bifidus
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312506225' and package_quantity is null; -- Skyr Aroma Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312506232' and package_quantity is null; -- Skyr Aroma Frutos do Bosque
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312508076' and package_quantity is null; -- Skyr Aroma Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5600954501896' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312512042' and package_quantity is null; -- Iogurte Aroma Frutos Vermelhos
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312103769' and package_quantity is null; -- Crêpes Dentelle Chocolate de Leite
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312306238' and package_quantity is null; -- Ricotta di Bufala
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601312105244' and package_quantity is null; -- Paté Morcela da Beira e Maçã Reineta
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601312105237' and package_quantity is null; -- Paté com Mel
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601312105220' and package_quantity is null; -- Paté com Caça
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307723' and package_quantity is null; -- Queijo Curado di Bufala
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5604260265961' and package_quantity is null; -- Leite com chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5604260280506' and package_quantity is null; -- Iogurte estilo grego stracciatella
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5604260276813' and package_quantity is null; -- Iogurte grego de amora e framboesa
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '20026714' and package_quantity is null; -- Natas para culinária
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '20028237' and package_quantity is null; -- Leite meio-gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20047214' and package_quantity is null; -- Mozzarella ralada
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20047696' and package_quantity is null; -- Iogurte de fruta
update food_products set package_quantity = 160, package_unit = 'g' where ean = '20101411' and package_quantity is null; -- Queijo fresco natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20103286' and package_quantity is null; -- Queijo creme gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20131968' and package_quantity is null; -- Queijo cottage light
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20211318' and package_quantity is null; -- Tortilla rolls crocantes de queijo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20274146' and package_quantity is null; -- Peito de peru fatiado finíssimo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20317041' and package_quantity is null; -- Queijo flamengo dos Açores light
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20367343' and package_quantity is null; -- Iogurte grego
update food_products set package_quantity = 125, package_unit = 'g' where ean = '20367350' and package_quantity is null; -- Iogurte com pedaços de morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20468828' and package_quantity is null; -- Queijo flamengo dos Açores ralado
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692193' and package_quantity is null; -- Skyr de morango
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692209' and package_quantity is null; -- Skyr de framboesa
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20703967' and package_quantity is null; -- Queijo de cabra curado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20757809' and package_quantity is null; -- Húmus clássico
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20810405' and package_quantity is null; -- Húmus picante com pimento vermelho
update food_products set package_quantity = 180, package_unit = 'g' where ean = '20987435' and package_quantity is null; -- Queijo fresco batido de pêssego e maracujá
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40874999' and package_quantity is null; -- Skyr to go baunilha
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875002' and package_quantity is null; -- Skyr to go morango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875019' and package_quantity is null; -- Skyr to go mirtilo
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875026' and package_quantity is null; -- Skyr to go baunilha
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875033' and package_quantity is null; -- Skyr to go morango
update food_products set package_quantity = 100, package_unit = 'g' where ean = '40875040' and package_quantity is null; -- Skyr to go mirtilo
update food_products set package_quantity = 170, package_unit = 'g' where ean = '40881348' and package_quantity is null; -- Iogurte líquido açucarado de morango e banana
update food_products set package_quantity = 170, package_unit = 'g' where ean = '40881454' and package_quantity is null; -- Iogurte líquido
update food_products set package_quantity = 200, package_unit = 'g' where ean = '40882017' and package_quantity is null; -- Aveia integral com chocolate de leite
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489114963' and package_quantity is null; -- Skyr
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489733591' and package_quantity is null; -- Iogurte Linea 0%
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489149996' and package_quantity is null; -- Sardinhas em molho de tomate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '4056489090069' and package_quantity is null; -- Iogurte natural açucarado sem lactose
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4056489516040' and package_quantity is null; -- Iogurte de morango
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '4056489830429' and package_quantity is null; -- Natas para culinária sem lactose
update food_products set package_quantity = 70, package_unit = 'g' where ean = '4056489049449' and package_quantity is null; -- Presunto de porco ibérico
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4056489831754' and package_quantity is null; -- Queijo de cabra
update food_products set package_quantity = 170, package_unit = 'g' where ean = '4056489011828' and package_quantity is null; -- Iogurte natural açucarado sem lactose
update food_products set package_quantity = 44, package_unit = 'g' where ean = '4056489787037' and package_quantity is null; -- Tablete de chocolate de leite com caramelo salgado
update food_products set package_quantity = 180, package_unit = 'g' where ean = '4056489490616' and package_quantity is null; -- Biobrie
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489187813' and package_quantity is null; -- Queijo cottage biológico
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489127253' and package_quantity is null; -- Feta
update food_products set package_quantity = 100, package_unit = 'g' where ean = '4056489889533' and package_quantity is null; -- Fatias de queijo proteico
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489996828' and package_quantity is null; -- Pudim proteico de baunilha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489844327' and package_quantity is null; -- Feta DOP
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489507840' and package_quantity is null; -- Pudim de café colombiano
update food_products set package_quantity = 180, package_unit = 'g' where ean = '4056489490609' and package_quantity is null; -- Queijo cremoso
update food_products set package_quantity = 170, package_unit = 'g' where ean = '4056489011835' and package_quantity is null; -- Iogurte de morango sem lactose
update food_products set package_quantity = 140, package_unit = 'g' where ean = '2800410001400' and package_quantity is null; -- Queijo estilo suíço
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000512086' and package_quantity is null; -- Queijo creme com ervas finas
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000500212' and package_quantity is null; -- Queijo de cabra
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000236210' and package_quantity is null; -- Queijo especial para gratinar
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000512123' and package_quantity is null; -- Queijo creme sem lactose
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8402001022876' and package_quantity is null; -- Molho fresco de pesto com manjericão
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '8480000103765' and package_quantity is null; -- Natas de soja
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000511676' and package_quantity is null; -- Mousse de queijo com alho e ervas finas
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000227805' and package_quantity is null; -- Creme de queijo velho tostado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000213631' and package_quantity is null; -- Iogurte sabor coco 0%
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000213105' and package_quantity is null; -- Iogurtes 0% sabores
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001036606' and package_quantity is null; -- Iogurte 0,0 sabores
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001007897' and package_quantity is null; -- Iogurtes sabores
update food_products set package_quantity = 100, package_unit = 'g' where ean = '8402001027109' and package_quantity is null; -- Aperitivo de bolinhas de queijo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000609274' and package_quantity is null; -- Queijo flamengo
update food_products set package_quantity = 130, package_unit = 'g' where ean = '8402001016547' and package_quantity is null; -- Frutas com iogurte
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000231680' and package_quantity is null; -- Requeijão light
update food_products set package_quantity = 115, package_unit = 'g' where ean = '8480000187390' and package_quantity is null; -- Lulas recheadas em molho americano
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000213020' and package_quantity is null; -- Iogurte sabor stracciatella
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8402001019425' and package_quantity is null; -- Mozzarella light para pizza
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000057815' and package_quantity is null; -- Fiambre da perna extra fatias
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514356' and package_quantity is null; -- Queijo fresco light
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514455' and package_quantity is null; -- Queijo fresco sem lactose
update food_products set package_quantity = 37, package_unit = 'ml' where ean = '8480000642462' and package_quantity is null; -- Mini natas
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000201461' and package_quantity is null; -- Iogurte de morango sem lactose
update food_products set package_quantity = 150, package_unit = 'ml' where ean = '8480000212375' and package_quantity is null; -- Iogurte líquido de ananás e coco
update food_products set package_quantity = 85, package_unit = 'g' where ean = '8480000514349' and package_quantity is null; -- Queijo fresco magro
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000058096' and package_quantity is null; -- Requeijão
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000212429' and package_quantity is null; -- Iogurte sabor lima-limão
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514332' and package_quantity is null; -- Queijo fresco meio-gordo
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8402001010484' and package_quantity is null; -- Iogurte com proteínas stracciatella 0%
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000212412' and package_quantity is null; -- Iogurte sabor morango e banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480000213358' and package_quantity is null; -- Iogurte sem lactose tropical
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514202' and package_quantity is null; -- Queijo flamengo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000679802' and package_quantity is null; -- Sobremesa de proteínas chocolate e natas
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514431' and package_quantity is null; -- Queijo fresco light
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514301' and package_quantity is null; -- Queijo flamengo dos Açores
update food_products set package_quantity = 75, package_unit = 'g' where ean = '8480000138132' and package_quantity is null; -- Roditas de chocolate de leite
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514240' and package_quantity is null; -- Queijo flamengo light
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000219770' and package_quantity is null; -- Fiambre da pá fatias
update food_products set package_quantity = 90, package_unit = 'g' where ean = '8480000584311' and package_quantity is null; -- Presunto
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514226' and package_quantity is null; -- Queijo flamengo
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480000514417' and package_quantity is null; -- Queijo fresco natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514271' and package_quantity is null; -- Queijo Ilha
update food_products set package_quantity = 170, package_unit = 'g' where ean = '8480000231673' and package_quantity is null; -- Requeijão
update food_products set package_quantity = 75, package_unit = 'g' where ean = '8480000657381' and package_quantity is null; -- Calendário de advento de chocolate de leite
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000211989' and package_quantity is null; -- Iogurtes sabor banana
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480000590923' and package_quantity is null; -- Fiambre da perna extra em forno de lenha fatias finas
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000593474' and package_quantity is null; -- Fiambre da perna extra fatias
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514257' and package_quantity is null; -- Queijo curado sem lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480000514400' and package_quantity is null; -- Requeijão de Seia
update food_products set package_quantity = 100, package_unit = 'g' where ean = '90151545' and package_quantity is null; -- Camembert biológico
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601050206791' and package_quantity is null; -- Iogurte de banana, morango e tutti frutti
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017081773' and package_quantity is null; -- Queijo creme para barrar original
update food_products set package_quantity = 140, package_unit = 'g' where ean = '3073780774130' and package_quantity is null; -- Queijo fundido original
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5604661000208' and package_quantity is null; -- Requeijão de ovelha
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601048534240' and package_quantity is null; -- Iogurte aromatizado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017766892' and package_quantity is null; -- Queijo creme para barrar light
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017236654' and package_quantity is null; -- Queijo Fresco
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5602348095592' and package_quantity is null; -- Presunto reserva fatiado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017175892' and package_quantity is null; -- Queijo fresco sem lactose
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017236661' and package_quantity is null; -- Queijo fresco 0% gordura
update food_products set package_quantity = 130, package_unit = 'g' where ean = '5607778000949' and package_quantity is null; -- Queijo fresco de cabra
update food_products set package_quantity = 180, package_unit = 'g' where ean = '3523230038720' and package_quantity is null; -- Queijo de cabra e vaca em rolo (duo)
update food_products set package_quantity = 140, package_unit = 'g' where ean = '5603722520570' and package_quantity is null; -- Quark proteico natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4036300002648' and package_quantity is null; -- Queijo fresco granulado (cottage)
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5201083335361' and package_quantity is null; -- Feta grego biológico
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5603729555698' and package_quantity is null; -- Queijo fresco meio-gordo
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5608557001263' and package_quantity is null; -- Queijo de cabra
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5608671000203' and package_quantity is null; -- Queijo fresco de cabra
update food_products set package_quantity = 100, package_unit = 'g' where ean = '4104060011917' and package_quantity is null; -- Camembert de cabra biológico
update food_products set package_quantity = 100, package_unit = 'g' where ean = '8437012799318' and package_quantity is null; -- Queijo fresco de cabra Bioburgos
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4002566011397' and package_quantity is null; -- Queijo feta
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8433329072205' and package_quantity is null; -- Queijo fresco tipo Burgos 0% gordura
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8433329145367' and package_quantity is null; -- Queijo mozzarella fatiado
update food_products set package_quantity = 150.6, package_unit = 'ml' where ean = '8435257033709' and package_quantity is null; -- Iogurte de chocolate
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8435257032528' and package_quantity is null; -- Iogurte de chocolate
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8424818216071' and package_quantity is null; -- Queijo fresco Burgos 0% gordura
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017057082' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017730626' and package_quantity is null; -- Queijo fresco 0% gordura
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '8480017211200' and package_quantity is null; -- Queijo fresco
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017006516' and package_quantity is null; -- Queijo Edam fatiado
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017014122' and package_quantity is null; -- Iogurte Líquido Frutos Tropicais
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017104052' and package_quantity is null; -- Iogurte Líquido Morango Banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017107978' and package_quantity is null; -- Iogurte Líquido Lima Limão
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017294982' and package_quantity is null; -- Iogurte Líquido Morango
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017294999' and package_quantity is null; -- Iogurte Líquido Banana
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017401618' and package_quantity is null; -- Presunto serrano
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017545077' and package_quantity is null; -- Queijo Havarti fatiado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017181343' and package_quantity is null; -- Queijo Gouda biológico
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017068699' and package_quantity is null; -- Fiambre de peito de frango
update food_products set package_quantity = 160, package_unit = 'g' where ean = '8480017037008' and package_quantity is null; -- Iogurte magro de morango e kiwi
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8480017220295' and package_quantity is null; -- Queijo Flamengo Ralado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480017152299' and package_quantity is null; -- Iogurte grego com mel
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017277794' and package_quantity is null; -- Queijo curado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '8480017092410' and package_quantity is null; -- Queijo flamengo light
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601227012064' and package_quantity is null; -- Petit biscuit de chocolate de leite
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601227032482' and package_quantity is null; -- Queijo flamengo fatiado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227048193' and package_quantity is null; -- Queijo fresco meio-gordo sem lactose
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601227019599' and package_quantity is null; -- Iogurte natural
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227018745' and package_quantity is null; -- Queijo fresco light
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601227017595' and package_quantity is null; -- Iogurte magro de pêssego
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601227012477' and package_quantity is null; -- Leite com Chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601227019582' and package_quantity is null; -- Iogurte aroma de coco
update food_products set package_quantity = 22, package_unit = 'g' where ean = '5601227031812' and package_quantity is null; -- Paté de Sardinha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601227019674' and package_quantity is null; -- Fiambre da pá fatiado
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601227030785' and package_quantity is null; -- Pudim de baunilha com molho de caramelo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601227044669' and package_quantity is null; -- Queijo ralado quatro queijos
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601227020540' and package_quantity is null; -- Mozzarella ralada
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601227018738' and package_quantity is null; -- Queijo Fresco meio gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601227033021' and package_quantity is null; -- Queijo para barrar light
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047010853' and package_quantity is null; -- Pudim Proteico Sabor a Caramelo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047019481' and package_quantity is null; -- Queijo Flamengo Light#
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047008058' and package_quantity is null; -- Cottage Cheese
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009984077' and package_quantity is null; -- Queijo Fresco para Barrar light
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011584' and package_quantity is null; -- Iogurte Ananás Magro Pedaços
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009954797' and package_quantity is null; -- Queijo Fresco para Barrar natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047019771' and package_quantity is null; -- Pudim Proteico Sabor a Caffe Latte
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009956272' and package_quantity is null; -- Queijo Fresco para Barrar ervas e alho
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047007532' and package_quantity is null; -- Iogurte Grego Magro Natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009964147' and package_quantity is null; -- Queijo Mozzarella Ralado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011607' and package_quantity is null; -- Iogurte Mirtilo Magro Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011966' and package_quantity is null; -- Iogurte Natural Magro
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021248' and package_quantity is null; -- Iogurte Proteína Magro Bolacha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012178' and package_quantity is null; -- Iogurte Pêssego Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047010891' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009985562' and package_quantity is null; -- Queijo Flamengo Fatiado
update food_products set package_quantity = 17.5, package_unit = 'g' where ean = '5601009974467' and package_quantity is null; -- Triângulos de Queijo Fundido
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047010983' and package_quantity is null; -- Estilo Skyr Islandês Maracujá
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047017951' and package_quantity is null; -- Pudim Proteico Sabor a Baunilha
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011614' and package_quantity is null; -- Iogurte Morango Magro Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047001271' and package_quantity is null; -- Iogurte Natural Probióticos#
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011164' and package_quantity is null; -- Iogurte Coco Magro Aroma
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047016473' and package_quantity is null; -- Pudim de Chia
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009964154' and package_quantity is null; -- Queijo Mozzarella Fatiado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047004111' and package_quantity is null; -- Queijo Fresco para Barrar sem Lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009975372' and package_quantity is null; -- Queijo Flamengo Ralado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047013007' and package_quantity is null; -- Queijo Feta
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009986774' and package_quantity is null; -- Queijo Mozzarela Mini
update food_products set package_quantity = 130, package_unit = 'g' where ean = '5601009974726' and package_quantity is null; -- Queijo Fresco com leite de Cabra
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009993192' and package_quantity is null; -- Queijo Cheddar Fatiado
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009983322' and package_quantity is null; -- Queijo de Cabra Fatiado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047017197' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009927074' and package_quantity is null; -- Fiambre da Perna Extra
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974320' and package_quantity is null; -- Iogurte morango
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009974610' and package_quantity is null; -- Queijo Brie
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047001165' and package_quantity is null; -- Iogurte Natural Líquido
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047006276' and package_quantity is null; -- Molho de soja
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009993604' and package_quantity is null; -- Natas culinária Light**
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009927135' and package_quantity is null; -- Fiambre Fiambre da Perna Extra
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011850' and package_quantity is null; -- Iogurte Frutos Vermelhos Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012086' and package_quantity is null; -- Iogurte Morango Magro Aroma
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047019788' and package_quantity is null; -- Pudim Proteico Sabor a Chocolate e Avelã
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009958580' and package_quantity is null; -- Fiambre, Fiambre da Pá
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601009964826' and package_quantity is null; -- Queijo Fresco Magro com leite de Vaca
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5607047008911' and package_quantity is null; -- Queijo de Cabra Curado Chèvre
update food_products set package_quantity = 60, package_unit = 'g' where ean = '5607047008645' and package_quantity is null; -- Queijo Parmigiano Reggiano Ralado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047004128' and package_quantity is null; -- Queijo Edam Fatiado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011843' and package_quantity is null; -- Iogurte Morango Pedaços
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009993581' and package_quantity is null; -- Leite Achocolatado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011874' and package_quantity is null; -- Iogurte Ananás Pedaços
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011638' and package_quantity is null; -- Iogurte Morango Aroma
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009978809' and package_quantity is null; -- Queijo Fresco Light#
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047002919' and package_quantity is null; -- Iogurte Magro Morango e Cereais
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012062' and package_quantity is null; -- Iogurte Biscuit Cremoso
update food_products set package_quantity = 190, package_unit = 'g' where ean = '5607047023150' and package_quantity is null; -- Molho pesto vegan
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009933297' and package_quantity is null; -- Queijo da Ilha de São Jorge Ralado
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047010044' and package_quantity is null; -- Leite UHT Magro
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047004142' and package_quantity is null; -- Queijo Gouda Fatiado
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984923' and package_quantity is null; -- Iogurte Magro Aroma Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012055' and package_quantity is null; -- Iogurte Natural Açucarado Cremoso
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047012833' and package_quantity is null; -- Nachos com sabor a Queijo
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047009024' and package_quantity is null; -- Natas UHT para bater
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009972265' and package_quantity is null; -- Queijo Fresco sem Lactose
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009972968' and package_quantity is null; -- Queijo Flamengo sem Lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047016657' and package_quantity is null; -- Queijo Halloumi DOP
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5607047007280' and package_quantity is null; -- Queijo Grana Padano
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047020425' and package_quantity is null; -- Queijo fresco cabra
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047023136' and package_quantity is null; -- Quark Baunilha Proteína
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047023143' and package_quantity is null; -- Quark Framboesa Proteína
update food_products set package_quantity = 150, package_unit = 'g' where ean = '20692230' and package_quantity is null; -- Skyr Natural
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20922481' and package_quantity is null; -- Queijo Fatiado Flamengo dos Açores sem Lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '20922597' and package_quantity is null; -- Queijo Fatiado ilha dos Açores
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312512530' and package_quantity is null; -- Leite com sabor a Chocolate
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312515050' and package_quantity is null; -- Leite com Chocolate
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601050036619' and package_quantity is null; -- Iogurte Grego Maçã Canela
update food_products set package_quantity = 151, package_unit = 'ml' where ean = '5603722521874' and package_quantity is null; -- Iogurte Líquido Magro Frutos Tropicais
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601050031775' and package_quantity is null; -- Iogurte Grego Natural
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5603722518423' and package_quantity is null; -- Iogurte com Pedaços de Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312503514' and package_quantity is null; -- Iogurte Aroma Pack Poupança
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312512707' and package_quantity is null; -- Mythos Sensação Iogurte estilo Grego Avelã Chocolate
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601158401746' and package_quantity is null; -- Iogurte com Pedaços Sem Lactose Morango
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312501558' and package_quantity is null; -- Iogurte líquido morango banana
update food_products set package_quantity = 160, package_unit = 'g' where ean = '5601312501534' and package_quantity is null; -- Iogurte líquido morango
update food_products set package_quantity = 115, package_unit = 'g' where ean = '5601312514497' and package_quantity is null; -- Mythos Iogurte estilo Grego Melão
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601244202158' and package_quantity is null; -- Queijo de Pastagem Light
update food_products set package_quantity = 72, package_unit = 'g' where ean = '5603722516191' and package_quantity is null; -- Queijo Fresco Magro
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601098444445' and package_quantity is null; -- Queijo Fresco Cabra
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601312305033' and package_quantity is null; -- Queijo fresco Meio gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312306474' and package_quantity is null; -- Queijo Fresco para Barrar
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312305125' and package_quantity is null; -- Queijo Parmigiano Reggiano
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601312306214' and package_quantity is null; -- Requeijão de Vaca
update food_products set package_quantity = 175, package_unit = 'g' where ean = '5601312173786' and package_quantity is null; -- Queijo Fresco para barrar
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5600345760000' and package_quantity is null; -- Requeijão Serra da Estrela DOP
update food_products set package_quantity = 150, package_unit = 'g' where ean = '8437008383538' and package_quantity is null; -- Queijo creme
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312304791' and package_quantity is null; -- Feta DOP
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312303275' and package_quantity is null; -- Queijo Parmigiano Reggiano
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312303961' and package_quantity is null; -- Queijo Flamengo Ralado
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307006' and package_quantity is null; -- Requeijão de Ovelha de Azeitão
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312307037' and package_quantity is null; -- Requeijão de Ovelha de Serpa
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307150' and package_quantity is null; -- Requeijão de Ovelha de Azeitão
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601312306108' and package_quantity is null; -- Queijo Fresco de Ovelha
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601312305569' and package_quantity is null; -- Queijo Danablu IGP
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601312307228' and package_quantity is null; -- Queijo para Pratos Mexicanos
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5701638154848' and package_quantity is null; -- Cubos de Queijo com Pimenta
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601312068464' and package_quantity is null; -- Paté de campagne
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601312075929' and package_quantity is null; -- Atum Posta em Molho de Tomate e Orégãos
update food_products set package_quantity = 170, package_unit = 'ml' where ean = '5601312062677' and package_quantity is null; -- Molho Soja
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601312101413' and package_quantity is null; -- Nachos de Milho sabor a Queijo
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5601312504542' and package_quantity is null; -- Natas do Céu
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601312142898' and package_quantity is null; -- Leite com Chocolate
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009937103' and package_quantity is null; -- Leite UHT Meio Gordo
update food_products set package_quantity = 110, package_unit = 'g' where ean = '5601050036541' and package_quantity is null; -- Iogurte Grego Natural Super Preço
update food_products set package_quantity = 150, package_unit = 'g' where ean = '4000980551314' and package_quantity is null; -- Iogurte Natural
update food_products set package_quantity = 155, package_unit = 'g' where ean = '5603722521225' and package_quantity is null; -- Iogurte Líquido Magro Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009977505' and package_quantity is null; -- Iogurte Líquido Cremoso Frutos Vermelhos
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021255' and package_quantity is null; -- Iogurte Proteína Magro Coco Sem Lactose
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974337' and package_quantity is null; -- Iogurte Morango Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011621' and package_quantity is null; -- Iogurte Coco Aroma
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047001288' and package_quantity is null; -- Iogurte Natural Líquido Probióticos
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009921874' and package_quantity is null; -- Iogurte cremoso com Pedaços no Fundo de Amora
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009976928' and package_quantity is null; -- Iogurte Baunilha
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047021217' and package_quantity is null; -- Iogurte Proteína Magro Baunilha Sem Lactose
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009982363' and package_quantity is null; -- Iogurte Magro Frutos Vermelhos
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984930' and package_quantity is null; -- Iogurte Magro aroma Tropical
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991792' and package_quantity is null; -- Iogurte sem Lactose Cereais
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009989065' and package_quantity is null; -- Iogurte Pedaços Magro Mirtilo
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991761' and package_quantity is null; -- Iogurte sem Lactose Natural
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009984916' and package_quantity is null; -- Iogurte Magro aroma Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009928989' and package_quantity is null; -- Iogurte Magro Natural
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047008522' and package_quantity is null; -- Iogurte Proteico Magro cremoso Manga e Acerola
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011652' and package_quantity is null; -- Iogurte Banana Aroma
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047017289' and package_quantity is null; -- Iogurte sem lactose magro
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009988990' and package_quantity is null; -- Iogurte Magro Melancia
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009986620' and package_quantity is null; -- Iogurte Grego Stracciatella
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009986743' and package_quantity is null; -- Iogurte Magro aroma Limão Laranja
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047002926' and package_quantity is null; -- Iogurte Morango e Cereais Magro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047011645' and package_quantity is null; -- Iogurte Tropical Aroma
update food_products set package_quantity = 120, package_unit = 'g' where ean = '5601009991785' and package_quantity is null; -- Iogurte sem Lactose Pedaços Ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009987535' and package_quantity is null; -- Iogurte Grego Lima Limão
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009921911' and package_quantity is null; -- Iogurte Natural Batido com Açúcar
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012079' and package_quantity is null; -- Iogurte Baunilha Cremoso
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047019351' and package_quantity is null; -- Iogurte Cremoso Café
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974290' and package_quantity is null; -- Iogurte Morango Banana
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009989041' and package_quantity is null; -- Iogurte Aroma Tropical
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047012048' and package_quantity is null; -- Iogurte Morango e Nozes Cremoso
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009976683' and package_quantity is null; -- Iogurte Pedaços Magro Ananás
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009929139' and package_quantity is null; -- Iogurte Aroma Morango
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5607047019344' and package_quantity is null; -- Iogurte Cremoso Cookie
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009992034' and package_quantity is null; -- Iogurte sem Lactose Maçã Magro
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009996490' and package_quantity is null; -- Iogurte Grego Lima Limão
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009975792' and package_quantity is null; -- Iogurte sem Lactose Natural Açucarado
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009929696' and package_quantity is null; -- Iogurte Pedaços Morango
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5601009990320' and package_quantity is null; -- Petit Iogurte Tangerina, Cenoura e Mel
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009989003' and package_quantity is null; -- Iogurte Magro Melancia
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5602384000123' and package_quantity is null; -- Queijo Fresco Pasteurizado Magro
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5602384000024' and package_quantity is null; -- Queijo Fresco Pasteurizado
update food_products set package_quantity = 170, package_unit = 'g' where ean = '5601009974832' and package_quantity is null; -- Requeijão de Vaca
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009938810' and package_quantity is null; -- Queijo Fresco Magro com leite de Vaca
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5604661001328' and package_quantity is null; -- Requeijão de Ovelha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009985944' and package_quantity is null; -- Requeijão de Ovelha e Cabra
update food_products set package_quantity = 20, package_unit = 'g' where ean = '5601009994212' and package_quantity is null; -- Queijo Mozzarella Palitos de Queijo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009979486' and package_quantity is null; -- Queijo Emmental Ralado
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009950188' and package_quantity is null; -- Queijo Fresco Light
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009988808' and package_quantity is null; -- Queijo Fresco para Barrar
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009982684' and package_quantity is null; -- Queijo Edam
update food_products set package_quantity = 180, package_unit = 'g' where ean = '5601009974696' and package_quantity is null; -- Queijo de Cabra Curado Chèvre
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009987597' and package_quantity is null; -- Queijo Feta
update food_products set package_quantity = 62.5, package_unit = 'g' where ean = '5601009950171' and package_quantity is null; -- Queijo Fresco Meio Gordo
update food_products set package_quantity = 190, package_unit = 'g' where ean = '5604895011421' and package_quantity is null; -- Requeijão pasteurizado meio gordo
update food_products set package_quantity = 80, package_unit = 'g' where ean = '5601009980284' and package_quantity is null; -- Queijo Fresco Tradicional com leite de Vaca
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009954988' and package_quantity is null; -- Queijo Gouda com Ervas Aromáticas
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601009982790' and package_quantity is null; -- Queijo de Ovelha, Queijo Roquefort
update food_products set package_quantity = 135, package_unit = 'g' where ean = '5607047017432' and package_quantity is null; -- Queijo Brie com Trufa
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047008072' and package_quantity is null; -- Queijo Feta
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601009997206' and package_quantity is null; -- Queijo de Ovelha com Trufa
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047011003' and package_quantity is null; -- Estilo Skyr Islandês Morango e Framboesa
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5603089000487' and package_quantity is null; -- Choco Power, Leite com Chocolate
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047018866' and package_quantity is null; -- Pudim de Semolina Proteica Sabor a Chocolate
update food_products set package_quantity = 125, package_unit = 'g' where ean = '5607047020326' and package_quantity is null; -- Iogurte Grego Maracujá
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009990016' and package_quantity is null; -- Iogurte Morango e Framboesa Estilo Skyr Islandês
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047011010' and package_quantity is null; -- Estilo Skyr Islandês Kiwi e Spirulina
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009987542' and package_quantity is null; -- Iogurte Maracujá Estilo Skyr Islandês
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009986521' and package_quantity is null; -- Iogurte Natural Estilo Skyr Islandês
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009979820' and package_quantity is null; -- Natas sem Lactose
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5607047018873' and package_quantity is null; -- Pudim de Semolina Proteica Sabor a Caramelo
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009999118' and package_quantity is null; -- Iogurte Estilo Skyr Islandês Kiwi e Spirulina
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5607047069813' and package_quantity is null; -- Estilo Skyr Islandês Maracujá
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009951765' and package_quantity is null; -- Sumo 100% Maçã
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5601009980024' and package_quantity is null; -- Tempero de Sumo de Limão
update food_products set package_quantity = 200, package_unit = 'ml' where ean = '5607047006306' and package_quantity is null; -- Molho Teriyaki 200ml
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5601009983209' and package_quantity is null; -- Crepes Dentelle com Chocolate de Leite
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5601009981526' and package_quantity is null; -- Joaninhas Cobertas com Chocolate de Leite
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5607047012307' and package_quantity is null; -- Sortido Triplo Bolacha com Cobertura de Chocolate Branco • Leite • Preto
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5607047016411' and package_quantity is null; -- Florentines de Amêndoas Cobertos com Chocolate de Leite, Negro e Branco
update food_products set package_quantity = 12.5, package_unit = 'g' where ean = '5601009958511' and package_quantity is null; -- Chocokid Barritas Chocolate de Leite
update food_products set package_quantity = 35, package_unit = 'g' where ean = '5607047013113' and package_quantity is null; -- Bolitos com Pepitas de Chocolate de Leite
update food_products set package_quantity = 60, package_unit = 'g' where ean = '2659801001471' and package_quantity is null; -- Brioche de Leite 60 g *
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5607047003183' and package_quantity is null; -- Manga com Iogurte
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5601009996773' and package_quantity is null; -- Morango e Banana com Iogurte
update food_products set package_quantity = 100, package_unit = 'g' where ean = '5607047013854' and package_quantity is null; -- Gelatina Ananás com sumo de fruta
update food_products set package_quantity = 90, package_unit = 'g' where ean = '5601009996766' and package_quantity is null; -- Banana com Iogurte
update food_products set package_quantity = 23, package_unit = 'g' where ean = '5601009925674' and package_quantity is null; -- Leite creme
update food_products set package_quantity = 125, package_unit = 'g' where ean = '8480000860873' and package_quantity is null; -- Iogurtes 0% com fruta
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489199878' and package_quantity is null; -- Queijo Fatiado Flamengo dos Açores Light
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5605222030313' and package_quantity is null; -- Queijo Fresco de Vaca Pasteurizado meio gordo
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5603729555995' and package_quantity is null; -- Requeijão
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5605222040404' and package_quantity is null; -- Queijo Fresco Cabra
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489050773' and package_quantity is null; -- Requeijão
update food_products set package_quantity = 200, package_unit = 'g' where ean = '4056489685937' and package_quantity is null; -- Iogurte proteico de coco
update food_products set package_quantity = 75, package_unit = 'g' where ean = '5604925610228' and package_quantity is null; -- Cubos de Fiambre Porco
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5601002119667' and package_quantity is null; -- Mozzarella queijo ralado
update food_products set package_quantity = 150, package_unit = 'g' where ean = '5902899144368' and package_quantity is null; -- Queijo cremoso clássico
update food_products set package_quantity = 140, package_unit = 'g' where ean = '5603722520532' and package_quantity is null; -- Proteína Quark Stracciatella
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5606436561907' and package_quantity is null; -- Requeijão de Ovelha
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5602384001717' and package_quantity is null; -- Requeijão de Ovelha Azeitão
update food_products set package_quantity = 200, package_unit = 'g' where ean = '5604321031085' and package_quantity is null; -- Cem Porcento Hambúrguer Proteico Tofu e Chia
