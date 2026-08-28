-- Valores lidos dos contratos com a HAPVIDA (pasta AAA HAPVIDA ELETIVAS).
--
-- Fonte A: "contrato novo medisa.pdf" (protocolo 82267, vigencia 01/01/2019,
--          prazo indeterminado). O Anexo II lista os codigos em CBHPM 2005
--          pontuado; o codigo de 8 digitos e o mesmo numero sem pontuacao.
-- Fonte B: "contrato hernia.pdf" (aditivo, vigencia 01/08/2025), ja em TUSS.
--
-- Partes: HAPVIDA (CNPJ 63.554.067/0001-98) e MEDISA ESPECIALIDADES MEDICAS E
-- CIRURGICAS (CNPJ 32.145.355/0001-65, CNES 0854913).
--
-- Nada aqui foi estimado: cada valor sai de uma linha da tabela do contrato.

-- CNES do estabelecimento. Estava PENDENTE e bloqueava a geracao do XML TISS.
update faturamento.configuracao
   set cnes = '0854913'
 where cnes is null or trim(cnes) = '';

-- ---------------------------------------------------------------- fonte A --
-- Estes cinco estavam no catalogo do servico mas nunca na tabela de honorarios:
-- eram exatamente parte dos que ficavam bloqueados por falta de valor.
insert into faturamento.procedimentos
  (codigo_tuss, descricao, valor_cobrar, valor_pago, glosa_recorrente, confianca,
   exige_tela, exige_retalho, codigo_interno, pequena_cirurgia, observacao, vigencia_inicio)
values
  ('30908094','Fistula arteriovenosa dos membros',1042.24,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.09.08.09-4).','2026-01-01'),
  ('31005039','Anastomose biliodigestiva intra-hepatica',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.05.03-9).','2026-01-01'),
  ('31003281','Enterectomia',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.03.28-1).','2026-01-01'),
  ('31307124','Resseccao de tumor de parede abdominal pelvica',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.13.07.12-4).','2026-01-01'),
  -- mesmo codigo nos dois lados, nome divergente: o contrato chama de
  -- "Colectomia Total com Ileostomia"; a planilha do servico, de "Colectomia
  -- parcial". Prevalece o nome do contrato, que e o que a operadora reconhece.
  ('31003192','Colectomia total com ileostomia',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.03.19-2). A planilha do servico chamava este codigo de "Colectomia parcial" - conferir.','2026-01-01')
on conflict do nothing;

-- 31005470 e codigo legitimo: o contrato o traz como a colecistectomia COM
-- colangiografia, pelo mesmo valor da SEM. Cai a ressalva que eu havia gravado
-- supondo que o servico lancasse as duas variantes sob o 31005497.
update faturamento.procedimentos set
       descricao = 'Colecistectomia com colangiografia por videolaparoscopia',
       observacao = 'Contrato Medisa 2019, Anexo II (CBHPM 3.10.05.47-0). Codigo proprio da variante COM colangiografia; a SEM e o 31005497, pelo mesmo valor.'
 where codigo_tuss = '31005470';

update faturamento.procedimentos set
       observacao = 'Contrato Medisa 2019, Anexo II (CBHPM 3.10.05.49-7). A variante COM colangiografia tem codigo proprio, o 31005470, pelo mesmo valor.'
 where codigo_tuss = '31005497';

-- Codigos do contrato que faltavam na tabela
insert into faturamento.procedimentos
  (codigo_tuss, descricao, valor_cobrar, valor_pago, glosa_recorrente, confianca,
   exige_tela, exige_retalho, codigo_interno, pequena_cirurgia, observacao, vigencia_inicio)
values
  ('30913012','Disseccao de veia para colocacao de cateter central NPP ou QT',517.14,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.09.13.01-2).','2026-01-01'),
  ('31003133','Cirurgia de abaixamento (qualquer tecnica)',1186.38,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.03.13-3).','2026-01-01'),
  ('31003591','Cirurgia de abaixamento por videolaparoscopia',1684.80,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.03.59-1).','2026-01-01'),
  ('31303102','Histerectomia total (via alta ou baixa)',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.13.03.10-2).','2026-01-01'),
  ('31003648','Colectomia total com ileostomia por videolaparoscopia',1684.80,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.10.03.64-8).','2026-01-01'),
  ('31305032','Ooforectomia laparoscopica uni ou bilateral',1056.78,null,0,'confirmado',false,false,false,false,'Contrato Medisa 2019, Anexo II (CBHPM 3.13.05.03-2).','2026-01-01')
on conflict do nothing;

-- ---------------------------------------------------------------- fonte B --
insert into faturamento.procedimentos
  (codigo_tuss, descricao, valor_cobrar, valor_pago, glosa_recorrente, confianca,
   exige_tela, exige_retalho, codigo_interno, pequena_cirurgia, observacao, vigencia_inicio)
values
  ('31009085','Herniorrafia crural - unilateral',280.00,null,0,'confirmado',false,false,false,false,'Contrato hernia, aditivo de 01/08/2025.','2026-01-01'),
  ('31009140','Herniorrafia recidivante',280.00,null,0,'confirmado',false,false,false,false,'Contrato hernia, aditivo de 01/08/2025.','2026-01-01'),
  ('31009255','Reconstrucao da parede abdominal com retalho muscular ou miocutaneo',280.00,null,0,'confirmado',false,true,false,false,'Contrato hernia, aditivo de 01/08/2025. Substitui o marcador temporario SEM-TUSS-01.','2026-01-01')
on conflict do nothing;

update faturamento.procedimentos set
       observacao = 'Valor confirmado no contrato hernia, aditivo de 01/08/2025.'
 where codigo_tuss in ('31009107','31009115');

-- SEM-TUSS-01 deixa de ser lancavel: agora existe o codigo real, o 31009255.
update faturamento.procedimentos set
       vigencia_fim = '2026-08-27',
       observacao = 'Aposentado: o contrato hernia (01/08/2025) traz o codigo real, 31009255.'
 where codigo_tuss = 'SEM-TUSS-01';
