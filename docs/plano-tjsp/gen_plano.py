import json, datetime as dt, sys, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CONTEUDO_DIR = os.path.join(HERE, 'conteudo')

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ED = f'{REPO}/docs/editais/edital-tjsp-escrevente-2026.json'
edital = json.load(open(ED, encoding='utf8'))

# ---------- edital: tópicos extras (prática da banca por matéria + disciplina de simulados) ----------
Q_TOPIC = 'Questões da banca Vunesp'
SIM = 'Simulados e Revisão'
SIM_TOPICS = [
    'Diagnóstico — prova anterior Vunesp',
    'Questões mistas',
    'Revisão espaçada (1, 7 e 30 dias)',
    'Revisão de erros (caderno de erros)',
    'Planejamento da semana',
    'Simulado parcial (Português + Direito)',
    'Simulado 1 (Blocos I e II)',
    'Simulado 2 (prova completa)',
    'Simulado 3 (prova completa)',
    'Simulado 4 (prova completa)',
    'Prova TRF3 (31/01) — simulado real',
    'Logística e descanso antes da prova',
    'Prova TJ-SP Escrevente (14/03/2027)',
]
by = {d['nome']: d for d in edital['disciplinas']}
for d in edital['disciplinas']:
    if d['nome'] == 'Redação (Prova Discursiva)':
        d['topicos'] = [t for t in d['topicos'] if t['nome'] != Q_TOPIC]
    if d['nome'] in (SIM, 'Redação (Prova Discursiva)'):
        continue
    if not any(t['nome'] == Q_TOPIC for t in d['topicos']):
        d['topicos'].append({'nome': Q_TOPIC})
if SIM not in by:
    edital['disciplinas'].append({'nome': SIM, 'topicos': [{'nome': t} for t in SIM_TOPICS], 'aulas': []})
for d in edital['disciplinas']:
    d['aulas'] = [{'nome': t['nome']} for t in d['topicos']]
by = {d['nome']: d for d in edital['disciplinas']}

def T(disc, i):
    return by[disc]['topicos'][i]['nome']

SIGLA = {}
LP, DA, PP, PC, DC, LI, DP, RL, INF, MAT, ATU, RED = (
    'Língua Portuguesa', 'Direito Administrativo', 'Direito Processual Penal', 'Direito Processual Civil',
    'Direito Constitucional', 'Legislação Interna do TJ-SP', 'Direito Penal', 'Raciocínio Lógico',
    'Informática', 'Matemática', 'Atualidades', 'Redação (Prova Discursiva)')

# ---------- orientações ----------
SIGLA.update({LP: 'LP', DA: 'DA', PP: 'PP', PC: 'PC', DC: 'DC', LI: 'LI', DP: 'DP', RL: 'RL', INF: 'INF', MAT: 'MAT', ATU: 'ATU', RED: 'RED'})

FOCO = {
 (LP,0): 'Leia o texto duas vezes antes das alternativas. Marque tema, tese e como o autor defende. Na Vunesp, a resposta correta sempre tem apoio literal ou inferência direta no texto; descarte alternativas com "sempre", "nunca" e "somente" sem apoio.',
 (LP,1): 'Diferença entre o que o texto DIZ (literal) e o que ele permite concluir (inferência). Treine localizar o trecho que justifica cada alternativa e sublinhe-o.',
 (LP,2): 'Identifique a opinião do autor: adjetivos, advérbios de modo, verbos de opinião e a conclusão do texto. Questões costumam pedir a "intenção" ou "posição" do autor.',
 (LP,3): 'Como as ideias se ligam: conectivos (causa, oposição, conclusão, adição), pronomes e retomadas. Treine trocar um conectivo por outro sem mudar o sentido e ordenar parágrafos.',
 (LP,4): 'O sentido de uma palavra depende do contexto. Treine substituir a palavra no trecho por cada alternativa e ver se o sentido se mantém.',
 (LP,5): 'Sinônimos e antônimos contextuais, não de dicionário. Monte um mini glossário só com as palavras que você errar em questões.',
 (LP,6): 'Sentido próprio x figurado: metáfora, comparação, ironia, hipérbole, eufemismo. O que importa é reconhecer o efeito no texto, não decorar nomes.',
 (LP,7): 'Substantivo, adjetivo, artigo, numeral, pronome, verbo, advérbio, preposição e conjunção. Foque em pronomes (tipos e retomada), valor das conjunções e flexão verbal; a prova pergunta mais o EMPREGO do que a classificação.',
 (LP,8): 'Regras-chave: sujeito composto, sujeito posposto, verbos impessoais, "haver"/"fazer" indicando tempo, expressões "um dos que" e porcentagens. Treine reescrever frases corrigindo a concordância.',
 (LP,9): 'Verbos mais cobrados: assistir, visar, aspirar, preferir, obedecer, informar, chegar/ir. Aprenda a regência pela pergunta ("quem assiste, assiste A quê?") e treine com o pronome relativo preposicionado.',
 (LP,10): 'Próclise, mesóclise e ênclise. Fatores que atraem o pronome antes do verbo (negação, advérbio, pronome relativo/indefinido, conjunção subordinativa). Regra de ouro: não iniciar frase com pronome oblíquo átono.',
 (LP,11): 'Crase = preposição A + artigo A. Teste: troque a palavra feminina por uma masculina; se aparecer "ao", há crase. Casos clássicos: horas, locuções adverbiais femininas, "à moda de", e proibições (antes de verbo, pronomes, palavras masculinas).',
 (LP,12): 'Vírgula: o que NÃO pode (separar sujeito do verbo, verbo do complemento) e o que DEVE (aposto, vocativo, adjunto adverbial deslocado, orações intercaladas). Dois-pontos, ponto e vírgula e travessão aparecem em questões de reescrita.',
 (DA,0): 'Estatuto dos servidores de SP (Lei 10.261/1968), arts. 1º a 86: provimento, posse, exercício e vacância, entre outros temas do trecho. Leia o texto da lei, sublinhe prazos e condições e faça um quadro de prazos (posse, exercício, estágio probatório).',
 (DA,1): 'Arts. 171 a 175 da Lei 10.261/1968, trecho curto indicado no edital. Leia inteiro, sublinhe verbos, prazos e exceções e responda questões do mesmo artigo no mesmo dia.',
 (DA,2): 'Arts. 239 a 323: regime disciplinar, deveres e proibições, penalidades e processo disciplinar (sindicância e processo administrativo). Monte uma tabela: infração x penalidade x prazo de prescrição.',
 (DA,3): 'Lei 8.429/1992 (alterada pela Lei 14.230/2021): atos de improbidade (enriquecimento ilícito, dano ao erário, violação de princípios), sanções, sujeitos ativo e passivo, prescrição. Atenção às mudanças de 2021: dolo é exigido e o rol de sanções foi ajustado.',
 (PP,0): 'CPP arts. 251 a 258, 261 a 267 e 274: poder de polícia do juiz na condução do processo, impedimento e suspeição, defensor e extensão da suspeição aos servidores da justiça. Foque quem pode ser impedido ou suspeito e como se argui.',
 (PP,1): 'CPP arts. 351 a 372: citação e intimação (por mandado, por edital, por hora certa, precatória), prazos e consequências. Faça um fluxograma das modalidades de citação.',
 (PP,2): 'CPP arts. 394 a 497: procedimentos comum, sumário e sumaríssimo e o Tribunal do Júri (fases, jurados, plenário). Desenhe a linha do tempo: denúncia, resposta, audiência, sentença; no Júri, pronúncia e plenário.',
 (PP,3): 'CPP arts. 531 a 538 (processo sumário) e 541 a 548 (restauração de autos extraviados ou destruídos). Leia o texto e anote os prazos de cada fase.',
 (PP,4): 'CPP arts. 574 a 667: recursos (apelação, recurso em sentido estrito, embargos, agravo em execução, habeas corpus). Monte uma tabela: recurso x cabimento x prazo x efeito.',
 (PP,5): 'Lei 9.099/1995, arts. 60 a 83, 88 e 89: Juizados Especiais Criminais, infração de menor potencial ofensivo, composição civil, transação penal e suspensão condicional do processo.',
 (PC,0): 'CPC arts. 144 a 155: impedimento e suspeição do juiz e dos auxiliares da justiça (escrivão, oficial de justiça, perito etc.). Entenda a diferença entre impedimento e suspeição.',
 (PC,1): 'CPC arts. 188 a 275: atos processuais (forma, tempo, lugar), prazos, comunicação dos atos (citação e intimação). Faça uma tabela de prazos e o fluxo das modalidades de citação.',
 (PC,2): 'CPC arts. 294 a 311: tutela provisória (urgência e evidência), cautelar e antecipada, requisitos e estabilização.',
 (PC,3): 'CPC arts. 318 a 538: procedimento comum (petição inicial, resposta do réu, revelia, providências preliminares, saneamento, provas, audiência, sentença) e cumprimento de sentença. Faça uma linha do tempo do processo do início ao cumprimento.',
 (PC,4): 'CPC arts. 994 a 1026: disposições gerais dos recursos, apelação, agravo de instrumento, agravo interno e embargos de declaração, com prazos e efeitos. Tabela: recurso x cabimento x prazo.',
 (PC,5): 'Lei 9.099/1995, arts. 3º a 19: competência e procedimento dos Juizados Especiais Cíveis (valor da causa, conciliação, instrução e julgamento).',
 (PC,6): 'Lei 12.153/2009: Juizados Especiais da Fazenda Pública (competência, valor de alçada, prazos diferenciados e execução).',
 (DC,0): 'CF art. 5º (direitos e garantias individuais e coletivos): inviolabilidade, habeas corpus e habeas data, mandado de segurança, ação popular, devido processo legal. Leia o artigo inteiro; é o mais cobrado da Constituição.',
 (DC,1): 'CF arts. 6º a 11 (direitos sociais): trabalhadores, jornada, férias, FGTS e liberdade sindical. Foque nos incisos do art. 7º que mudam de prova para prova.',
 (DC,2): 'CF arts. 12 e 13: brasileiros natos e naturalizados, cargos privativos de nato, perda da nacionalidade. Tabela: nato x naturalizado.',
 (DC,3): 'CF arts. 37 a 41: princípios da Administração (LIMPE), acesso a cargos, concurso, acumulação, estabilidade e regime dos servidores. Leia o art. 37 inciso por inciso.',
 (DC,4): 'CF art. 92: órgãos do Poder Judiciário (STF, CNJ, STJ, TRFs, TJs, juízes e tribunais do trabalho, eleitorais e militares). Decore a lista e a ordem.',
 (LI,0): 'Resolução TJSP 850/2021 (teletrabalho): quem pode, requisitos, metas e controle. Leia a resolução e faça um quadro de direitos e deveres.',
 (LI,1): 'Resolução TJSP 963/2025 (sistema eproc): implantação, funcionamento e regras do novo sistema. Leia o texto e anote as principais regras operacionais.',
 (LI,2): 'LC Estadual 1.111/2010 (Plano de Cargos e Carreiras): estrutura dos cargos, requisitos, evolução e atribuições do Escrevente. Faça uma tabela de cargos e atribuições.',
 (LI,3): 'Regimento Interno do TJSP: estrutura do Tribunal, órgãos e competências. Foque nos trechos pedidos no Anexo do edital.',
 (LI,4): 'Normas da Corregedoria Geral da Justiça, Tomo I: rotinas e deveres das serventias judiciais. Estude só os capítulos e seções indicados no Anexo VIII do edital.',
 (DP,0): 'Crimes contra a fé pública (CP arts. 293 a 311-A): falsificação de selo, documento falso, uso, falsidade ideológica. Monte uma tabela: crime x conduta x pena.',
 (DP,1): 'Crimes contra a Administração Pública (arts. 312 a 337): peculato, concussão, corrupção passiva e ativa, prevaricação, desacato, resistência. Tabela: crime x sujeito ativo x pena.',
 (DP,2): 'Crimes contra a Administração da Justiça (arts. 339 a 359): denunciação caluniosa, falso testemunho, coação no curso do processo, fraude processual. Leia os tipos penais e as penas.',
 (RL,0): 'Proposições, conectivos (e, ou, se...então, se e somente se), tabela-verdade, negação de proposições e equivalências. Treine as equivalências do "se...então" e a negação de "todo/algum".',
 (RL,1): 'Argumentos válidos e inválidos, premissas e conclusão. Método: assuma as premissas verdadeiras e teste se a conclusão é obrigatória.',
 (RL,2): 'Diagramas de conjuntos (todo, algum e nenhum): desenhe sempre. Treine problemas de união e interseção de conjuntos.',
 (RL,3): 'Sequências numéricas e figurais: identifique a lei de formação (soma, multiplicação, alternância, posição). Treine muitas questões; é questão de prática.',
 (INF,0): 'Windows 10/11: arquivos, pastas, atalhos de teclado, painel de controle, área de transferência. Treine no seu computador os atalhos mais cobrados.',
 (INF,1): 'Word: formatação, tabelas, índices, impressão, cabeçalho e rodapé, campos. Faça os exercícios no próprio programa.',
 (INF,2): 'Excel: fórmulas (SOMA, MÉDIA, SE, PROCV, CONT.SE), referências absolutas ($), gráficos e classificação. Resolva questões digitando a fórmula no Excel.',
 (INF,3): 'Correio eletrônico e Internet: navegação, URLs, busca, e-mail (cc, cco), segurança e golpes (phishing). Leia as regras e faça questões.',
 (INF,4): 'Microsoft Teams, SharePoint, OneNote e OneDrive: recursos básicos e para que serve cada um. Conteúdo curto; pratique abrindo cada ferramenta.',
 (MAT,0): 'Operações com números reais, MMC e MDC. Domine frações, potências e problemas de MMC/MDC (eventos que se repetem).',
 (MAT,1): 'Razão, proporção e regra de três simples e composta. Monte sempre a tabela de grandezas e identifique se é direta ou inversa.',
 (MAT,2): 'Porcentagem: aumento e desconto sucessivos, porcentagem de porcentagem. Use fator de multiplicação (1,2 para +20%).',
 (MAT,3): 'Média aritmética e ponderada. Treine o cálculo e problemas de "qual nota falta para atingir a média".',
 (MAT,4): 'Juros simples: J = C·i·t; relação entre taxa e tempo. Treine converter unidade de tempo e taxa.',
 (MAT,5): 'Equações do 1º e 2º grau e sistemas do 1º grau. Treine montar a equação a partir do texto e a fórmula de Bhaskara.',
 (MAT,6): 'Tabelas, gráficos e medidas usuais (comprimento, massa, capacidade, tempo). Treine interpretar gráfico e converter unidades.',
 (MAT,7): 'Geometria: perímetro, área, volume, ângulos e Teorema de Pitágoras. Decore as fórmulas das figuras mais comuns.',
 (MAT,8): 'Situações-problema: textos que misturam tudo. Treine traduzir o enunciado em conta e confira a unidade da resposta.',
 (ATU,0): 'Fatos políticos, econômicos, sociais e culturais, nacionais e internacionais, a partir de 2026. Leia resumos semanais de um portal confiável e faça uma lista dos temas recorrentes.',
 (ATU,1): 'Estatuto da Pessoa com Deficiência (Lei 13.146/2015), arts. 1º a 13 e 34 a 38: conceito de pessoa com deficiência, igualdade, atendimento prioritário e direito ao trabalho. Leia os artigos indicados.',
 (RED,0): 'Estrutura: introdução (tema e tese), 2 parágrafos de desenvolvimento (argumento + exemplo) e conclusão com proposta ou fechamento. Mínimo seguro: 20+ linhas autorais.',
 (RED,1): 'Defenda UM ponto de vista com repertório (dados, fatos históricos, leis). Antes de escrever, monte o esqueleto em 5 minutos.',
 (RED,2): 'Use a coletânea como apoio, nunca copie trechos (vira zero). Parafraseie e traga o seu repertório.',
 (RED,3): 'Conectivos e parágrafos de tamanho equilibrado. Evite parágrafos de uma frase só e o "monobloco".',
 (RED,4): 'Revise ortografia, acentuação, pontuação e registro formal. Sem gíria, sem "você", sem abreviações.',
 (RED,5): 'Treine escrever à mão com cronômetro, no horário real da prova. Releia 5 minutos antes de passar a limpo.',
}

COMO = {
 LP: 'Método: leia a teoria curta, resolva questões do tema na mesma hora e corrija com o gabarito comentado.',
 DA: 'Método: leia o texto da lei (lei seca), sublinhe verbos e exceções, faça um quadro de prazos e resolva 15 questões do mesmo artigo.',
 PP: 'Método: leia os artigos indicados, monte um fluxograma ou tabela e resolva 15 questões da Vunesp sobre o trecho.',
 PC: 'Método: leia os artigos indicados, monte um fluxograma e resolva 15 questões da Vunesp sobre o trecho.',
 DC: 'Método: leia o artigo da Constituição inciso por inciso e resolva 15 questões do tema.',
 LI: 'Método: leia o texto da norma no site do TJSP, resuma em uma página e resolva questões.',
 DP: 'Método: leia os artigos do Código Penal, monte uma tabela (crime, conduta, pena) e resolva questões.',
 RL: 'Método: aprenda a técnica em 20 minutos e gaste o resto resolvendo exercícios; é uma matéria de prática.',
 INF: 'Método: pratique no próprio programa e resolva questões.',
 MAT: 'Método: veja o exemplo, refaça sozinho sem consulta e resolva uma lista de exercícios.',
 ATU: 'Método: leia resumos de fontes confiáveis e anote os fatos principais.',
 RED: 'Método: escreva à mão, com cronômetro, e compare com a lista de critérios (tema, estrutura, norma culta, coesão).',
}

FONTES = ('Onde estudar sem apostila: lei seca no site planalto.gov.br (leis federais) ou alesp.sp.gov.br (leis estaduais); resoluções e normas no site tjsp.jus.br; '
          'aulas gratuitas buscando no YouTube "[tema] Vunesp Escrevente"; questões e provas anteriores no site da Vunesp e em plataformas de questões (filtro: banca Vunesp, cargo Escrevente Técnico Judiciário).')

QNOTA = ('Resolva 15 a 20 questões da Vunesp sobre {tema} (provas anteriores, banca Vunesp, cargo Escrevente). Cronometre 1 minuto por questão. '
         'Corrija com o gabarito comentado, inclusive as que acertou por chute. Cada erro vira uma linha no caderno de erros: o artigo ou conceito e o motivo (não sabia, confundi ou li errado).')

SIMNOTA = {
 'Diagnóstico — prova anterior Vunesp': 'Faça uma prova anterior completa da Vunesp para Escrevente (site da Vunesp, em provas anteriores) em 2 horas, sem consulta. Objetivo: saber onde você está hoje, não tirar nota. Anote o acerto por matéria; é a sua linha de base. Corrija tudo e comece o caderno de erros.',
 'Questões mistas': 'Bloco longo de questões misturadas (Português, Direito, Raciocínio Lógico, Matemática e Informática) no formato da prova, sem consulta. Corrija e registre cada erro no caderno.',
 'Revisão espaçada (1, 7 e 30 dias)': 'Revise o que estudou há 30 dias: releia seu resumo e refaça 10 questões do tema. Se errou mais da metade, volte à teoria na semana seguinte.',
 'Revisão de erros (caderno de erros)': 'Releia o caderno de erros da semana: para cada erro, diga em voz alta a regra certa. Refaça as questões que errou. Os erros que se repetem viram prioridade na próxima semana.',
 'Planejamento da semana': 'Confira o plano da semana que vem, ajuste horários ao seu compromisso e separe o material. Confirme que cada dia tem a matéria e o horário definidos.',
 'Simulado parcial (Português + Direito)': 'Faça no horário real da prova (domingo à tarde), com cronômetro e sem consulta: 16 questões de Português + 30 de Direito, em torno de 2 horas. Marque as dúvidas e corrija depois.',
 'Simulado 1 (Blocos I e II)': 'Primeiro simulado oficial: Bloco I (Português, 16 questões) e Bloco II (Direito, 30 questões), em torno de 3 horas, no horário da prova. Meta: pelo menos 50% em cada bloco (corte eliminatório da prova). Corrija no dia seguinte.',
 'Simulado 2 (prova completa)': 'Simulado completo: 70 questões (Português 16, Direito 30, Conhecimentos Gerais 24) + redação, em 5 horas, no horário da prova e sem consulta. Meta: 50% ou mais nos Blocos I e II e redação com nota 24 de 40 ou mais. Corrija no dia seguinte.',
 'Simulado 3 (prova completa)': 'Simulado completo: 70 questões + redação, em 5 horas, no horário da prova e sem consulta. Compare com o Simulado 2: o que subiu e o que caiu? Corrija no dia seguinte.',
 'Simulado 4 (prova completa)': 'Último simulado completo: 70 questões + redação, em 5 horas, no horário da prova e sem consulta. Use os mesmos horários de alimentação e pausa do dia da prova. Corrija no dia seguinte e foque só nos pontos fracos.',
 'Prova TRF3 (31/01) — simulado real': 'Hoje é a prova do TRF3 (Técnico Judiciário, Suporte Técnico), sua inscrição já paga. Use como ensaio: chegue cedo, controle o tempo, anote como lidou com a ansiedade e o que faria diferente. Não precisa estudar o conteúdo específico dela. Depois da prova, escreva 5 linhas sobre o que aprendeu.',
 'Logística e descanso antes da prova': 'Confira o local e o horário da prova, o transporte (a vaga é do Interior, veja o tempo de deslocamento), documento com foto, caneta preta e alimentação. Durma bem; não estude conteúdo novo.',
 'Prova TJ-SP Escrevente (14/03/2027)': 'Dia da prova (domingo à tarde). Chegue com folga, leve documento e caneta preta. Comece pelas matérias em que está mais seguro, marque as dúvidas e deixe a redação para um tempo reservado. Respire e confie no que treinou.',
}
SOLO = {  # Notas de blocos de teoria quando não há foco específico
}

def conteudo_aula(disc, idxs):
    """Aula completa (markdown) em conteudo/<SIGLA>-<idx>[-<idx>].md, se existir."""
    sigla = SIGLA.get(disc)
    if not sigla:
        return None
    nome = sigla + '-' + '-'.join(f'{i:02d}' for i in idxs) + '.md'
    path = os.path.join(CONTEUDO_DIR, nome)
    if os.path.exists(path):
        return open(path, encoding='utf8').read().strip()
    return None

def note_teoria(disc, idxs, parte, total, tipo='teoria'):
    key = {LP:LP, DA:DA, PP:PP, PC:PC, DC:DC, LI:LI, DP:DP, RL:RL, INF:INF, MAT:MAT, ATU:ATU, RED:RED}[disc]
    foco = ' '.join(FOCO[(disc, i)] for i in idxs)
    partes = f' (parte {parte} de {total})' if total > 1 else ''
    return f"{foco}\n\n{COMO[key]}\n\n{FONTES}" if tipo == 'teoria' else foco

# ---------- plano ----------
# cada item: ('T', disc, idx) | ('R', disc, [idx...])  (R = aprofundamento/revisão de tópicos já vistos)
# semana -> dict dia(0=seg..4=sex) -> lista de (minutos, [itens])
def t(disc, *idx, m=60):
    return (m, [('T', disc, i) for i in idx])
def rv(disc, *idx, m=60):
    return (m, [('R', disc, i) for i in idx])

W = {}
W[1]  = dict(tpl='A', dias=[[t(LP,0)], [t(LP,1,2)], [t(LP,3)], [t(LP,4,5)], [t(LP,6)]])
W[2]  = dict(tpl='A', dias=[[t(LP,7)], [t(LP,8)], [t(LP,9,10)], [t(LP,11,12)], [t(DC,0)]])
W[3]  = dict(tpl='B', dias=[[t(DC,0),t(DC,0)], [t(DC,1),t(DC,1)], [t(DC,2),t(DC,4)], [t(DC,3),t(DC,3)], [t(DA,0),t(DA,0)]])
W[4]  = dict(tpl='B', dias=[[t(DA,0),t(DA,0)], [t(DA,1),t(DA,2)], [t(DA,2),t(DA,2)], [t(DA,3),t(DA,3)], [t(MAT,0),t(MAT,1)]])
W[5]  = dict(tpl='C', dias=[[t(PP,0,m=120),t(PP,0)], [t(PP,1,m=120)], [t(DP,0,m=120),t(MAT,2)], [t(DP,0,m=120)], [t(INF,0,m=120)]])
W[6]  = dict(tpl='D', dias=[[t(PP,2,m=120)], [t(PP,2,m=120)], [t(RL,0,1,m=120)], [t(PP,2,m=120)], [t(RL,2,3,m=120)]])
W[7]  = dict(tpl='C', dias=[[t(PP,3,m=120),t(PP,5)], [t(PP,4,m=120)], [t(DP,1,m=120),t(INF,1)], [t(PP,4,m=120)], [t(PP,5,m=120)]])
W[8]  = dict(tpl='C', dias=[[t(PC,0,m=120),t(DP,1)], [t(PC,1,m=120)], [t(DP,2,m=120),t(INF,2)], [t(PC,1,m=120)], [t(DP,2,m=120)]], sim='S1')
W[9]  = dict(tpl='C', dias=[[('CORR','Simulado 1'),t(PC,1)], [t(PC,1,m=120)], [t(PC,2,m=120),t(INF,3)], [t(PC,2,m=120)], [t(PC,3,m=120)]])
W[10] = dict(tpl='C', dias=[[t(PC,3,m=120),t(PC,3)], [t(PC,3,m=120)], [t(PC,3,m=120),t(INF,4)], [t(PC,3,m=120)], [t(PC,4,m=120)]])
W[11] = dict(tpl='C', dias=[[t(PC,4,m=120),t(PC,5)], [t(PC,6,m=120)], [t(LI,0,m=120),rv(RL,0,1)], [t(LI,1,m=120)], [t(LI,2,m=120)]], sim='TRF3')
W[12] = dict(tpl='C', dias=[[t(LI,2,m=120),t(LI,3)], [t(LI,3,m=120)], [t(LI,3,m=120),t(ATU,1)], [t(LI,4,m=120)], [t(LI,4,m=120)]], sim='S2')
W[13] = dict(tpl='C', dias=[[('CORR','Simulado 2'),rv(DC,0,1)], [rv(DA,0,1,2,3,m=120)], [t(MAT,3,4,m=120),t(MAT,5)], [rv(PP,0,1,2,m=120)], [t(LI,4,m=120)]])
W[14] = dict(tpl='C', dias=[[rv(PC,0,1,2,m=120),rv(PC,3)], [rv(PC,4,5,6,m=120)], [t(MAT,6,7,m=120),t(MAT,8)], [rv(DP,0,1,2,m=120)], [t(ATU,0,m=120)]], sim='S3')
W[15] = dict(tpl='C', dias=[[('CORR','Simulado 3'),rv(LI,0,1,2)], [rv(LI,3,4,m=120)], [rv(LP,7,8,9,10,11,12,m=120),rv(RL,0,1,2,3)], [('FRACOS',120)], [rv(DA,0,3,m=120)]])
W[16] = dict(tpl='C', dias=[[('FRACOS',120),rv(INF,1,2,3)], [rv(PP,2,3,4,m=120)], [rv(LP,0,1,2,3,m=120),rv(MAT,2,3)], [rv(PC,3,4,m=120)], [rv(LI,0,1,2,m=120)]], sim='S4')
W[17] = dict(tpl='E', dias=[[('CORR','Simulado 4')], [rv(DC,0,1,3,m=120)], [rv(LP,7,8,9,10,11,12,m=120)], [('FRACOS',120)], [('LOG',60)]])

START = dt.date(2026, 11, 16)
SIMDAY = {  # domingo de cada semana com simulado
    'S1': ('Simulado 1 (Blocos I e II)', 180), 'S2': ('Simulado 2 (prova completa)', 300),
    'S3': ('Simulado 3 (prova completa)', 300), 'S4': ('Simulado 4 (prova completa)', 300),
    'TRF3': ('Prova TRF3 (31/01) — simulado real', 270),
}

# contagem de partes por tópico (para "parte x de y")
count = defaultdict(int)
for w in W.values():
    for dia in w['dias']:
        for m, its in [x for x in dia if x[0] not in ('CORR', 'FRACOS', 'LOG')]:
            for k, d, i in its:
                if k == 'T':
                    count[(d, i)] += 1
seen = defaultdict(int)

def disc_key(d):
    return d

dias = []
taught = {}  # data -> lista (disc, idx)
def add_block(blocos, disc, topicos, minutos, notas):
    blocos.append({'disciplina': disc, 'topicos': topicos, 'minutos': minutos, 'notas': notas})

week_minutes = {}
for wk in range(1, 18):
    cfg = W[wk]
    monday = START + dt.timedelta(days=(wk - 1) * 7)
    wk_total = 0
    for dow in range(7):
        d = monday + dt.timedelta(days=dow)
        if d > dt.date(2027, 3, 14):
            continue
        blocos = []
        tpl = cfg['tpl']
        if dow < 5:
            slots = cfg['dias'][dow]
            last_disc = None
            last_topics = []
            first = True
            for slot in slots:
                if slot[0] == 'CORR':
                    nm = slot[1]
                    add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 120,
                              f'Correção do {nm}. Refaça cada questão errada, identifique o motivo (não sabia, confundi ou li errado) e escreva a regra certa no caderno de erros. Calcule o acerto por matéria e por bloco e compare com a meta (50% nos Blocos I e II). Os pontos mais fracos viram prioridade nas próximas semanas.')
                    continue
                if slot[0] == 'FRACOS':
                    add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], slot[1],
                              'Pontos fracos: releia o caderno de erros e escolha as 3 matérias com mais erros. Revise a teoria do que errou e refaça as questões erradas. Depois, resolva 15 questões novas sobre os mesmos temas.')
                    continue
                if slot[0] == 'LOG':
                    add_block(blocos, SIM, ['Logística e descanso antes da prova'], slot[1], SIMNOTA['Logística e descanso antes da prova'])
                    continue
                minutos, items = slot
                kind = items[0][0]
                disc = items[0][1]
                idxs = [i for k, dd, i in items]
                topicos = [T(dd, i) for k, dd, i in items]
                if kind == 'T':
                    for k, dd, i in items:
                        seen[(dd, i)] += 1
                    parte = seen[(disc, idxs[0])]; total = count[(disc, idxs[0])]
                    aula = conteudo_aula(disc, idxs) if minutos == 60 and total == 1 else None
                    base = note_teoria(disc, idxs, parte, total)
                    rotulo = 'Teoria e lei seca' if disc in (DA, PP, PC, DC, LI, DP) else 'Teoria'
                    head = f'{rotulo}{f" — parte {parte} de {total}" if total > 1 and len(idxs)==1 else ""} ({minutos} min). '
                    nt = aula if aula else head + base
                    taught.setdefault(d, []).extend([(disc, i) for i in idxs])
                else:
                    foco = ' '.join(FOCO[(disc, i)] for i in idxs[:3])
                    nt = (f'Revisão ativa ({minutos} min): releia seu resumo e a lei seca destes temas e refaça de memória o quadro ou fluxograma. '
                          f'Em seguida, resolva questões da Vunesp sobre eles. Lembrete do que importa: {foco}')
                add_block(blocos, disc, topicos, minutos, nt)
                last_disc = disc; last_topics = (topicos, idxs)
            # bloco de questões do dia (60)
            if tpl in ('A', 'B', 'C', 'D', 'E') and last_disc and not any(b['topicos'][0] == 'Revisão de erros (caderno de erros)' and False for b in blocos):
                tema = ', '.join(last_topics[0])[:120]
                add_block(blocos, last_disc, [Q_TOPIC], 60, QNOTA.format(tema=f'{last_disc} ({tema})'))
            elif tpl == 'C' and not last_disc:
                pass
            # extras do template C (revisões)
            if tpl == 'C':
                # terça: revisão de 1 dia; quinta: 7 dias; sexta: caderno de erros
                if dow == 1:
                    prev = d - dt.timedelta(days=1)
                    items = taught.get(prev, [])
                    if items:
                        disc, i = items[-1]
                        add_block(blocos, disc, [T(disc, i)], 60, 'Revisão de 1 dia: releia o resumo de ontem e refaça de memória o quadro ou fluxograma. Depois resolva 10 questões do tema. Marque como revisado só depois das questões.')
                    else:
                        add_block(blocos, SIM, ['Revisão espaçada (1, 7 e 30 dias)'], 60, SIMNOTA['Revisão espaçada (1, 7 e 30 dias)'])
                if dow == 3:
                    prev = d - dt.timedelta(days=7)
                    items = taught.get(prev, []) or taught.get(prev - dt.timedelta(days=1), [])
                    if items:
                        disc, i = items[-1]
                        add_block(blocos, disc, [T(disc, i)], 60, 'Revisão de 7 dias: refaça de memória o resumo deste tema e resolva 10 questões novas. Se errar mais da metade, agende nova leitura na semana seguinte.')
                    else:
                        add_block(blocos, SIM, ['Revisão espaçada (1, 7 e 30 dias)'], 60, SIMNOTA['Revisão espaçada (1, 7 e 30 dias)'])
                if dow == 4:
                    add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 60, SIMNOTA['Revisão de erros (caderno de erros)'])
        elif dow == 5:  # sábado
            if wk == 1:
                add_block(blocos, SIM, ['Diagnóstico — prova anterior Vunesp'], 120, SIMNOTA['Diagnóstico — prova anterior Vunesp'])
            elif tpl == 'A':
                add_block(blocos, SIM, ['Questões mistas'], 120, SIMNOTA['Questões mistas'])
            elif tpl == 'B':
                add_block(blocos, SIM, ['Questões mistas'], 120, SIMNOTA['Questões mistas'])
                add_block(blocos, SIM, ['Revisão espaçada (1, 7 e 30 dias)'], 60, SIMNOTA['Revisão espaçada (1, 7 e 30 dias)'])
            elif tpl in ('C', 'D'):
                ri = (wk - 5) % 6
                add_block(blocos, RED, [T(RED, ri)], 60,
                          f'Redação manuscrita nº {wk-4} (60 min, com cronômetro). Escolha um tema da atualidade (educação, tecnologia, serviço público, meio ambiente) e escreva 25 a 30 linhas. {FOCO[(RED, ri)]} Depois confira: tema, estrutura, norma culta, coesão. Nota mínima exigida na prova: 24 de 40.')
                add_block(blocos, SIM, ['Questões mistas'], 120 if tpl == 'C' else 60, SIMNOTA['Questões mistas'])
                if tpl == 'C':
                    prev = d - dt.timedelta(days=30)
                    items = []
                    for k in range(0, 6):
                        items = taught.get(prev + dt.timedelta(days=k)) or taught.get(prev - dt.timedelta(days=k)) or []
                        if items: break
                    if items:
                        disc, i = items[-1]
                        add_block(blocos, disc, [T(disc, i)], 60, 'Revisão de 30 dias: refaça de memória o resumo deste tema e resolva 10 questões novas. É a revisão que fixa na memória de longo prazo.')
                    else:
                        add_block(blocos, SIM, ['Revisão espaçada (1, 7 e 30 dias)'], 60, SIMNOTA['Revisão espaçada (1, 7 e 30 dias)'])
                add_block(blocos, SIM, ['Planejamento da semana'], 60, SIMNOTA['Planejamento da semana'])
            elif tpl == 'E':
                add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 60, 'Leitura leve do caderno de erros e do resumo das matérias com mais erros. Pare cedo e descanse.')
        else:  # domingo
            sim = cfg.get('sim')
            if d == dt.date(2027, 3, 14):
                add_block(blocos, SIM, ['Prova TJ-SP Escrevente (14/03/2027)'], 300, SIMNOTA['Prova TJ-SP Escrevente (14/03/2027)'])
            elif sim:
                nm, mins = SIMDAY[sim]
                add_block(blocos, SIM, [nm], mins, SIMNOTA[nm])
            elif tpl == 'A':
                add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 60, SIMNOTA['Revisão de erros (caderno de erros)'])
                add_block(blocos, SIM, ['Planejamento da semana'], 60, SIMNOTA['Planejamento da semana'] + (' Marco: acompanhe o edital: a inscrição do TJ-SP vai de 28/10 a 10/12/2026 (decisão sua; as vagas são do Interior).' if wk == 2 else ''))
            elif tpl == 'B':
                add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 60, SIMNOTA['Revisão de erros (caderno de erros)'])
                add_block(blocos, SIM, ['Questões mistas'], 60, SIMNOTA['Questões mistas'])
                add_block(blocos, SIM, ['Planejamento da semana'], 60,
                          SIMNOTA['Planejamento da semana'] + (' Marco da semana: se você decidir prestar o TJ-SP, faça a inscrição até 10/12 (boleto pago até 11/12).' if wk == 3 else ''))
            elif tpl in ('C', 'D', 'E'):
                add_block(blocos, SIM, ['Simulado parcial (Português + Direito)'], 120, SIMNOTA['Simulado parcial (Português + Direito)'])
                if tpl == 'C':
                    add_block(blocos, SIM, ['Revisão de erros (caderno de erros)'], 60, SIMNOTA['Revisão de erros (caderno de erros)'])
        if blocos:
            dias.append({'data': d.isoformat(), 'blocos': blocos})
            wk_total += sum(b['minutos'] for b in blocos)
    week_minutes[wk] = wk_total

plano = {
    'versao': 1,
    'nome': 'Plano de Estudos — TJ-SP Escrevente 2026',
    'dataFinal': '2027-03-14',
    'minutosPadrao': 60,
    'dias': dias,
}

out_plan = f'{REPO}/docs/cronogramas/plano-tjsp-escrevente-2026.json'
json.dump(plano, open(out_plan, 'w', encoding='utf8'), ensure_ascii=False, indent=1); open(out_plan, 'a').write('\n')
json.dump(edital, open(ED, 'w', encoding='utf8'), ensure_ascii=False, indent=2); open(ED, 'a').write('\n')
print({k: round(v / 60, 1) for k, v in week_minutes.items()})
print('dias', len(dias), 'blocos', sum(len(d['blocos']) for d in dias))
