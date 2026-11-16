export const STAGE_RANK = {
  noticia: 0,
  previsto: 1,
  autorizado: 2,
  comissao: 3,
  banca: 4,
  edital: 5,
};

const NOISE =
  /gabarito|resultado|convocac|nomeac|homologac|apostila|curso preparatorio|simulado|mentoria|lista de aprovados/;

const RELEVANT = /concurso|edital|selecao publica|processo seletivo|\bvagas?\b|autoriza|banca/;

const STAGES = [
  [
    'edital',
    /edital[^.;]{0,40}(publicad|divulgad|oficial|aberto|lancad)|publica\w* (o )?edital|inscricoes (abertas|abrem|ate)|abre inscricoes|abertas as inscricoes/,
  ],
  [
    'banca',
    /banca[^.;]{0,50}(defin|contrat|escolh)|(defin|contrat|escolh)\w* (a )?banca|banca organizadora|organizadora (definida|contratada)/,
  ],
  [
    'comissao',
    /comissao[^.;]{0,40}(formada|criada|constituida|instituida|nomeada|designada)|(forma|cria|constitui|institui|nomeia)\w* (a )?comissao|comissao (do|de) concurso/,
  ],
  [
    'autorizado',
    /autoriz|portaria|liberad[oa]|libera\w* concurso|aprovad[oa] (a |o )?(realizacao|concurso)|\bloa\b|lei orcamentaria|orcamento/,
  ],
  [
    'previsto',
    /\bprev(e|eem|isao|isto|ista|istos|istas|isoes)\b|expectativa|deve sair|pode sair|possivel concurso|vai abrir|devera abrir|sera aberto|em breve|planeja/,
  ],
];

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function classify(text) {
  const norm = normalize(text);
  if (NOISE.test(norm) || !RELEVANT.test(norm)) return { relevant: false, stage: 'noticia' };
  for (const [stage, pattern] of STAGES) {
    if (pattern.test(norm)) return { relevant: true, stage };
  }
  return { relevant: true, stage: 'noticia' };
}
