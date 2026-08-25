# Conjunto de avaliacao da extracao

Sem medir, mudanca de prompt e chute. Este diretorio guarda os boletins reais e
os gabaritos digitados a mao que dizem se uma alteracao em
`src/ai/prompts/extracao.v1.md` melhorou ou piorou a leitura.

## Como montar

1. Ponha as imagens em `avaliacao/imagens/` (JPEG, ja convertidas de HEIC).
2. Para cada imagem, crie `avaliacao/gabaritos/<nome>.json` no formato do tipo
   `Gabarito` (`src/ai/avaliacao.ts`).
3. Rode `npm run avaliar:extracao`.

Meta: 20 boletins. Abaixo disso a metrica oscila demais para servir de decisao.

## Como preencher o gabarito

- Transcreva a **descricao cirurgica na integra**, como esta no papel. A metrica
  de descricao e cobertura de palavras: e ela que pega o modelo resumindo.
- Campo ilegivel no papel entra como `null` E no array `ilegiveis`. O acerto ali
  e devolver `null`; preencher e erro, mesmo que o palpite esteja certo.
- Senha vale por dois: senha em branco o medico digita, senha errada vira glosa.
  `senhas_inventadas` e reportado separado justamente por isso.

## Formato

```json
{
  "arquivo": "boletim-01.jpg",
  "tipo_documento": "boletim",
  "data": "2026-08-10",
  "hora_inicio": "08:00",
  "hora_fim": "09:10",
  "paciente_nome": "MARIA JOSE DA CONCEICAO",
  "carteira": "00123456789",
  "numero_atendimento": "188912993",
  "tipo_anestesia": "raqui",
  "acomodacao": "enfermaria",
  "procedimentos": [
    { "codigo_tuss": "31009166", "senha": "444555" },
    { "codigo_tuss": "31009093", "senha": null }
  ],
  "ilegiveis": ["senha[1]"],
  "descricao_cirurgica": "Incisao infraumbilical de tres centimetros, ..."
}
```

## Privacidade

As imagens e os gabaritos contem dado de paciente. `avaliacao/imagens/` e
`avaliacao/gabaritos/` estao no `.gitignore` — nunca versione o conjunto. Guarde
localmente ou num bucket privado.
