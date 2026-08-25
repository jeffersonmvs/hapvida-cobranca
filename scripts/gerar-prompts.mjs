/**
 * Gera supabase/functions/_shared/prompts.gen.ts a partir de src/ai/prompts/*.md.
 *
 * Os prompts sao editados como markdown versionado (§14). As Edge Functions
 * rodam em Deno e nao podem depender de leitura de arquivo no bundle, entao o
 * texto e embutido num modulo TypeScript gerado. Rode `npm run prompts:build`
 * depois de editar qualquer prompt.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEM = 'src/ai/prompts'
const DESTINO = 'supabase/functions/_shared/prompts.gen.ts'

const arquivos = readdirSync(ORIGEM).filter((f) => f.endsWith('.md')).sort()

const partes = arquivos.map((arquivo) => {
  const texto = readFileSync(join(ORIGEM, arquivo), 'utf8')
  const nome = arquivo.replace(/\.v\d+\.md$/, '').replace(/\.md$/, '')
  const versao = /<!--\s*versao:\s*([\w.]+)\s*-->/.exec(texto)?.[1]
  if (!versao) throw new Error(`${arquivo} nao declara <!-- versao: ... -->`)
  const constante = `PROMPT_${nome.toUpperCase()}`
  const escapado = texto.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  return { nome, versao, constante, corpo: `export const ${constante} = \`${escapado}\`\nexport const ${constante}_VERSAO = '${versao}'\n` }
})

const saida =
  '// GERADO POR scripts/gerar-prompts.mjs - NAO EDITE A MAO.\n' +
  '// Edite src/ai/prompts/*.md e rode `npm run prompts:build`.\n\n' +
  partes.map((p) => p.corpo).join('\n')

writeFileSync(DESTINO, saida)
console.log(`${DESTINO}: ${partes.map((p) => `${p.nome}@${p.versao}`).join(', ')}`)
