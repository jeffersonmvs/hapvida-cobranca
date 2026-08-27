-- Descricoes oficiais da HAPVIDA para os codigos confirmados por documento.
--
-- Fonte: aviso institucional da operadora, "Codigos de procedimento
-- contemplados nessa onda" (26/08/2026), enviado pelo Dr. Jefferson.
--
-- A descricao da tabela de honorarios sai no PDF do contador e e o que se
-- confronta com a operadora numa glosa. Onde ha texto oficial, ele vale mais
-- do que o rotulo interno do servico.
--
-- Correcao de rota no 31005497: em 26/08/2026 eu havia gravado
-- "(com ou sem colangiografia)" a partir da frase do Dr. Jefferson sobre o
-- VALOR ser o mesmo nos dois casos. A frase era sobre valor, nao sobre nome -
-- a extrapolacao foi minha. O aviso da operadora nomeia o codigo como SEM
-- colangiografia, e e esse o texto que fica. O valor permanece R$ 1.056,78
-- para os dois casos, conforme ele informou.

update faturamento.procedimentos
   set descricao = 'Colecistectomia sem colangiografia por videolaparoscopia',
       observacao = 'Descricao oficial HAPVIDA (aviso de 26/08/2026). O servico lanca tambem a colecistectomia COM colangiografia sob este codigo, pelo mesmo valor - conferir antes de faturar, porque o codigo e nominalmente SEM colangiografia.'
 where codigo_tuss = '31005497';

update faturamento.procedimentos
   set descricao = 'Herniorrafia inguinal - unilateral'
 where codigo_tuss = '31009115';

update faturamento.procedimentos
   set descricao = 'Herniorrafia umbilical'
 where codigo_tuss = '31009166';

update faturamento.procedimentos
   set descricao = 'TU partes moles - exerese'
 where codigo_tuss = '30101913';
