-- =============================================================
-- VJT-003 — Wizard de onboarding + banco de templates premium
-- Aditiva: nova coluna em trips + expansão do catálogo de checklist_templates.
-- Nenhuma tabela/linha existente é alterada.
-- =============================================================

alter table public.trips
  add column num_criancas int not null default 0 check (num_criancas >= 0 and num_criancas <= num_pessoas);

-- Free: completa o catálogo básico (15 já existentes do VJT-001 + 15 novos = ~30)
insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Apólice do seguro viagem impressa', 'free', 30, 6),
  ('documentos', 'Vacinas em dia (se exigidas pelo destino)', 'free', 60, 7),
  ('documentos', 'Reserva do carro ou transfer confirmada', 'free', 15, 8),
  ('preparativos', 'Baixar mapas offline do destino', 'free', 7, 5),
  ('preparativos', 'Configurar cartão para uso internacional', 'free', 15, 6),
  ('preparativos', 'Avisar vizinho ou família sobre a viagem', 'free', 7, 7),
  ('preparativos', 'Organizar cuidado de pets ou plantas', 'free', 7, 8),
  ('mala', 'Necessaire de higiene pessoal', 'free', null, 5),
  ('mala', 'Óculos de sol e protetor solar', 'free', null, 6),
  ('mala', 'Fones de ouvido e entretenimento offline', 'free', null, 7),
  ('mala', 'Snacks para o trajeto', 'free', null, 8),
  ('compras', 'Câmbio de moeda estrangeira', 'free', null, 3),
  ('compras', 'Seguro de bagagem (se aplicável)', 'free', null, 4),
  ('compras', 'Presentes e lembranças de casa', 'free', null, 5),
  ('compras', 'Chip ou pacote de dados internacional', 'free', null, 6);

-- Premium: itens gerais (sem condição de variável — aplicam a qualquer trip premium)
insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Documentos digitalizados e salvos na nuvem (backup)', 'premium', 30, 9),
  ('documentos', 'Cópia física extra de cartões e documentos', 'premium', 15, 10),
  ('preparativos', 'Plano de celular internacional ativado', 'premium', 7, 9),
  ('preparativos', 'Seguro viagem premium com cobertura odontológica', 'premium', 45, 10),
  ('preparativos', 'Assinatura de streaming baixada para o modo offline', 'premium', 7, 11),
  ('mala', 'Fechadura e trava TSA para a mala', 'premium', null, 9),
  ('mala', 'Kit de primeiros socorros completo', 'premium', null, 10),
  ('mala', 'Verificação de compatibilidade de todos os plugues eletrônicos', 'premium', null, 11),
  ('compras', 'Lista de restaurantes e atrações favoritas salva offline', 'premium', null, 7),
  ('compras', 'Contatos de emergência salvos offline', 'premium', null, 8);

-- Premium: com criança
insert into public.checklist_templates (tipo, titulo, tier, com_crianca, marco, ordem) values
  ('documentos', 'RG ou certidão de nascimento da criança', 'premium', true, 30, 11),
  ('documentos', 'Autorização de viagem (se sem um dos pais)', 'premium', true, 30, 12),
  ('documentos', 'Cópia da carteira de vacinação infantil', 'premium', true, 30, 13),
  ('preparativos', 'Cadeirinha ou assento de elevação reservado', 'premium', true, 30, 12),
  ('mala', 'Fraldas e lenços umedecidos', 'premium', true, null, 12),
  ('mala', 'Remédios infantis de uso comum (febre, dor)', 'premium', true, null, 13),
  ('mala', 'Protetor solar infantil', 'premium', true, null, 14),
  ('mala', 'Brinquedos e jogos para o trajeto', 'premium', true, null, 15);

-- Premium: clima frio
insert into public.checklist_templates (tipo, titulo, tier, clima, ordem) values
  ('mala', 'Casaco ou jaqueta térmica', 'premium', 'frio', 16),
  ('mala', 'Luvas, gorro e cachecol', 'premium', 'frio', 17),
  ('mala', 'Botas impermeáveis', 'premium', 'frio', 18),
  ('mala', 'Protetor labial e hidratante para pele ressecada', 'premium', 'frio', 19),
  ('mala', 'Camada térmica extra (base layer)', 'premium', 'frio', 20);

-- Premium: clima quente
insert into public.checklist_templates (tipo, titulo, tier, clima, ordem) values
  ('mala', 'Protetor solar de alto FPS', 'premium', 'quente', 21),
  ('mala', 'Roupas leves e respiráveis', 'premium', 'quente', 22),
  ('mala', 'Chapéu ou boné', 'premium', 'quente', 23),
  ('mala', 'Repelente de insetos', 'premium', 'quente', 24),
  ('mala', 'Garrafa de água reutilizável', 'premium', 'quente', 25),
  ('mala', 'Chinelo ou sandália confortável', 'premium', 'quente', 26);

-- Premium: clima tropical
insert into public.checklist_templates (tipo, titulo, tier, clima, ordem) values
  ('mala', 'Repelente de insetos reforçado (maior concentração)', 'premium', 'tropical', 27),
  ('mala', 'Remédio antialérgico e para o estômago', 'premium', 'tropical', 28),
  ('mala', 'Guarda-chuva ou capa de chuva compacta', 'premium', 'tropical', 29),
  ('mala', 'Saco impermeável para eletrônicos', 'premium', 'tropical', 30);

-- Premium: região América do Norte
insert into public.checklist_templates (tipo, titulo, tier, regiao, ordem) values
  ('preparativos', 'Adaptador de tomada tipo A/B', 'premium', 'america_norte', 13),
  ('preparativos', 'Verificar autorização eletrônica de entrada (ESTA/eTA)', 'premium', 'america_norte', 14),
  ('preparativos', 'Ajustar fuso horário e alarmes com antecedência', 'premium', 'america_norte', 15),
  ('preparativos', 'Instalar aplicativo de transporte local (Uber/Lyft)', 'premium', 'america_norte', 16),
  ('mala', 'Conversor de unidades (milhas/Fahrenheit) salvo offline', 'premium', 'america_norte', 31);

-- Premium: região Europa
insert into public.checklist_templates (tipo, titulo, tier, regiao, ordem) values
  ('preparativos', 'Adaptador de tomada tipo C/F', 'premium', 'europa', 17),
  ('preparativos', 'Verificar necessidade de seguro Schengen', 'premium', 'europa', 18),
  ('preparativos', 'Instalar aplicativo de transporte público local', 'premium', 'europa', 19),
  ('mala', 'Tradutor offline do idioma local instalado', 'premium', 'europa', 32),
  ('compras', 'City pass ou cartão de transporte turístico', 'premium', 'europa', 9);

-- Premium: região Ásia
insert into public.checklist_templates (tipo, titulo, tier, regiao, ordem) values
  ('preparativos', 'Adaptador de tomada específico do destino', 'premium', 'asia', 20),
  ('preparativos', 'Aplicativo de tradução com câmera instalado', 'premium', 'asia', 21),
  ('preparativos', 'Verificar costumes locais de vestimenta', 'premium', 'asia', 22),
  ('mala', 'Remédio para o estômago e água filtrada/purificadora', 'premium', 'asia', 33);

-- Premium: região América do Sul
insert into public.checklist_templates (tipo, titulo, tier, regiao, ordem) values
  ('preparativos', 'Adaptador de tomada tipo C', 'premium', 'america_sul', 23),
  ('preparativos', 'Verificar câmbio e meios de pagamento aceitos localmente', 'premium', 'america_sul', 24),
  ('documentos', 'Verificar necessidade de vacina de febre amarela', 'premium', 'america_sul', 14),
  ('mala', 'Protetor solar reforçado', 'premium', 'america_sul', 34);

-- Premium: pack Orlando (parques)
insert into public.checklist_templates (tipo, titulo, tier, destino_pack, ordem) values
  ('documentos', 'Verificar altura mínima dos brinquedos para crianças', 'premium', 'orlando', 15),
  ('preparativos', 'Ingressos dos parques comprados com antecedência', 'premium', 'orlando', 25),
  ('preparativos', 'Genie+/Lightning Lane planejado', 'premium', 'orlando', 26),
  ('preparativos', 'Reserva de restaurantes com personagens', 'premium', 'orlando', 27),
  ('preparativos', 'Aplicativo oficial do parque instalado', 'premium', 'orlando', 28),
  ('preparativos', 'Plano de encontro caso o grupo se separe', 'premium', 'orlando', 29),
  ('mala', 'Roupa de banho e protetor solar', 'premium', 'orlando', 35),
  ('mala', 'Tênis confortável para caminhada longa', 'premium', 'orlando', 36),
  ('mala', 'Ponchos de chuva compactos', 'premium', 'orlando', 37),
  ('mala', 'Power bank para o dia inteiro no parque', 'premium', 'orlando', 38);

-- Premium: pack Europa clássica
insert into public.checklist_templates (tipo, titulo, tier, destino_pack, ordem) values
  ('preparativos', 'City pass de museus reservado', 'premium', 'europa', 30),
  ('preparativos', 'Roteiro de trens reservado (Eurail/Trainline)', 'premium', 'europa', 31),
  ('preparativos', 'Verificar dress code de igrejas e catedrais', 'premium', 'europa', 32),
  ('preparativos', 'Reserva antecipada de atrações populares (Torre Eiffel, Coliseu etc.)', 'premium', 'europa', 33),
  ('mala', 'Calçado confortável para caminhar em pedras/paralelepípedos', 'premium', 'europa', 39),
  ('mala', 'Mala menor para viagens de trem (sem despacho)', 'premium', 'europa', 40);
