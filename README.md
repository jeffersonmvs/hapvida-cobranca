# Faturamento HAPVIDA

Controle de producao cirurgica e ambulatorial no convenio HAPVIDA: calcula
honorarios, **previne glosa antes do faturamento**, acompanha o que foi pago e
gera os entregaveis (PDF para o contador, XML TISS, planilha).

Dr. Jefferson Menezes Viana Santos — CRM 11.153 / RQE 10.042 — Cirurgia Geral.

> Entre fevereiro e junho de 2026, 25 hernioplastias inguinais foram glosadas em
> R$ 88,00 cada e apenas 3 foram recursadas — R$ 1.936,00 perdidos sem ninguem
> perceber. O app existe para que isso nao se repita. Esse numero e um teste:
> `src/domain/glosas.test.ts`.

---

## Rodar

```bash
npm install
npm run dev        # sem Supabase configurado, sobe em MODO DEMONSTRACAO
npm test           # 105 testes de dominio
npm run build

# aceite de ponta a ponta num browser real, contra o modo demonstracao
npm run preview &
npm run test:e2e
```

O mesmo conjunto roda no CI (`.github/workflows/ci.yml`) a cada push na `main` e
a cada pull request: testes de dominio, conferencia de que `prompts.gen.ts` esta
em dia com os markdowns, build e o aceite em browser. Regra de faturamento que
quebrar reprova o PR sozinha.

**Modo demonstracao**: sem `VITE_SUPABASE_URL`, o app roda com um repositorio em
memoria, dados ficticios e um aviso permanente no topo. Nada e salvo. Serve para
conhecer as telas antes de provisionar o projeto.

### Publicacao

`netlify.toml` ja traz a reescrita de SPA — sem ela, recarregar em `/faturamento`
devolve 404, porque o roteamento e do react-router, no cliente. Build
`npm run build`, publicar `dist/`.

### Com Supabase

```bash
cp .env.example .env.local     # preencher URL e anon key
supabase db push               # aplica supabase/migrations/
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy extrair-documento analisar-risco \
                          normalizar-glosas redigir-recurso
```

A **chave da API de IA nunca vai ao navegador**. Toda chamada passa por Edge
Function autenticada (`supabase/functions/`), que tambem grava a trilha em
`analises_ia` com modelo e versao de prompt.

---

## Como o codigo esta organizado

```
src/domain/     regras de negocio como funcoes puras + testes  <- comece aqui
src/dados/      repositorio (Supabase | memoria) e estado do app
src/telas/      as telas, uma por arquivo
src/exportar/   PDF do contador, PDF de recurso, XLSX
src/ai/         contratos Zod, prompts versionados, avaliacao
supabase/       migrations e edge functions
avaliacao/      conjunto de avaliacao da extracao (nao versionado)
```

O dominio nao importa React, nao le o relogio e nao conhece Supabase. Toda data
circula como string ISO `AAAA-MM-DD` e todo dinheiro e somado em centavos.

---

## As regras que o codigo protege

| Regra | Onde |
|---|---|
| Um sitio, um procedimento, **uma senha propria** | `checklist.ts` R03 |
| Sala PQA e faturavel — a classe nao zera valor | `calculo.ts` (a classe nem entra na conta) |
| So o cirurgiao principal e remunerado | `calculo.ts` regra 3 |
| 31005497 ↔ 43050200 remuneram apenas um | `calculo.ts` regra 4, `checklist.ts` R06 |
| Decisao intraoperatoria nao remunera | `calculo.ts` regra 5 |
| Pequenas cirurgias no mesmo ato: so uma | `calculo.ts` regra 6 |
| Retorno registra producao, nao valor | `calculo.ts` `calcularConsultas` |
| **Nunca estimar valor** — codigo fora da tabela bloqueia o salvamento | `honorarios.ts` `resolverValor` |
| **valor_pago nunca vira valor_cobrar** | `procedimentos` versionada por vigencia |

A ultima e a que criou a ooforectomia de R$ 697,60 no sistema antigo: a glosa
foi incorporada como se fosse preco. Aqui `valor_cobrar` e `valor_pago` sao
colunas diferentes e editar preco cria **nova vigencia** em vez de sobrescrever.

### Checklist antiglosa

Dez regras deterministicas (`src/domain/checklist.ts`), nenhuma bloqueia o
salvamento, todas aparecem em painel e no PDF do contador. As regras 1, 2 e 9
sao busca por termo, grosseiras de proposito; a camada semantica que as
complementa e a analise de risco por IA, que grava alerta com `origem = 'ia'` e
**cor e marca distintas na interface** — regra e palpite de modelo nao se
confundem na tela.

---

## Inteligencia de glosa

A estatistica e deterministica: taxa por codigo, serie temporal, ranking, prazo,
exposicao do mes. Nada disso passa por modelo.

O agrupamento e por **assinatura de glosa** (codigo + valor + faixa), nunca pelo
texto da justificativa. Foi o que resolveu o caso que motivou a funcao: de fev a
mai/2026 a operadora escreveu "procedimento nao incluso em contrato"; em junho
passou a escrever "pago abaixo da tabela contratual". Mesma glosa, R$ 88,00,
mesmo codigo. Quem lia texto via dois fenomenos; era um so.

A IA entra em dois pontos e so neles: normalizar a justificativa numa taxonomia
fechada e interpretar o painel.

---

## Envio da cobranca

**Nivel 1 — lote TISS** (implementado). O canal legitimo de automacao com a
operadora e o XML do padrao ANS. O app monta o lote validado, com numeracao
sequencial de guia e lote controlada no banco, pronto para upload.

**Nivel 2 — digitacao assistida no SAVI** (implementado). Campos na ordem do
formulario do portal, cada um com botao de copiar, e um checkbox "digitado" por
procedimento que grava `situacao = faturado` com data e hora.

**Nivel 3 — automacao de navegador**: nao implementado, por decisao. O app nao
faz login automatizado, nao guarda credencial de operadora, nao roda headless e
nao envia cobranca sem revisao humana na tela.

---

## Privacidade

Dado de saude e dado pessoal sensivel. RLS ligada em todas as tabelas, Storage
privado com URL assinada de 5 minutos, nenhum dado de paciente em log ou
mensagem de erro, HEIC convertido no cliente antes do upload, retencao das
imagens configuravel com o JSON extraido preservado.

Nas chamadas de IA vale minimizacao: analise de risco e redacao de recurso
recebem descricao e metadados **sem nome, carteira ou CPF**. A extracao de
documento e a excecao necessaria — a imagem contem identificacao mesmo.

Nada extraido por IA vira registro faturavel sem confirmacao humana.

---

## Prompts e avaliacao

Os prompts vivem em `src/ai/prompts/*.md`, versionados no nome e num comentario
`<!-- versao: ... -->`. `npm run prompts:build` gera o modulo que as Edge
Functions importam; a versao vai para `analises_ia.prompt_versao`.

`npm run avaliar:extracao` roda a extracao sobre o conjunto de
`avaliacao/gabaritos/` e reporta acerto por campo, cobertura da descricao
cirurgica e **senhas inventadas** — a metrica que mais importa, porque senha em
branco o medico digita e senha errada vira glosa. Ver `avaliacao/README.md`.

---

## Pendencias que dependem de voce

1. **CNES**. Obrigatorio na guia de honorario individual. Enquanto estiver em
   branco em Configuracao, a geracao do XML fica bloqueada e explica por que.
2. **Codigos TUSS ausentes**. Cinco itens da tabela de honorarios nao tem codigo
   TUSS informado e entraram com codigo interno `SEM-TUSS-01..05`
   (reconstrucao de parede abdominal com retalho, lipomatose cervical,
   hemangioma/nevus, exerese de unha, consulta ambulatorial). Sao lancaveis e
   entram no PDF do contador, mas o gerador de XML os bloqueia ate receberem
   codigo oficial. Nao inventei nenhum — regra 9.
3. **XSD oficial da ANS**. O gerador valida estrutura, campos obrigatorios,
   formato e as armadilhas conhecidas (encoding, CPF vazia, senha por sitio,
   hash). A validacao contra o XSD publicado e o conferimento da ordem exata dos
   elementos precisam do `TISS_040300_honorarios_2026-08.xml` que voce tem — e o
   jeito de travar isso com certeza em vez de por memoria.
4. **Regra 6 (pequenas cirurgias)**. Quais codigos contam como "pequena
   cirurgia" e um flag editavel em Tabela de honorarios. Marquei os que pareciam
   obvios (exerese de tumor de pele, TU partes moles, unha, hemangioma);
   confira, porque essa marca muda o valor previsto.
5. **Carga historica**. `PRODUCAO_GERAL_2026-08.xlsx`, os 13 relatorios do
   Portal Medico e o registro cirurgico do hospital ainda nao foram importados —
   a tela de Conciliacao ja le relatorio colado, mas a carga em massa precisa
   dos arquivos.
