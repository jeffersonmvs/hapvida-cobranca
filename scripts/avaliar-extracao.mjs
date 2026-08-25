/**
 * Roda a extracao sobre o conjunto de avaliacao e imprime a metrica por campo.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_TOKEN=... \
 *   node scripts/avaliar-extracao.mjs
 *
 * SUPABASE_TOKEN e o access_token de uma sessao autenticada - a edge function
 * exige usuario logado, como qualquer chamada de IA do app.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const URL_BASE = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const TOKEN = process.env.SUPABASE_TOKEN

if (!URL_BASE || !ANON || !TOKEN) {
  console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_TOKEN.')
  process.exit(1)
}

const gabaritos = readdirSync('avaliacao/gabaritos')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join('avaliacao/gabaritos', f), 'utf8')))

if (gabaritos.length === 0) {
  console.error('Nenhum gabarito em avaliacao/gabaritos/. Veja avaliacao/README.md.')
  process.exit(1)
}

// tsx carrega os modulos TypeScript do dominio sem passo de build
register('tsx/esm', pathToFileURL('./'))
const { avaliarDocumento, consolidar } = await import('../src/ai/avaliacao.ts')

const resultados = []
for (const g of gabaritos) {
  const r = await fetch(`${URL_BASE}/functions/v1/extrair-documento`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      storage_path: g.storage_path ?? `avaliacao/${g.arquivo}`,
      codigos_vigentes: JSON.parse(readFileSync('avaliacao/codigos.json', 'utf8')),
    }),
  })
  const corpo = await r.json()
  if (!r.ok || corpo.erro) {
    console.error(`${g.arquivo}: ${corpo.erro ?? r.status}`)
    continue
  }
  const resultado = avaliarDocumento(g, corpo.saida)
  resultados.push(resultado)
  console.log(
    `${g.arquivo.padEnd(28)} ${resultado.acertos}/${resultado.total} campos · ` +
      `descricao ${(resultado.cobertura_descricao * 100).toFixed(0)}%` +
      (resultado.senhas_inventadas ? ` · ${resultado.senhas_inventadas} senha(s) inventada(s)` : ''),
  )
}

const m = consolidar(resultados)
console.log('\n--- metrica ---')
console.log(`documentos ................ ${m.documentos}`)
console.log(`acerto por campo .......... ${(m.acerto_por_campo * 100).toFixed(1)}%`)
console.log(`cobertura da descricao .... ${(m.cobertura_media_descricao * 100).toFixed(1)}%`)
console.log(`senhas inventadas ......... ${m.senhas_inventadas}`)
console.log('piores campos:')
for (const p of m.piores_campos) console.log(`  ${p.campo.padEnd(24)} ${p.erros} erro(s)`)
