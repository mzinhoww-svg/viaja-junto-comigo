-- =============================================================
-- Viajaly Trip — Banco completo de checklist_templates (VJT-003)
-- Aditivo: só INSERT em checklist_templates (seed de VJT-001 tinha 15
-- itens free). Adiciona 15 free (total 30), ~45 premium genéricos e os
-- packs de destino Orlando/Europa (~18 itens cada, tier premium).
-- =============================================================

-- Free: completa a lista genérica até ~30 itens (15 já existiam)
insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Visto (quando exigido) verificado e válido', 'free', 60, 6),
  ('documentos', 'Reserva de aluguel de carro impressa/salva (se aplicável)', 'free', 15, 7),
  ('documentos', 'Itinerário completo salvo offline', 'free', 7, 8),
  ('documentos', 'Documento de identidade extra (RG/CNH) além do passaporte', 'free', 7, 9),
  ('preparativos', 'Avisar operadora de celular sobre roaming', 'free', 7, 5),
  ('preparativos', 'Configurar apps de tradução offline', 'free', 7, 6),
  ('preparativos', 'Baixar mapas offline do destino', 'free', 7, 7),
  ('preparativos', 'Compartilhar itinerário com um contato de confiança', 'free', 3, 8),
  ('mala', 'Kit de primeiros socorros básico', 'free', null, 5),
  ('mala', 'Fralda e lenços umedecidos (se aplicável)', 'free', null, 6),
  ('mala', 'Óculos de sol e protetor solar', 'free', null, 7),
  ('mala', 'Fones de ouvido e entretenimento para o trajeto', 'free', null, 8),
  ('compras', 'Trava para mala', 'free', null, 3),
  ('compras', 'Necessaire de viagem', 'free', null, 4),
  ('custom', 'Revisar lista antes de fechar a mala', 'free', 1, 1);

-- Premium genérico (destino_pack null → aplica-se a qualquer destino)
insert into public.checklist_templates (tipo, titulo, tier, marco, com_crianca, min_duracao, ordem) values
  ('documentos', 'Cópia do seguro viagem impressa em inglês', 'premium', 15, null, null, 10),
  ('documentos', 'Carta de anuência para menor viajando com apenas um dos responsáveis', 'premium', 30, true, null, 11),
  ('documentos', 'Certidão de nascimento das crianças', 'premium', 30, true, null, 12),
  ('documentos', 'Carteira de vacinação internacional', 'premium', 30, null, null, 13),
  ('documentos', 'Comprovante de vínculo empregatício/renda (para vistos)', 'premium', 45, null, null, 14),
  ('documentos', 'Autorização de viagem de menor reconhecida em cartório', 'premium', 30, true, null, 15),
  ('documentos', 'Apólice de seguro viagem com cobertura esportiva', 'premium', 15, null, null, 16),
  ('documentos', 'Cópia do cartão de vacina em inglês', 'premium', 15, null, null, 17),
  ('documentos', 'Contrato de aluguel de temporada impresso', 'premium', 7, null, null, 18),
  ('documentos', 'Comprovante de reserva de passeios/ingressos', 'premium', 7, null, null, 19),
  ('documentos', 'Cópia do RG/CNH digitalizada em nuvem criptografada', 'premium', 15, null, null, 20),
  ('documentos', 'Comprovante de reserva de hotel para cada trecho da viagem', 'premium', 7, null, null, 21),
  ('preparativos', 'Contratar plano de dados internacional robusto', 'premium', 7, null, null, 9),
  ('preparativos', 'Agendar consulta pediátrica pré-viagem', 'premium', 15, true, null, 10),
  ('preparativos', 'Levar brinquedos/atividades para o trajeto', 'premium', 3, true, null, 11),
  ('preparativos', 'Testar adaptadores e carregadores antes de viajar', 'premium', 3, null, null, 12),
  ('preparativos', 'Configurar apps de câmbio em tempo real', 'premium', 7, null, null, 13),
  ('preparativos', 'Revisar seguro do carro/casa durante a ausência', 'premium', 15, null, null, 14),
  ('preparativos', 'Agendar manutenção de rotina de casa (plantas, correspondência)', 'premium', 3, null, null, 15),
  ('preparativos', 'Reservar passeios e ingressos com antecedência', 'premium', 30, null, null, 16),
  ('preparativos', 'Verificar necessidade de habilitação internacional', 'premium', 30, null, null, 17),
  ('preparativos', 'Planejar orçamento diário por categoria', 'premium', 15, null, 5, 18),
  ('preparativos', 'Organizar lista de contatos de emergência no destino', 'premium', 7, null, null, 19),
  ('preparativos', 'Verificar política de bagagem de cada companhia aérea do trajeto', 'premium', 15, null, null, 20),
  ('preparativos', 'Contratar assistência 24h em português', 'premium', 15, null, null, 21),
  ('mala', 'Roupas extras para viagens acima de 10 dias', 'premium', null, null, 10, 9),
  ('mala', 'Berço portátil ou cadeirinha de bebê', 'premium', null, true, null, 10),
  ('mala', 'Fraldas e itens de higiene infantil para toda a viagem', 'premium', null, true, null, 11),
  ('mala', 'Kit de entretenimento infantil', 'premium', null, true, null, 12),
  ('mala', 'Roupa de banho e toalha extra', 'premium', null, null, null, 13),
  ('mala', 'Sapato confortável extra para caminhadas longas', 'premium', null, null, null, 14),
  ('mala', 'Case protetor para eletrônicos', 'premium', null, null, null, 15),
  ('mala', 'Balança de mala portátil', 'premium', null, null, null, 16),
  ('mala', 'Sacos a vácuo para otimizar espaço', 'premium', null, null, null, 17),
  ('mala', 'Repelente e protetor solar de alta proteção', 'premium', null, null, null, 18),
  ('mala', 'Roupa térmica para destinos frios', 'premium', null, null, null, 19),
  ('compras', 'Mala extra para compras de volta', 'premium', null, null, 7, 5),
  ('compras', 'Seguro de bagagem adicional', 'premium', null, null, null, 6),
  ('compras', 'Itens de conveniência para bebês (fraldas, fórmula)', 'premium', null, true, null, 7),
  ('compras', 'Kit de viagem para crianças (fones, almofada de pescoço)', 'premium', null, true, null, 8),
  ('compras', 'Presentes/lembranças para quem ficou', 'premium', null, null, null, 9),
  ('compras', 'Cartão pré-pago internacional', 'premium', null, null, null, 10),
  ('custom', 'Revisão financeira intermediária da viagem', 'premium', null, null, 14, 2),
  ('custom', 'Check-in de bem-estar da família a cada 3 dias de viagem', 'premium', null, true, null, 3),
  ('custom', 'Revisão final do roteiro dia a dia antes de embarcar', 'premium', 1, null, null, 4);

-- Pack Orlando (tier premium, destino_pack = 'orlando')
insert into public.checklist_templates (tipo, titulo, tier, marco, destino_pack, ordem) values
  ('documentos', 'Ingressos dos parques comprados antecipadamente', 'premium', 30, 'orlando', 22),
  ('documentos', 'Reserva do Genie+/Lightning Lane confirmada', 'premium', 7, 'orlando', 23),
  ('documentos', 'Autorização internacional de motorista (se for alugar carro)', 'premium', 15, 'orlando', 24),
  ('documentos', 'Seguro viagem com cobertura para os EUA', 'premium', 15, 'orlando', 25),
  ('preparativos', 'Baixar o app oficial do parque (Disney/Universal) antes da viagem', 'premium', 7, 'orlando', 22),
  ('preparativos', 'Planejar roteiro dos parques dia a dia com folga para descanso', 'premium', 15, 'orlando', 23),
  ('preparativos', 'Verificar horários de abertura estendida (Early Entry)', 'premium', 7, 'orlando', 24),
  ('preparativos', 'Reservar restaurantes dos parques com antecedência', 'premium', 30, 'orlando', 25),
  ('preparativos', 'Verificar necessidade de visto/ESTA para os EUA', 'premium', 60, 'orlando', 26),
  ('mala', 'Roupa de banho e protetor solar (parques aquáticos)', 'premium', null, 'orlando', 20),
  ('mala', 'Poncho de chuva leve', 'premium', null, 'orlando', 21),
  ('mala', 'Tênis confortável extra para caminhar bastante', 'premium', null, 'orlando', 22),
  ('mala', 'Powerbank para uso o dia todo nos parques', 'premium', null, 'orlando', 23),
  ('mala', 'Adaptador de tomada 110V (se vier de país com voltagem diferente)', 'premium', null, 'orlando', 24),
  ('compras', 'Dinheiro/cartão para lanches e souvenirs dentro dos parques', 'premium', null, 'orlando', 11),
  ('compras', 'Mochila pequena permitida nos parques', 'premium', null, 'orlando', 12),
  ('custom', 'Reservar transporte do aeroporto até a hospedagem em Orlando', 'premium', 15, 'orlando', 5),
  ('custom', 'Conferir previsão do tempo dos dias de parque', 'premium', 3, 'orlando', 6);

-- Pack Europa (tier premium, destino_pack = 'europa')
insert into public.checklist_templates (tipo, titulo, tier, marco, destino_pack, ordem) values
  ('documentos', 'Seguro viagem com cobertura Schengen', 'premium', 30, 'europa', 26),
  ('documentos', 'Cópia impressa das reservas de trem/passagens intermunicipais', 'premium', 7, 'europa', 27),
  ('documentos', 'Verificar exigência de visto Schengen para o roteiro', 'premium', 60, 'europa', 28),
  ('documentos', 'Verificar documentos extras para travessia de fronteiras terrestres', 'premium', 15, 'europa', 29),
  ('preparativos', 'Planejar city pass/museus com antecedência', 'premium', 30, 'europa', 27),
  ('preparativos', 'Verificar necessidade de reserva prévia em museus/pontos turísticos', 'premium', 15, 'europa', 28),
  ('preparativos', 'Baixar apps de transporte público das cidades do roteiro', 'premium', 7, 'europa', 29),
  ('preparativos', 'Organizar Eurail/passagens de trem entre países', 'premium', 45, 'europa', 30),
  ('preparativos', 'Verificar restrições de bagagem em voos de baixo custo intra-Europa', 'premium', 15, 'europa', 31),
  ('preparativos', 'Verificar feriados locais que possam afetar o roteiro', 'premium', 15, 'europa', 32),
  ('mala', 'Adaptador de tomada tipo C/G/F conforme os países do roteiro', 'premium', null, 'europa', 25),
  ('mala', 'Roupas em camadas para clima variável', 'premium', null, 'europa', 26),
  ('mala', 'Sapato confortável para caminhar muito nas cidades históricas', 'premium', null, 'europa', 27),
  ('mala', 'Guarda-chuva compacto', 'premium', null, 'europa', 28),
  ('compras', 'Cartão internacional sem tarifa de conversão para múltiplas moedas', 'premium', null, 'europa', 13),
  ('compras', 'City pass ou cartão de transporte das cidades principais', 'premium', null, 'europa', 14),
  ('custom', 'Confirmar fuso horário de cada cidade do roteiro', 'premium', 7, 'europa', 7),
  ('custom', 'Organizar tradução/phrasebook dos idiomas do roteiro', 'premium', 15, 'europa', 8);
