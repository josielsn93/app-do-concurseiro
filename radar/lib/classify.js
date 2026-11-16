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

// Resumos genéricos que listam vários concursos em vez de noticiar um específico.
const ROUNDUP =
  /\b(editais|concursos) (abertos|previstos|previstas|em andamento)\b|editais previstos|editais abertos|oportunidades|ranking|melhores concursos|calendario de concursos|confira os|vagas previstas/;

// Cargos que exigem formação específica fora do perfil (Direito, Medicina, Engenharia, magistério etc.).
const OFF_PROFILE =
  /\b(juiz|juiza|juizes|magistratura|procurador|procuradora|promotor|promotora|defensor|defensora|delegado|delegada|medico|medica|engenheiro|engenheira|engenharia|arquiteto|arquiteta|professor|professora|docente|enfermeiro|enfermeira|odontologo|psicologo|oficial de justica|cartorio|cartorios|serventia|notarial|outorga)\b/;

// Banca ainda não definida: não conta como estágio "banca".
const BANCA_PENDING = /em definicao|a definir|sem banca|escolha da banca|prazo para (a )?escolha|aguarda\w* (a )?(definicao|banca)/;

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
    /autoriz|portaria|liberad[oa]|libera\w* concurso|aprovad[oa] (a |o )?(realizacao|concurso)/,
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
  if (NOISE.test(norm) || ROUNDUP.test(norm) || OFF_PROFILE.test(norm) || !RELEVANT.test(norm)) {
    return { relevant: false, stage: 'noticia' };
  }
  for (const [stage, pattern] of STAGES) {
    if (stage === 'banca' && BANCA_PENDING.test(norm)) continue;
    if (pattern.test(norm)) return { relevant: true, stage };
  }
  return { relevant: true, stage: 'noticia' };
}
