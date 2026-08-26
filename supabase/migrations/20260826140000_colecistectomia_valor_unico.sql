-- Colecistectomia videolaparoscopica: COM e SEM colangiografia pagam igual.
--
-- Decisao do Dr. Jefferson em 26/08/2026, ao conferir a planilha do servico:
-- "a colecisto paga o mesmo valor, R$ 1.056,78, independente se e com ou sem
-- colangiografia". Na planilha do servico as duas linhas dividem o mesmo
-- codigo 31005497.
--
-- Duas correcoes decorrentes:
--
-- 1. A descricao de 31005497 dizia "sem colangiografia" e por isso parecia
--    excluir o caso COM. Passa a dizer que cobre os dois.
--
-- 2. 31005470 estava na tabela sem equivalencia declarada. Como e a mesma
--    cirurgia pelo mesmo valor, os dois no mesmo ato remuneram um so: sem a
--    equivalencia, a regra 4 nao abateria e a regra R06 nao avisaria.
--    O codigo NAO e removido: se um documento antigo trouxer 31005470, e
--    melhor resolver o valor e avisar do que bloquear o lancamento. O codigo
--    do servico, porem, e o 31005497.

update faturamento.procedimentos
   set descricao = 'Colecistectomia videolaparoscopica (com ou sem colangiografia)'
 where codigo_tuss = '31005497';

update faturamento.procedimentos
   set equivalente_a = '31005497',
       observacao = 'Mesma cirurgia do 31005497, mesmo valor. O codigo usado pelo servico e o 31005497.'
 where codigo_tuss = '31005470';
