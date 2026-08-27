/**
 * Catalogo de procedimentos do servico - a lista que o Dr. Jefferson usa de
 * fato, enviada em procedimentoscirurgiaeletiva.xlsx (20/08/2026).
 *
 * Isto NAO e a tabela de honorarios. O catalogo diz "este codigo existe e se
 * chama assim"; a tabela de honorarios diz "este codigo vale tanto". Um codigo
 * pode estar no catalogo e ainda nao ter valor - e o caso da maioria, porque a
 * coluna Valor (R$) da planilha veio em branco de proposito.
 *
 * A separacao existe para distinguir dois erros que pareciam iguais na tela:
 *   - codigo que nao esta em lugar nenhum  -> quase sempre leitura errada da foto
 *   - codigo conhecido e sem preco         -> falta cadastrar o valor
 *
 * Regra 9 continua valendo nos dois casos: sem valor na tabela de honorarios,
 * nao lanca. O catalogo so melhora a mensagem, nunca autoriza um faturamento.
 */

export interface ItemCatalogo {
  codigo: string
  /** Como o procedimento e chamado na planilha do servico. */
  nomes: string[]
  /**
   * Descricao oficial da HAPVIDA, quando confirmada por documento da propria
   * operadora. E o texto que vale numa discussao de glosa: numa divergencia
   * entre o rotulo interno e este, quem decide e a operadora. Confirmados no
   * aviso institucional "Codigos de procedimento contemplados nessa onda"
   * (26/08/2026).
   */
  nomeOperadora?: string
}

/** Cirurgia eletiva: 25 linhas da planilha, agrupadas por codigo. */
export const CATALOGO_ELETIVA: ItemCatalogo[] = [
  { codigo: '31005497', nomes: ['Colecistectomia por videolaparoscopia (COM colangiografia)', 'Colecistectomia por videolaparoscopia (SEM colangiografia)'], nomeOperadora: 'Colecistectomia sem colangiografia por videolaparoscopia' },
  { codigo: '30908094', nomes: ['Fistula arteriovenosa dos membros'] },
  { codigo: '30913012', nomes: ['Disseccao de veia para colocacao de cateter'], nomeOperadora: 'Disseccao de veia para colocacao de cateter central NPP ou QT' },
  { codigo: '31003290', nomes: ['Cirurgia de abaixamento de colon (qualquer tecnica)', 'Entero-anastomose'] },
  { codigo: '31003680', nomes: ['Cirurgia de abaixamento de colon por videolaparoscopia'] },
  { codigo: '31005039', nomes: ['Anastomose biliodigestiva intra-hepatica'] },
  { codigo: '31307124', nomes: ['Resseccao de tumor de parede abdominal pelvica'] },
  { codigo: '31001360', nomes: ['Tratamento cirurgico do refluxo gastroesofagico'] },
  { codigo: '31003281', nomes: ['Enterectomia'] },
  { codigo: '31003192', nomes: ['Colectomia parcial'] },
  { codigo: '30806038', nomes: ['Tratamento cirurgico de hernia de hiato'] },
  { codigo: '23020121', nomes: ['Gastrostomia'] },
  { codigo: '40201996', nomes: ['Ato anestesico'] },
  { codigo: '30101522', nomes: ['Extensos ferimentos, cicatrizes ou tumores'] },
  { codigo: '31307983', nomes: ['Exerese e retalho cutaneo (endometriose profunda)'] },
  { codigo: '30914051', nomes: ['Linfadenectomia cervical'] },
  { codigo: '31009107', nomes: ['Herniorrafia incisional'] },
  { codigo: '31009050', nomes: ['Correcao cirurgica da diastase dos retos abdominais'] },
  { codigo: '30914043', nomes: ['Linfadenectomia'] },
  { codigo: '31009115', nomes: ['Hernia inguinal'], nomeOperadora: 'Herniorrafia inguinal - unilateral' },
  { codigo: '40202283', nomes: ['Gastrostomia endoscopica'] },
  { codigo: '31009166', nomes: ['Hernia umbilical'], nomeOperadora: 'Herniorrafia umbilical' },
  { codigo: '31009093', nomes: ['Hernia epigastrica'] },
  // Nao consta na planilha do servico, mas a operadora o contempla no aviso
  // de 26/08/2026 e ele ja tem valor na tabela de honorarios.
  { codigo: '30101913', nomes: ['Exerese de tumor de partes moles'], nomeOperadora: 'TU partes moles - exerese' },
]

/**
 * PQA: a planilha traz 14 rotulos e nenhum codigo. Sao faturados pelo rotulo,
 * nao por codigo - por isso ficam fora do XML TISS ate a operadora informar o
 * codigo correspondente.
 */
export const CATALOGO_PQA: string[] = [
  'Exerese de lipoma',
  'Exerese de cisto sebaceo',
  'Exerese de nevo',
  'Exerese de lesao de pele (biopsia excisional)',
  'Disseccao de veia para colocacao de cateter',
  'Exerese de extensos ferimentos / cicatrizes / tumores',
  'Retalho cutaneo',
  'Cantoplastia (unha encravada)',
  'Exerese de unha / matricectomia',
  'Drenagem de abscesso',
  'Retirada de corpo estranho',
  'Sutura de ferimento',
  'Postectomia',
  'Exerese de verruga / condiloma',
]

/** Nome do procedimento no catalogo, ou null se o codigo nao existe la. */
export function nomeNoCatalogo(codigo: string): string | null {
  const item = CATALOGO_ELETIVA.find((i) => i.codigo === codigo)
  if (!item) return null
  return item.nomeOperadora ?? item.nomes.join(' / ')
}
