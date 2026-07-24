-- =============================================================
-- VJT-003b — Completar catálogo premium genérico (faixa 80-120)
-- Aditiva: só INSERT em checklist_templates, bloco premium SEM
-- condição de regiao/clima/destino_pack/com_crianca. Nenhuma
-- linha existente é alterada ou removida.
--
-- Motivo: um usuário premium sem destino_pack correspondente
-- (ex. Japão, Tailândia, Argentina, Chile) somava só ~48-56 itens
-- (free 30 + genérico 10 + regiao 4-5 + clima 4-6), abaixo da
-- faixa 80-120 da Seção 2 de VIAJALY-TRIP.md. Este ticket só
-- amplia o bloco genérico; não mexe em regiao/clima/destino_pack/
-- com_crianca nem no motor de seleção.
-- =============================================================

insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Visto ou autorização eletrônica de entrada verificada (quando aplicável)', 'premium', 45, 16),
  ('documentos', 'Itinerário de voos e hospedagem impresso e salvo offline', 'premium', 15, 17),
  ('documentos', 'Certificado Internacional de Vacinação (quando exigido pelo destino)', 'premium', 60, 18),
  ('documentos', 'Carteira de habilitação internacional (caso vá dirigir no destino)', 'premium', 30, 19),
  ('documentos', 'Comprovante de passagem de retorno ou continuação de viagem', 'premium', 15, 20),
  ('documentos', 'Apólice detalhada do seguro-saúde internacional impressa', 'premium', 15, 21),
  ('documentos', 'Cópias digitais de cartões de crédito e débito internacionais', 'premium', 15, 22),
  ('documentos', 'Documento de identidade adicional digitalizado (RG/CPF)', 'premium', 30, 23),
  ('documentos', 'Comprovante de reserva de aluguel de veículo (se aplicável)', 'premium', 15, 24),
  ('documentos', 'Autorização de trabalho remoto ou visto de negócios (se aplicável)', 'premium', 30, 25),
  ('documentos', 'Checklist de documentos revisado para escalas internacionais', 'premium', 7, 26),
  ('preparativos', 'Ativar roaming internacional ou eSIM de reserva', 'premium', 7, 34),
  ('preparativos', 'Baixar aplicativo de tradução com uso offline', 'premium', 15, 35),
  ('preparativos', 'Cadastrar itinerário no programa de assistência ao viajante (embaixada/consulado)', 'premium', 30, 36),
  ('preparativos', 'Configurar autenticação em duas etapas para apps bancários no exterior', 'premium', 15, 37),
  ('preparativos', 'Reservar transfer aeroporto-hotel', 'premium', 15, 38),
  ('preparativos', 'Verificar política de reembolso e cancelamento das reservas', 'premium', 30, 39),
  ('preparativos', 'Organizar lista de contatos de emergência internacionais', 'premium', 15, 40),
  ('preparativos', 'Ativar notificações de fraude no cartão para uso internacional', 'premium', 15, 41),
  ('preparativos', 'Revisar limite de saque e compra internacional do cartão', 'premium', 15, 42),
  ('preparativos', 'Confirmar check-in online dos voos com antecedência', 'premium', 2, 43),
  ('preparativos', 'Planejar transporte entre aeroportos em conexões internacionais', 'premium', 15, 44),
  ('mala', 'Nécessaire organizador de cabos e eletrônicos', 'premium', null, 41),
  ('mala', 'Fechadura extra para mochila ou bolsa de mão', 'premium', null, 42),
  ('mala', 'Cópia impressa de receitas médicas', 'premium', null, 43),
  ('mala', 'Kit de costura de viagem', 'premium', null, 44),
  ('mala', 'Sacos a vácuo para otimizar espaço na mala', 'premium', null, 45),
  ('mala', 'Balança de bagagem portátil', 'premium', null, 46),
  ('mala', 'Case rígido para óculos e eletrônicos sensíveis', 'premium', null, 47),
  ('mala', 'Etiquetas de identificação de bagagem com QR code', 'premium', null, 48),
  ('mala', 'Multitomada ou filtro de linha para vários dispositivos', 'premium', null, 49),
  ('mala', 'Máscara de dormir e protetor auricular para voos longos', 'premium', null, 50),
  ('mala', 'Travesseiro de pescoço inflável', 'premium', null, 51),
  ('mala', 'Necessaire extra para itens de higiene durante o voo', 'premium', null, 52),
  ('compras', 'Cartão pré-pago internacional para emergências', 'premium', null, 10),
  ('compras', 'Plano de dados internacional adicional (backup do eSIM)', 'premium', null, 11),
  ('compras', 'Kit de primeiros socorros de viagem completo', 'premium', null, 12),
  ('compras', 'Aplicativo de conversão de moeda offline', 'premium', null, 13),
  ('compras', 'Cartão alimentação ou vale-refeição internacional', 'premium', null, 14),
  ('compras', 'Compra antecipada de ingressos para atrações populares do destino', 'premium', null, 15),
  ('compras', 'Aluguel de equipamento eletrônico (Wi-Fi portátil, power bank)', 'premium', null, 16),
  ('compras', 'Seguro adicional para equipamentos eletrônicos', 'premium', null, 17),
  ('compras', 'Aplicativo de mapas offline com navegação por voz', 'premium', null, 18),
  ('compras', 'Reserva antecipada de passeios e excursões locais', 'premium', null, 19),
  ('compras', 'Aplicativo de acompanhamento de voos em tempo real', 'premium', null, 20);
