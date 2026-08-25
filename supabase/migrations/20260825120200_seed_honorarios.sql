-- =====================================================================
-- Seed da tabela de honorarios.
-- Valores extraidos dos relatorios do Portal Medico (comp. fev-ago/2026).
--   valor_cobrar = o que se lanca
--   valor_pago   = o que a operadora efetivamente paga
-- Regra 10: valor_pago NUNCA sobrescreve valor_cobrar.
--
-- Itens com codigo SEM-TUSS-xx ainda nao tiveram o codigo TUSS oficial
-- informado (codigo_interno = true). Sao lancaveis e faturaveis no PDF do
-- contador, mas o gerador de XML TISS os bloqueia ate receberem codigo real.
-- =====================================================================

insert into procedimentos
  (codigo_tuss, descricao, valor_cobrar, valor_pago, glosa_recorrente, confianca,
   exige_tela, exige_retalho, termos_exigidos, equivalente_a, codigo_interno,
   pequena_cirurgia, observacao, vigencia_inicio)
values
  ('31005497','Colecistectomia videolaparoscopica sem colangiografia',
     1056.78, 1056.78, 0, 'confirmado', false, false, null, '43050200', false,
     false, 'Equivalente ao 43050200 - a operadora remunera apenas um (regra 4).', '2026-01-01'),

  ('43050200','Colecistectomia videolaparoscopica (equivalente ao 31005497)',
     1056.78, 1056.78, 0, 'confirmado', false, false, null, '31005497', false,
     false, 'Equivalente ao 31005497 - a operadora remunera apenas um (regra 4).', '2026-01-01'),

  ('31005470','Colecistectomia COM colangiografia por video',
     1056.78, 1056.78, 0, 'confirmado', false, false, null, null, false,
     false, null, '2026-01-01'),

  ('31009115','Hernioplastia inguinal unilateral',
     280.00, 192.00, 88.00, 'confirmado', false, false, null, null, false,
     false, 'Glosa recorrente de R$ 88,00 desde fev/2026. 25 casos glosados, 3 recursados.', '2026-01-01'),

  ('31009166','Hernioplastia umbilical',
     148.00, 148.00, 0, 'confirmado', true, false, null, null, false,
     false, 'Frequentemente vem com tela autorizada - conferir tela_autorizada / tela_utilizada.', '2026-01-01'),

  ('31009093','Hernioplastia epigastrica',
     148.00, 148.00, 0, 'confirmado', false, false, null, null, false,
     false, null, '2026-01-01'),

  ('31009107','Herniorrafia incisional',
     280.00, 208.00, 72.00, 'provavel', false, false, null, null, false,
     false, null, '2026-01-01'),

  ('30101913','TU partes moles - exerese',
     100.00, 100.00, 0, 'confirmado', false, false, null, null, false,
     true, null, '2026-01-01'),

  ('42030153','Exerese de tumor de pele e mucosas',
     120.00, 100.00, 20.00, 'confirmado', false, false, null, null, false,
     true, null, '2026-01-01'),

  ('30101468','Exerese de tumor de pele e mucosas',
     120.00, 100.00, 20.00, 'provavel', false, false, null, null, false,
     true, null, '2026-01-01'),

  ('30101450','Exerese lesoes circulares com rotacao de retalho',
     184.00, null, null, 'a_confirmar', false, true, array['retalho'], null, false,
     false, 'Exige que a descricao cirurgica registre o retalho (regra 1 do checklist).', '2026-01-01'),

  ('30101522','Extensos ferimentos/cicatrizes - excisao e retalhos',
     476.00, null, null, 'a_confirmar', false, true, array['retalho'], null, false,
     false, 'Exige que a descricao cirurgica registre o retalho (regra 1 do checklist).', '2026-01-01'),

  ('31305016','Ooforectomia laparoscopica uni/bilateral',
     1056.78, 697.60, 359.18, 'confirmado', false, false, null, null, false,
     false, 'Regra 10: cobrar 1.056,78. O 697,60 e valor pago com glosa embutida, nao e preco.', '2026-01-01'),

  ('31009034','Cisto sacral - tratamento cirurgico',
     148.00, null, null, 'a_confirmar', false, false, null, null, false,
     false, null, '2026-01-01'),

  ('SEM-TUSS-01','Reconstrucao de parede abdominal com retalho muscular',
     280.00, 280.00, 0, 'confirmado', false, true, array['retalho'], null, true,
     false, 'Codigo TUSS oficial pendente de informacao.', '2026-01-01'),

  ('SEM-TUSS-02','Tratamento cirurgico da lipomatose cervical',
     340.00, null, null, 'a_confirmar', false, false, null, null, true,
     false, 'Codigo TUSS oficial pendente de informacao.', '2026-01-01'),

  ('SEM-TUSS-03','Exerese e sutura de hemangioma/nevus (ate 5 lesoes)',
     88.00, null, null, 'a_confirmar', false, false, null, null, true,
     true, 'Codigo TUSS oficial pendente de informacao.', '2026-01-01'),

  ('SEM-TUSS-04','Exerese de unha',
     32.00, null, null, 'a_confirmar', false, false, null, null, true,
     true, 'Codigo TUSS oficial pendente de informacao.', '2026-01-01'),

  ('SEM-TUSS-05','Consulta ambulatorial',
     60.00, 60.00, 0, 'confirmado', false, false, null, null, true,
     false, 'Codigo TUSS oficial pendente de informacao. Retorno nao remunera (regra 7).', '2026-01-01')
on conflict (codigo_tuss, vigencia_inicio) do nothing;
