/**
 * Aceite de ponta a ponta contra o modo demonstracao.
 *
 *   npm run build && npm run preview   (porta 4173)
 *   node e2e/aceite.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173'
// Em CI o Chromium vem de `playwright install`; no container de
// desenvolvimento ele ja esta em /opt/pw-browsers.
const chromiumLocal = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium'
const b = await chromium.launch(
  existsSync(chromiumLocal) ? { executablePath: chromiumLocal } : {},
)
const p = await b.newPage({ viewport: { width: 414, height: 900 } })
const erros = []
p.on('pageerror', e => erros.push(String(e)))
let falhas = 0
const ok = (c, m) => {
  if (!c) falhas++
  console.log(`${c ? 'PASS ' : 'FALHA'}  ${m}`)
}

await p.goto(BASE + '/lancar', { waitUntil: 'networkidle' })
// digitar o codigo exato ja seleciona; a lista serve para busca por descricao
await p.getByPlaceholder('NOME COMPLETO').fill('TESTE ACEITE')
await p.locator('input[inputmode="numeric"]').nth(1).fill('999888777')

await p.getByPlaceholder('31009115 ou hernioplastia').first().fill('31009166')
await p.waitForTimeout(200)
await p.locator('input[placeholder="cada sitio tem senha propria"]').first().fill('111111')

await p.getByRole('button', { name: '+ outro sitio' }).click()
await p.getByPlaceholder('31009115 ou hernioplastia').nth(1).fill('31009093')
await p.waitForTimeout(200)
await p.locator('input[placeholder="cada sitio tem senha propria"]').nth(1).fill('111111')
await p.waitForTimeout(300)

let corpo = await p.locator('body').innerText()
ok(/Senha 111111 repetida/.test(corpo), 'criterio 2a: senha repetida entre sitios vira alerta critico')

await p.locator('input[placeholder="cada sitio tem senha propria"]').nth(1).fill('222222')
await p.waitForTimeout(300)
corpo = await p.locator('body').innerText()
ok(!/Senha .* repetida/.test(corpo), 'criterio 2b: senhas distintas resolvem o alerta')
ok(/R\$\s296,00/.test(corpo), 'criterio 2c: umbilical + epigastrica somam R$ 296,00')

await p.getByRole('button', { name: '+ outro sitio' }).click()
await p.getByPlaceholder('31009115 ou hernioplastia').nth(2).fill('30101522')
await p.waitForTimeout(200)
await p.locator('input[placeholder="cada sitio tem senha propria"]').nth(2).fill('333333')
await p.locator('textarea[placeholder="texto do boletim, na integra"]').nth(2)
  .fill('Excisao de cicatriz hipertrofica em dorso, sintese por planos com nylon 4-0.')
await p.waitForTimeout(400)
corpo = await p.locator('body').innerText()
ok(/30101522 exige registro de retalho/.test(corpo), 'criterio 3: 30101522 sem retalho gera alerta critico na tela')

await p.getByRole('button', { name: '+ outro sitio' }).click()
await p.getByPlaceholder('31009115 ou hernioplastia').nth(3).fill('31009115')
await p.waitForTimeout(200)
await p.waitForTimeout(300)
corpo = await p.locator('body').innerText()
ok(/Cobrar R\$\s280,00/.test(corpo) && /previsto R\$\s192,00/.test(corpo) && /glosa historica R\$\s88,00/.test(corpo),
   'criterio 4: 31009115 mostra cobrar 280 / previsto 192 / glosa historica 88')

await p.getByPlaceholder('31009115 ou hernioplastia').nth(3).fill('99999999')
await p.waitForTimeout(300)
await p.waitForTimeout(400)
const salvarDesabilitado = await p.getByRole('button', { name: /Salvar atendimento/ }).isDisabled()
ok(salvarDesabilitado, 'regra 9: codigo fora da tabela bloqueia o salvamento')

await p.goto(BASE + '/', { waitUntil: 'networkidle' })
corpo = await p.locator('body').innerText()
ok(/ainda nao faturados|ainda a faturar/.test(corpo), 'criterio 5: painel mostra o que ainda nao foi faturado')

await p.goto(BASE + '/faturamento', { waitUntil: 'networkidle' })
corpo = await p.locator('body').innerText()
ok(/CNES/.test(corpo) && /Configuracao/.test(corpo), 'criterio 11: CNES pendente impede o XML e explica')
ok(/PENDENCIAS/i.test(corpo), 'criterio 14: lista de pendencias que impedem o fechamento')
const gerarDesabilitado = await p.getByRole('button', { name: /Gerar lote TISS/ }).isDisabled()
ok(gerarDesabilitado, 'criterio 11b: botao de gerar lote fica desabilitado com pendencia')

// ---- fechamento do lote de ponta a ponta ---------------------------------
// Informa o CNES, resolve os alertas criticos e gera o XML de verdade.
// A navegacao daqui em diante e pela propria interface: em modo demonstracao o
// repositorio vive em memoria e um reload zera tudo - que e exatamente o que a
// tela promete.
const irPara = async (rotulo) => {
  await p.getByRole('link', { name: 'Mais' }).click()
  await p.getByRole('link', { name: new RegExp(rotulo) }).click()
  await p.waitForTimeout(300)
}

await irPara('Configuracao')
await p.locator('label').filter({ hasText: /^CNES/ }).locator('input').fill('2561492')
await p.getByRole('button', { name: 'Salvar' }).click()
await p.waitForTimeout(400)

await irPara('Faturamento e lote TISS')
corpo = await p.locator('body').innerText()
ok(!/CNES do estabelecimento e obrigatorio/.test(corpo), 'CNES informado libera a pendencia de CNES')

let resolver = p.getByRole('button', { name: 'marcar como resolvido' })
let guarda = 0
while ((await resolver.count()) > 0 && guarda++ < 12) {
  await resolver.first().click()
  await p.waitForTimeout(350)
  resolver = p.getByRole('button', { name: 'marcar como resolvido' })
}
corpo = await p.locator('body').innerText()
ok(/Lote pronto para fechar/.test(corpo), 'sem pendencias, o lote fica pronto para fechar')

const download = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: /Gerar lote TISS/ }).click(),
]).then(([d]) => d)

const caminho = await download.path()
const xml = readFileSync(caminho, 'latin1')
ok(/^TISS_040300_lote_\d+_\d{4}-\d{2}\.xml$/.test(download.suggestedFilename()),
   `criterio 11: lote baixado como ${download.suggestedFilename()}`)
ok(/encoding="ISO-8859-1"/.test(xml), 'XML declara ISO-8859-1')
ok(/<ans:Padrao>4\.03\.00<\/ans:Padrao>/.test(xml), 'XML declara o padrao 4.03.00')
ok(!/<ans:CPF>/.test(xml), 'XML nao emite tag CPF')
ok(/<ans:CNES>2561492<\/ans:CNES>/.test(xml), 'XML leva o CNES informado')
ok(/<ans:hash>[0-9a-f]{32}<\/ans:hash>/.test(xml), 'epilogo traz o hash MD5')
ok((xml.match(/<ans:senhaAutorizacao>/g) ?? []).length >= 5, 'cada sitio leva a sua senha')
ok(!/[^\x00-\xff]/.test(xml), 'nenhum caractere fora da tabela latin1')

corpo = await p.locator('body').innerText()
ok(/Lote 41/.test(corpo), 'lote registrado no historico com numeracao sequencial')
ok(/GUIAS NO LOTE\n0/.test(corpo) || /Lote pronto para fechar/.test(corpo) === false,
   'o que foi para o lote sai da fila e nao pode ser faturado duas vezes')

// ---- criterio 12: PDF de producao do dia ---------------------------------
const pdf = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'PDF' }).first().click(),
]).then(([d]) => d)
const bytesPdf = readFileSync(await pdf.path())
ok(/^producao-\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.suggestedFilename()),
   `criterio 12: PDF do dia baixado como ${pdf.suggestedFilename()}`)
ok(bytesPdf.subarray(0, 5).toString() === '%PDF-' && bytesPdf.length > 2000,
   'criterio 12: PDF valido e nao vazio')
const textoPdf = bytesPdf.toString('latin1')
ok(!/nao faturavel/i.test(textoPdf), 'criterio 12: PQA nunca rotulado como nao faturavel')

// ---- planilha ------------------------------------------------------------
const xlsx = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Planilha XLSX' }).click(),
]).then(([d]) => d)
const bytesXlsx = readFileSync(await xlsx.path())
ok(bytesXlsx.subarray(0, 2).toString() === 'PK' && bytesXlsx.length > 3000,
   `planilha gerada (${xlsx.suggestedFilename()})`)

// ---- criterio 13: conciliacao --------------------------------------------
await irPara('Conciliacao')
await p.locator('textarea').first().fill(
  [
    'Senha;Codigo;Valor Apresentado;Valor Pago',
    '444555;31009166;148,00;148,00',
    '666777;31009093;100,00;100,00',
    '000111;31005470;1056,78;1056,78',
  ].join('\n'),
)
await p.waitForTimeout(400)
corpo = await p.locator('body').innerText()
ok(/CONFEREM\n?1|Conferem/i.test(corpo), 'criterio 13: conciliacao separa o que confere')
ok(/DIVERGEM NO VALOR \(1\)/i.test(corpo), 'criterio 13: conciliacao separa o que diverge no valor')
ok(/NAO ENCONTRADOS NO RELATORIO \([1-9]/i.test(corpo),
   'criterio 13: conciliacao mostra a producao que nunca chegou ao relatorio')
ok(/NAO ENCONTRADOS NO BANCO \(1\)/i.test(corpo),
   'criterio 13: conciliacao mostra o que o relatorio traz e o banco nao conhece')

// --- captura: o seletor de arquivo precisa abrir no Safari do iPhone --------
// O Safari ignora .click() sintetico em input com display:none. O sintoma era
// tocar em "Galeria / PDF" e nao acontecer nada. Cada input fica dentro de um
// <label>, e nenhum deles pode voltar a ser display:none.
await p.goto(BASE + '/captura', { waitUntil: 'networkidle' })
const inputs = p.locator('input[type="file"]')
ok(await inputs.count() === 3, 'captura: os tres seletores de arquivo existem')

const diagnostico = await inputs.evaluateAll((els) =>
  els.map((el) => ({
    accept: el.getAttribute('accept') ?? '',
    display: getComputedStyle(el).display,
    visibility: getComputedStyle(el).visibility,
    dentroDeLabel: !!el.closest('label'),
  })),
)
ok(diagnostico.every((d) => d.dentroDeLabel),
   'captura: todo input de arquivo fica dentro de um <label>')
ok(diagnostico.every((d) => d.display !== 'none' && d.visibility !== 'hidden'),
   'captura: nenhum input de arquivo usa display:none (o iOS nao abriria o seletor)')

const galeriaAccept = diagnostico.find((d) => d.accept.includes('application/pdf'))?.accept ?? ''
ok(galeriaAccept === 'image/*,application/pdf',
   'captura: accept da galeria sem extensoes soltas, que o iOS trata mal')

// Selecionar de verdade: o sintoma relatado no iPhone foi "abre a galeria,
// seleciono, volta e nao anexa". Um PNG minimo passa pelo mesmo caminho -
// onChange, prepararArquivo, redimensionamento e fila.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
await inputs.nth(1).setInputFiles({
  name: 'boletim-teste.png', mimeType: 'image/png', buffer: PNG_1PX,
})
await p.waitForTimeout(1500)
corpo = await p.locator('body').innerText()
ok(/Ultima selecao: 1 arquivo/i.test(corpo),
   'captura: a selecao aparece na tela em vez de falhar em silencio')
ok(/boletim-teste\.png/.test(corpo), 'captura: o arquivo escolhido chega ao app')
ok(/Fila \(1\)/i.test(corpo), 'captura: o arquivo entra na fila de processamento')

console.log(erros.length ? 'ERROS DE PAGINA:\n' + erros.join('\n') : 'sem erros de pagina')
await b.close()
process.exit(falhas > 0 || erros.length > 0 ? 1 : 0)
