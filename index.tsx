
import React, { useState, useMemo, useEffect, useCallback, ChangeEvent, DragEvent, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);


// --- AI Configuration ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TYPES ---
type Disclosure = {
    id: string;
    title: string;
    requirements: string;
    standard?: string;
};

type GRIStandard = {
    id: string;
    title: string;
    disclosures: Disclosure[];
};

type SASBDisclosure = {
    id: string;
    title: string;
    requirements: string;
}

type SASBStandard = {
    id: string;
    title: string;
    disclosures: SASBDisclosure[];
}

type IndicatorStatus = 'pending_assignment' | 'pending_collection' | 'in_progress' | 'pending_review' | 'changes_requested' | 'internally_approved' | 'final_approved';

type ResponsiblePerson = {
    id: string;
    name: string;
    email: string;
    area: string;
};

type QnA = {
  id: string;
  question: string;
  answer: string;
  asker: string;
  questionTimestamp: string;
  answerTimestamp: string;
};

type Indicator = {
  id: string;
  title: string;
  requirements: string;
  standard: string;
  status: IndicatorStatus;
  focalPoint: string;
  reviewer: string;
  deadline: string;
  data: { [key: string]: string };
  files: File[];
  reviewComments: string;
  historicalContext: string;
  historyLoading: boolean;
  qna: QnA[];
};

type Indicators = {
    [key:string]: Indicator;
};

type CompanyProfile = {
    name: string;
    mission: string;
    vision: string;
    values: string;
};

// --- DATA ---
const sectorGroups = [
    {
        category: 'Alimentos e Bebidas',
        sectors: ['Agropecuária', 'Alimentos e Bebidas']
    },
    {
        category: 'Extração e Processamento Mineral',
        sectors: [
            'Operações de Carvão',
            'Materiais de Construção',
            'Produtores de Ferro e Aço',
            'Metais e Mineração',
            'Petróleo e Gás – Exploração e Produção',
            'Petróleo e Gás – Transporte e Armazenagem (Midstream)',
            'Petróleo e Gás – Refino e Comercialização',
            'Petróleo e Gás – Serviços',
        ]
    },
    {
        category: 'Finanças',
        sectors: ['Serviços Financeiros']
    },
    {
        category: 'Infraestrutura',
        sectors: [
            'Concessionárias de Energia Elétrica e Geração de Energia',
            'Serviços de Engenharia e Construção',
            'Concessionárias e Distribuidoras de Gás',
            'Construtoras de Imóveis',
            'Imobiliárias',
            'Serviços Imobiliários',
            'Gestão de Resíduos',
            'Concessionárias e Serviços de Água',
        ]
    },
    {
        category: 'Recursos Renováveis e Energia Alternativa',
        sectors: [
            'Biocombustíveis',
            'Manejo Florestal',
            'Células de Combustível e Baterias Industriais',
            'Produtos de Celulose e Papel',
            'Tecnologia Solar e Desenvolvedores de Projetos',
            'Tecnologia Eólica e Desenvolvedores de Projetos',
        ]
    },
    {
        category: 'Transformação de Recursos',
        sectors: [
            'Aeronáutica e Defesa',
            'Químicos',
            'Embalagens e Recipientes',
            'Equipamentos Elétricos e Eletrônicos',
            'Máquinas e Bens Industriais',
        ]
    },
    {
        category: 'Tecnologia e Comunicações',
        sectors: ['Software e Serviços de TI']
    },
];

const griStandards: GRIStandard[] = [
    // Universal Standards
    {
        id: 'GRI 2', title: 'GRI 2: Conteúdos Gerais 2021',
        disclosures: [
            { id: '2-1', title: 'Detalhes da organização', requirements: 'a. O nome jurídico e comercial da organização.|||b. A sua forma jurídica e de propriedade.|||c. A localização da sede da organização.|||d. Os países onde a organização opera.' },
            { id: '2-2', title: 'Entidades incluídas no relato de sustentabilidade da organização', requirements: 'a. Listar todas as entidades incluídas no relato de sustentabilidade da organização.|||b. Especificar quaisquer diferenças entre esta lista e a lista de entidades incluídas no seu relato financeiro e explicar as razões dessas diferenças.|||c. Se a organização for composta por várias entidades, explicar a abordagem usada para consolidar as informações, incluindo: i. se a abordagem envolve ajustes de informações para participações minoritárias; ii. como a abordagem considera fusões, aquisições e alienações de entidades ou de partes de entidades; iii. se e como a abordagem difere ao longo dos conteúdos desta Norma e ao longo dos temas materiais.' },
            { id: '2-3', title: 'Período de relato, frequência e ponto de contato', requirements: 'a. O período coberto pela informação relatada e a frequência do relato (p. ex., anual, bienal).|||b. O período do relato financeiro, se for diferente do período de relato de sustentabilidade.|||c. A data da publicação do relato.|||d. O ponto de contato para perguntas sobre o relato.' },
            { id: '2-4', title: 'Reformulação de informações', requirements: 'a. Relatar quaisquer reformulações de informações feitas de períodos anteriores e, para cada reformulação, relatar: (i) o motivo da reformulação; (ii) o efeito da reformulação.' },
            { id: '2-5', title: 'Verificação externa', requirements: 'a. Descrever sua política e sua prática para obter verificação externa, incluindo como e se o mais alto órgão de governança e altos executivos estão envolvidos.|||b. Se o relato de sustentabilidade da organização foi submetido à verificação externa: (i) fornecer um link para o(s) relatório(s) ou declaração(ões) de verificação externa; (ii) descrever o que foi verificado e com base em que metodologia de verificação (p. ex., norma de verificação); (iii) descrever a relação entre a organização e o prestador da verificação.' },
            { id: '2-6', title: 'Atividades, cadeia de valor e outras relações de negócios', requirements: 'a. Relatar o(s) setor(es) em que atua.|||b. Descrever sua cadeia de valor, incluindo: i. as atividades, os produtos e serviços da organização e os mercados atendidos por ela; ii. a cadeia de fornecedores da organização; iii. as entidades downstream da organização e suas atividades;|||c. Relatar as mudanças significativas na organização e em sua cadeia de valor durante o período de relato.' },
            { id: '2-7', title: 'Empregados', requirements: 'a. Relatar o número total de empregados, discriminando este total por gênero e por região;|||b. relatar o número total de: i. empregados permanentes, discriminando por gênero e por região; ii. empregados temporários, discriminando por gênero e por região; iii. empregados sem garantia de carga horária, discriminando por gênero e por região; iv. empregados em tempo integral, discriminando por gênero e por região; v. empregados de período parcial, discriminando por gênero e por região;|||c. descrever as metodologias e premissas usadas para compilar os dados, incluindo se os números estão relatados: i. no total de empregados ou em equivalentes em tempo integral, ou usando outra metodologia; ii. ao término do período de relato, como uma média ao longo do período de relato, ou usando outra metodologia;|||d. relatar informações contextuais necessárias para a compreensão dos dados relatados nos itens 2-7-a e 2-7-b;|||e. descrever flutuações significativas no número de empregados durante o período de relato e entre períodos de relato.' },
            { id: '2-8', title: 'Trabalhadores que não são empregados', requirements: 'a. Relatar o número total de trabalhadores que não são empregados e cujo trabalho é controlado pela organização e descrever: i. os tipos mais comuns de trabalhadores e suas relações contratuais com a organização; ii. o tipo de trabalho que eles realizam;|||b. descrever as metodologias e premissas usadas para compilar os dados, incluindo se o número de trabalhadores que não são empregados está relatado: i. no total de empregados, em equivalentes em tempo integral, ou usando outra metodologia; ii. ao término do período de relato, como uma média ao longo do período de relato, ou usando outra metodologia;|||c. descrever flutuações significativas no número de trabalhadores que não são empregados durante o período de relato e entre períodos de relato.' },
            { id: '2-9', title: 'Estrutura de governança e sua composição', requirements: 'a. A estrutura de governança da organização, incluindo comitês do mais alto órgão de governança.|||b. Lista dos comitês responsáveis pela supervisão da gestão dos impactos da organização.|||c. A composição do mais alto órgão de governança e seus comitês por: (i) membros executivos e não executivos; (ii) independência; (iii) mandato; (iv) número de outros cargos e compromissos significativos; (v) gênero; (vi) grupos sociais sub-representados; (vii) competências relativas a temas econômicos, ambientais e sociais; (viii) representação das partes interessadas.' },
            { id: '2-10', title: 'Nomeação e seleção para o mais alto órgão de governança', requirements: 'a. Descrever o processo de nomeação e seleção do mais alto órgão de governança e seus comitês.|||b. descrever os critérios adotados para nomear e selecionar os membros do mais alto órgão de governança, incluindo se e como os seguintes critérios são considerados: i. opiniões dos stakeholders(incluindo acionistas); ii. diversidade; iii. independência; iv. competências relevantes para os impactos da organização .' },
            { id: '2-11', title: 'Presidente do mais alto órgão de governança', requirements: 'a. Relatar se o presidente do mais alto órgão de governança é também um alto executivo da organização;|||b. se o presidente for também um alto executivo, descrever sua função na gestão da organização, os motivos para esse acúmulo de funções e como conflitos de interesse são prevenidos e mitigados.' },
            { id: '2-12', title: 'Papel do mais alto órgão na supervisão da gestão dos impactos', requirements: 'a. Descrever o papel desempenhado pelo mais alto órgão de governança e pelos altos executivos no desenvolvimento, na aprovação e atualização da declaração de valores ou de missão, estratégias, políticas e objetivos relacionados ao desenvolvimento sustentável;|||b. Descrever o papel desempenhado pelo mais alto órgão de governança na supervisão da devida diligência da organização e de outros processos para identificar e gerenciar seus impactos na economia, no meio ambiente e nas pessoas, incluindo: i. se e como o mais alto órgão de governança se engaja com stakeholders para ajudar nesses processos; ii. como o mais alto órgão de governança considera os resultados desses processos;|||c. Descrever o papel do mais alto órgão de governança na análise da eficácia dos processos da organização conforme descrito no item 2-12-b e relatar a frequência desta análise.' },
            { id: '2-13', title: 'Delegação de responsabilidade pela gestão de impactos', requirements: 'a. Descrever como o mais alto órgão de governança delega responsabilidade pela gestão dos impactos da organização da economia, no meio ambiente e nas pessoas, incluindo: i. se ela nomeou algum alto executivo para ser responsável pela gestão dos impactos; ii. se ela delegou responsabilidade pela gestão dos impactos para outros empregados;|||b. descrever o processo e a frequência com que altos executivos e outros empregados devem relatar ao mais alto órgão de governança sobre a gestão dos impactos da organização na economia, no meio ambiente e nas pessoas.' },
            { id: '2-14', title: 'Papel do mais alto órgão no relato de sustentabilidade', requirements: 'a. Relatar se o mais alto órgão de governança é responsável por analisar e aprovar as informações relatadas, incluindo os temas materiais da organização, e se for, descrever o processo de análise e aprovação das informações;|||b. se o mais alto órgão de governança não for responsável por analisar e aprovar as informações relatadas, incluindo os temas materiais da organização, explicar os motivos para isso.' },
            { id: '2-15', title: 'Conflitos de interesse', requirements: 'a. Descrever os processos para evitar e mitigar conflitos de interesse do mais alto órgão de governança.|||b. Relatar se conflitos de interesse são revelados aos stakeholders, incluindo, pelo menos, conflitos de interesse relacionados a: i. participação cruzada em outros órgãos de administração; ii. participação acionária cruzada com fornecedores e outros stakeholders; iii. existência de acionistas controladores; iv. partes relacionadas, suas relações, transações e saldos pendentes.' },
            { id: '2-16', title: 'Comunicação de preocupações cruciais', requirements: 'a. Descrever como as preocupações cruciais são comunicadas ao mais alto órgão de governança.|||b. Relatar o número total e a natureza das preocupações cruciais comunicadas ao mais alto órgão de governança durante o período de relato.' },
            { id: '2-17', title: 'Conhecimento coletivo do mais alto órgão de governança', requirements: 'Relatar as medidas tomadas para desenvolver e aprimorar o conhecimento coletivo do mais alto órgão de governança sobre temas de desenvolvimento sustentável.' },
            { id: '2-18', title: 'Avaliação do desempenho do mais alto órgão de governança', requirements: 'a.Descrever os processos de avaliação do desempenho do mais alto órgão de governança no que diz respeito à supervisão da gestão dos impactos da organização na economia, no meio ambiente e nas pessoas;|||b. relatar se essa avaliação é independente ou não e com que frequência ela é realizada;|||c. descrever as medidas tomadas em resposta às avaliações, incluindo mudanças na composição do mais alto órgão de governança e em práticas organizacionais.' },
            { id: '2-19', title: 'Políticas de remuneração', requirements: 'a. Descrever as políticas de remuneração aplicadas aos membros do mais alto órgão de governança e aos altos executivos, incluindo: i. remuneração fixa e variável; ii. bônus de atração ou pagamentos de incentivos ao recrutamento; iii. pagamentos de rescisão; iv. devolução de bônus e incentivos (clawback); v. benefícios de aposentadoria;|||b. descrever como as políticas de remuneração para membros do mais alto órgão de governança e para os altos executivos estão vinculadas aos seus objetivos e ao seu desempenho em relação à gestão dos impactos da organização na economia, no meio ambiente e nas pessoas.' },
            { id: '2-20', title: 'Processo para determinação da remuneração', requirements: 'a. Descrever o processo de desenvolvimento das políticas de remuneração e para determinação da remuneração, incluindo: i. se membros independentes do mais alto órgão de governança ou um comitê de remuneração independente supervisiona o processo de determinação da remuneração; ii. como as opiniões dos stakeholders (incluindo acionistas) relacionadas a remuneração são obtidas e consideradas; iii. se consultores de remuneração estão envolvidos na determinação da remuneração e, caso estejam, se eles são independentes da organização, do mais alto órgão de governança e de seus altos executivos;|||b. relatar os resultados de votações de stakeholders (incluindo acionistas) nas políticas e propostas de remuneração, se aplicável.' },
            { id: '2-21', title: 'Proporção da remuneração total anual', requirements: 'a. Relatar a proporção entre a remuneração total anual do indivíduo mais bem pago da organização e a remuneração total anual mediana de todos os empregados (excluindo se o mais bem pago);|||b. relatar a proporção entre o aumento percentual na remuneração total anual do indivíduo mais bem pago da organização e o aumento percentual mediano na remuneração total anual de todos os empregados (excluindo-se o mais bem pago);|||c. relatar informações contextuais para a compreensão dos dados relatados e como os dados foram compilados.' },
            { id: '2-22', title: 'Declaração sobre estratégia de desenvolvimento sustentável', requirements: 'Relatar uma declaração do membro de mais alto escalão do mais alto órgão de governança (p. ex., presidente ou CEO) sobre a relevância do desenvolvimento sustentável para a organização e sua estratégia para alcançá-lo.' },
            { id: '2-23', title: 'Compromissos de política', requirements: 'a.Descrever seus compromissos de política para uma conduta empresarial responsável, incluindo: i. os instrumentos intergovernamentais reconhecidos internacionalmente a que os compromissos se referem; ii. se os compromissos preveem a realização de devida diligência; iii. se os compromissos preveem a aplicação do princípio da precaução; iv. se os compromissos preveem o respeito para com os direitos humanos;|||b. descrever seu compromisso de política específico para com o respeito aos direitos humanos, incluindo: i. os direitos humanos internacionalmente reconhecidos que o compromisso aborda; ii. as categorias de stakeholders, incluindo grupos em situação de risco ou grupos vulneráveis, a quem a organização dá especial atenção no compromisso;|||c. fornecer links para os compromissos de política se disponíveis ao público ou, se os compromissos de política não estiverem disponíveis ao público, explicar o motivo para isso;|||d. relatar o nível em que cada um dos compromissos de política foi aprovado pela organização, incluindo se este é o nível mais alto;|||e. relatar até que ponto os compromissos de política se aplicam às atividades da organização e às suas relações de negócios;|||f. descrever como os compromissos de política são comunicados aos trabalhadores, parceiros de negócios e outras partes relevantes.' },
            { id: '2-24', title: 'Incorporação de compromissos de política', requirements: 'a. descrever como ela incorpora seus compromissos de política para uma conduta empresarial responsável em todas as suas atividades e relações de negócios, incluindo: i. como delega responsabilidades para a implementação dos compromissos nos diferentes níveis dentro da organização; ii. como integra os compromissos nas estratégias organizacionais, nas políticas e procedimentos operacionais; iii. como implementa seus compromissos com e por meio de suas relações de negócios; iv. treinamento que a organização fornece para a implementação dos compromissos.' },
            { id: '2-25', title: 'Processos para reparar impactos negativos', requirements: 'a. Descrever seus compromissos de promover ou colaborar com a reparação de impactos negativos que a organização identifica que causou ou contribuiu para causar.|||b. descrever sua abordagem para identificar e abordar queixas, incluindo os mecanismos de queixas que a organização tenha estabelecido ou dos quais participa.|||c. descrever outros processos pelos quais a organização promove ou colabora com a reparação de impactos negativos que ela identifica que causou ou contribuiu para causar.|||d. descrever como os stakeholders que são os usuários-alvo dos mecanismos de queixas estão envolvidos na concepção, revisão, operação e melhoria desses mecanismos.|||e. descrever como a organização rastreia a eficácia dos mecanismos de queixas e de outros processos de reparação e como relata exemplos de sua eficácia, incluindo o feedback dos stakeholders.' },
            { id: '2-26', title: 'Mecanismos para aconselhamento e apresentação de preocupações', requirements: 'a. Descrever os mecanismos para que indivíduos: i. busquem aconselhamento sobre como implementar as políticas e práticas da organização para uma conduta empresarial responsável; ii. apresentem preocupações relativas à conduta empresarial da organização.' },
            { id: '2-27', title: 'Conformidade com leis e regulamentos', requirements: 'a. Relatar o número total de casos significativos de não conformidade com leis e regulamentos durante o período de relato, discriminando este total por: i. casos em que multas foram aplicadas; ii. casos em que sanções não monetárias foram aplicadas;|||b. relatar o número total e o valor monetário de multas para casos de não conformidade com leis e regulamentos que ocorreram durante o período de relato, discriminando este total por: i. multas para casos de não conformidade com leis e regulamentos que ocorreram durante o período de relato atual; ii. multas para casos de não conformidade com leis e regulamentos que foram pagas durante períodos de relato anteriores;|||c. descrever casos significativos de não conformidade;|||d. descrever como ela definiu casos significativos de não conformidade.' },
            { id: '2-28', title: 'Participação em associações', requirements: 'Relatar as principais associações do setor e outras associações das quais participa.' },
            { id: '2-29', title: 'Abordagem para engajamento de stakeholders', requirements: 'a. Descrever a abordagem adotada para engajar-se com os stakeholders, incluindo: I. as categorias de stakeholders com as quais ela se engaja e como elas são identificadas; ii. o propósito do engajamento de stakeholders; iii. como a organização busca garantir um engajamento significativo com stakeholders.' },
            { id: '2-30', title: 'Acordos de negociação coletiva', requirements: 'a. Relatar o percentual do total de empregados cobertos por acordos de negociação coletiva;|||b. para empregados não cobertos por acordos de negociação coletiva, relatar se a organização define suas condições de trabalho e termos de emprego com base em acordos de negociação coletiva que cubram seus outros empregados ou com base em acordos de negociação coletiva de outras organizações.' }
        ]
    },
    {
        id: 'GRI 3', title: 'GRI 3: Temas Materiais 2021',
        disclosures: [
            { id: '3-1', title: 'Processo de definição de temas materiais', requirements: 'a. Descrever o processo seguido para definição dos temas materiais, incluindo: i. como ela identificou impactos negativos e positivos reais e potenciais na economia, no meio ambiente e nas pessoas, inclusive impactos em seus direitos humanos, em todas as suas atividades e relações de negócios; ii. como ela priorizou os impactos para o relato com base na importância;|||b. especificar os stakeholders e especialistas cujos pontos de vista embasaram o processo de definição de temas materiais.' },
            { id: '3-2', title: 'Lista de temas materiais', requirements: 'a. Listar seus temas materiais.|||b. Relatar quaisquer alterações na lista de temas materiais em comparação com o período de relato anterior e os motivos das alterações.' },
            { id: '3-3', title: 'Gestão dos temas materiais', requirements: 'a.Descrever os impactos reais e potenciais, negativos e positivos na economia, no meio ambiente e nas pessoas, inclusive impactos em seus direitos humanos;|||b. relatar se a organização está envolvida com impactos negativos por meio das suas atividades ou como resultado das suas relações de negócios, e descrever as atividades ou relações de negócios;|||c. descrever suas políticas ou compromissos para com os temas materiais;|||d. descrever as medidas tomadas para gerenciar o tema e os impactos a ele relacionados, entre as quais: i. medidas para prevenir ou mitigar impactos negativos potenciais; ii. medidas para abordar impactos negativos reais, inclusive medidas para providenciar sua reparação ou cooperar com ela; iii. medidas para gerenciar impactos positivos reais e potenciais;|||e. relatar as seguintes informações sobre o rastreamento da eficácia das medidas tomadas: i. processos usados para rastrear a eficácia das medidas; ii. objetivos, metas e indicadores usados para avaliar o progresso; iii. a eficácia das medidas, inclusive o progresso rumo aos objetivos e às metas; iv. aprendizados e como foram incorporados nas políticas e procedimentos operacionais da organização;|||f. descrever como o engajamento com stakeholders embasou as medidas tomadas (3-3- d) e como a organização informou se as medidas foram eficazes (3-3-e).' }
        ]
    },
    // Economic Series
    {
        id: 'GRI 201', title: 'GRI 201: Desempenho Econômico 2016',
        disclosures: [
            { id: '201-1', title: 'Valor econômico direto gerado e distribuído', requirements: 'a. Valor econômico direto gerado (receitas).|||b. Valor econômico distribuído: (i) custos operacionais; (ii) salários e benefícios de empregados; (iii) pagamentos a provedores de capital; (iv) pagamentos a governos; (v) investimentos na comunidade.|||c. Valor econômico retido.' },
            { id: '201-2', title: 'Implicações financeiras e outros riscos e oportunidades decorrentes de mudanças climáticas', requirements: 'a. Descrever os riscos e oportunidades decorrentes de mudanças climáticas que têm o potencial de gerar mudanças substantivas nas operações, receitas ou despesas.|||b. Descrever o impacto das mudanças climáticas nas atividades da organização e as implicações financeiras.|||c. Descrever os métodos utilizados para gerenciar esses riscos e oportunidades.' },
            { id: '201-3', title: 'Obrigações do plano de benefício definido e outros planos de aposentadoria', requirements: 'a. Obrigações do plano de benefício definido e outros planos de aposentadoria.|||b. Percentual de salário contribuído pelo empregado ou empregador.|||c. Nível de participação em planos de aposentadoria, discriminado por gênero.' },
            { id: '201-4', title: 'Apoio financeiro recebido do governo', requirements: 'a. Valor monetário total de apoio financeiro recebido de qualquer governo durante o período de relato, incluindo: (i) créditos fiscais; (ii) subsídios; (iii) doações; (iv) royalties; (v) outras formas de apoio.' }
        ]
    },
    {
        id: 'GRI 202', title: 'GRI 202: Presença no Mercado 2016',
        disclosures: [
            { id: '202-1', title: 'Proporção entre o salário mais baixo e o salário mínimo local', requirements: 'a. Proporção do salário inicial padrão por gênero em comparação com o salário mínimo local em locais de operações significativas.' },
            { id: '202-2', title: 'Proporção de membros da diretoria contratados na comunidade local', requirements: 'a. Percentual de executivos seniores de locais de operações significativas que são contratados da comunidade local.' }
        ]
    },
    {
        id: 'GRI 203', title: 'GRI 203: Impactos Econômicos Indiretos 2016',
        disclosures: [
            { id: '203-1', title: 'Investimentos em infraestrutura e apoio a serviços', requirements: 'a. Extensão do desenvolvimento de investimentos significativos em infraestrutura e serviços apoiados, incluindo: (i) o investimento; (ii) os serviços apoiados; (iii) se os investimentos e serviços são comerciais, em espécie ou pro bono.' },
            { id: '203-2', title: 'Impactos econômicos indiretos significativos', requirements: 'a. Exemplos dos impactos econômicos indiretos significativos identificados da organização, incluindo os impactos positivos e negativos.' }
        ]
    },
    {
        id: 'GRI 204', title: 'GRI 204: Práticas de Compra 2016',
        disclosures: [
            { id: '204-1', title: 'Proporção de gastos com fornecedores locais', requirements: 'a. Percentual do orçamento de compras em locais de operações significativas que é gasto com fornecedores locais.' }
        ]
    },
    {
        id: 'GRI 205', title: 'GRI 205: Combate à Corrupção 2016',
        disclosures: [
            { id: '205-1', title: 'Operações avaliadas quanto a riscos relacionados à corrupção', requirements: 'a. Número total e percentual de operações avaliadas quanto a riscos relacionados à corrupção.|||b. Riscos significativos relacionados à corrupção identificados através da avaliação de risco.' },
            { id: '205-2', title: 'Comunicação e capacitação em políticas e procedimentos de combate à corrupção', requirements: 'a. Percentual e número total de membros do órgão de governança que foram comunicados sobre as políticas e procedimentos anticorrupção.|||b. Percentual e número total de parceiros de negócios comunicados.|||c. Percentual e número total de empregados que receberam treinamento anticorrupção.' },
            { id: '205-3', title: 'Casos confirmados de corrupção e medidas tomadas', requirements: 'a. Número total e natureza dos casos confirmados de corrupção.|||b. Número total de casos confirmados nos quais empregados foram demitidos ou sofreram ação disciplinar.|||c. Número total de contratos com parceiros de negócios terminados ou não renovados due a violações relacionadas à corrupção.' }
        ]
    },
    {
        id: 'GRI 206', title: 'GRI 206: Concorrência Desleal 2016',
        disclosures: [
            { id: '206-1', title: 'Ações judiciais por concorrência desleal, práticas de truste e monopólio', requirements: 'a. Número de ações judiciais pendentes ou concluídas durante o período de relato referentes a concorrência desleal, práticas antitruste e de monopólio, e seus resultados.' }
        ]
    },
    {
        id: 'GRI 207', title: 'GRI 207: Tributos 2019',
        disclosures: [
            { id: '207-1', title: 'Abordagem tributária', requirements: 'a. Descrição da abordagem tributária, incluindo: (i) estratégia fiscal; (ii) governança e conformidade fiscal; (iii) como a abordagem tributária é vinculada à estratégia de negócios e sustentabilidade.' },
            { id: '207-2', title: 'Governança, controle e gestão de risco fiscal', requirements: 'a. Descrição da estrutura de governança fiscal e de controle.|||b. Descrição dos mecanismos para que os órgãos de governança supervisionem a estratégia fiscal.|||c. Descrição da abordagem para gestão de risco fiscal.' },
            { id: '207-3', title: 'Engajamento de stakeholders e gestão de suas preocupações quanto a tributos', requirements: 'a. Descrição da abordagem para engajamento de stakeholders e gestão de suas preocupações relacionadas a impostos.|||b. Descrição da abordagem para engajamento com autoridades fiscais.' },
            { id: '207-4', title: 'Relato país-a-país', requirements: 'Para cada jurisdição fiscal: a. Nomes das entidades.|||b. Atividades primárias.|||c. Número de empregados.|||d. Receitas de vendas a terceiros e vendas intragrupo.|||e. Lucro/prejuízo antes do imposto.|||f. Imposto de renda pago em dinheiro.|||g. Imposto de renda acumulado sobre o lucro/prejuízo.|||h. Razões para a diferença entre o imposto acumulado e o imposto devido se usando a taxa legal.' }
        ]
    },
    // Environmental Series
    {
        id: 'GRI 301', title: 'GRI 301: Materiais 2016',
        disclosures: [
            { id: '301-1', title: 'Materiais utilizados, discriminados por peso ou volume', requirements: 'a. Peso ou volume total de materiais utilizados para produzir e embalar os principais produtos e serviços da organização, discriminados por: (i) materiais não renováveis utilizados; (ii) materiais renováveis utilizados.' },
            { id: '301-2', title: 'Matérias-primas ou materiais reciclados utilizados', requirements: 'a. Percentual de materiais reciclados utilizados para fabricar os principais produtos e serviços da organização.' },
            { id: '301-3', title: 'Produtos e suas embalagens reaproveitados', requirements: 'a. Percentual de produtos vendidos e suas embalagens que são recuperados ao final de sua vida útil, por categoria de produto.' }
        ]
    },
    {
        id: 'GRI 302', title: 'GRI 302: Energia 2016',
        disclosures: [
            { id: '302-1', title: 'Consumo de energia dentro da organização', requirements: 'a. Consumo total de combustível de fontes não renováveis.|||b. Consumo total de combustível de fontes renováveis.|||c. Consumo total de eletricidade, aquecimento, resfriamento e vapor.|||d. Consumo total de energia (soma de a, b, c).|||e. Venda de eletricidade, aquecimento, resfriamento e vapor.' },
            { id: '302-2', title: 'Consumo de energia fora da organização', requirements: 'a. Consumo de energia a montante e a jusante em joules ou seus múltiplos, e os escopos ou categorias do GHG Protocol incluídos.' },
            { id: '302-3', title: 'Intensidade energética', requirements: 'a. Taxa de intensidade energética para a organização.|||b. Métrica de organização-específica escolhida para o denominador.|||c. Tipos de energia incluídos na intensidade.' },
            { id: '302-4', title: 'Redução do consumo de energia', requirements: 'a. Volume das reduções do consumo de energia como resultado direto de iniciativas de conservação e eficiência.|||b. Tipos de energia incluídos.|||c. Base para o cálculo da redução.' },
            { id: '302-5', title: 'Reduções nos requisitos energéticos de produtos e serviços', requirements: 'a. Reduções nos requisitos energéticos de produtos e serviços vendidos durante o período de relato.' }
        ]
    },
    {
        id: 'GRI 303', title: 'GRI 303: Água e Efluentes 2018',
        disclosures: [
            { id: '303-1', title: 'Interações com a água como um recurso compartilhado', requirements: 'a. Descrição de como a organização interage com a água, incluindo como o descarte de água afeta os ecossistemas e stakeholders locais.' },
            { id: '303-2', title: 'Gestão de impactos relacionados ao descarte de água', requirements: 'a. Descrição da gestão dos impactos relacionados ao descarte de água, incluindo: (i) abordagem para definir padrões mínimos para a qualidade dos efluentes; (ii) abordagem para tratar efluentes; (iii) como a organização avalia e monitora a qualidade dos descartes.' },
            { id: '303-3', title: 'Captação de água', requirements: 'a. Captação total de água por fonte (superficial, subterrânea, etc.) em megalitros, para todas as áreas.|||b. Detalhes para áreas com estresse hídrico.' },
            { id: '303-4', title: 'Descarte de água', requirements: 'a. Total de descarte de água por destino (superficial, subterrânea, etc.) e por qualidade (tratada, não tratada) em megalitros, para todas as áreas.|||b. Detalhes para áreas com estresse hídrico.' },
            { id: '303-5', title: 'Consumo de água', requirements: 'a. Consumo total de água em megalitros para todas as áreas.|||b. Detalhes para áreas com estresse hídrico.' }
        ]
    },
    {
        id: 'GRI 304', title: 'GRI 304: Biodiversidade 2016',
        disclosures: [
            { id: '304-1', title: 'Unidades operacionais em ou adjacentes a áreas protegidas e áreas de alto valor de biodiversidade', requirements: 'a. Unidades operacionais próprias, arrendadas, gerenciadas em ou adjacentes a áreas protegidas e áreas de alto valor de biodiversidade fora de áreas protegidas. Para cada unidade operacional, relatar: i. a localização geográfica; ii. a subsuperfície e a área da superfície; iii. a posição em relação à área protegida ou área de alto valor de biodiversidade; iv. o tipo da área protegida ou área de alto valor de biodiversidade; v. o nome e o tamanho da área protegida ou área de alto valor de biodiversidade em quilômetros quadrados.' },
            { id: '304-2', title: 'Impactos significativos de atividades, produtos e serviços na biodiversidade', requirements: 'a. A natureza dos impactos diretos e indiretos significativos na biodiversidade com referência às atividades, produtos e serviços listados.|||b. Os impactos diretos e indiretos significativos na biodiversidade.|||c. As espécies afetadas, com base na extensão dos impactos.|||d. Medidas tomadas para gerenciar esses impactos e os resultados dessas ações.' },
            { id: '304-3', title: 'Habitats protegidos ou restaurados', requirements: 'a. Tamanho e localização de todos os habitats protegidos ou restaurados.|||b. Se a parceria para o habitat protegido ou restaurado é de longo prazo.|||c. Se o sucesso das atividades de restauração foi aprovado por peritos externos independentes.' },
            { id: '304-4', title: 'Espécies da Lista Vermelha da IUCN e de listas nacionais em habitats afetados', requirements: 'a. O número total de espécies da Lista Vermelha da IUCN e de listas de conservação nacionais com habitats em áreas afetadas pelas operações da organização, por nível de risco de extinção.' }
        ]
    },
    {
        id: 'GRI 101-BD', title: 'GRI 101: Biodiversidade 2024',
        disclosures: [
            { id: '101-1', title: 'Políticas para deter e reverter a perda de biodiversidade', requirements: 'a. Descrever suas políticas ou seus compromissos para deter e reverter a perda de biodiversidade e como eles são embasados pelos Objetivos para 2050 e pelas Metas para 2030 do Marco Global de Biodiversidade de Kunming-Montreal;|||b. Relatar até que ponto essas políticas ou esses compromissos se aplicam às atividades da organização e às suas relações de negócios;|||c. Relatar os objetivos e metas para deter e reverter a perda de biodiversidade, se eles são embasados por consenso científico, o ano-base e os indicadores usados para avaliar o progresso' },
            { id: '101-2', title: 'Gestão de impactos na biodiversidade', requirements: 'a. Relatar como aplica a hierarquia de mitigação, descrevendo: i. medidas tomadas para evitar impactos negativos na biodiversidade; ii. medidas tomadas para minimizar impactos negativos na biodiversidade que não foram evitados; iii. medidas tomadas para restaurar e reabilitar ecossistemas afetados, incluindo os objetivos de restauração e reabilitação, e como os stakeholders são engajados em todas as medidas de restauração e reabilitação; iv. medidas tomadas para compensar (offset) impactos residuais negativos na biodiversidade; v. medidas transformadoras tomadas e medidas adicionais de conservação tomadas;|||b. Em relação ao item 101-2-a-iii, relate para cada unidade com os impactos mais significativos na biodiversidade: i. o tamanho em hectares da área em restauração ou reabilitação; ii. o tamanho em hectares da área restaurada ou reabilitada;|||c. Em relação ao item 101-2-a-iv, relate para cada compensação: i. os objetivos; ii. a localização geográfica; iii. se e como são cumpridos os princípios das boas práticas de compensação; iv. se e como a compensação é certificada ou verificada por terceiros;|||d. Liste quais unidades operacionais com os impactos mais significativos na biodiversidade têm um plano de gestão da biodiversidade e explique por que as outras unidades não têm um plano de gestão;|||e. Descreva como ela aumenta as sinergias e reduz trade-offs (N. T. situações em que há conflito de escolha por uma medida em detrimento de outra) entre as medidas tomadas para gerir seus impactos na biodiversidade e no clima;|||f. Descreva como ela garante que as medidas tomadas para gerir os seus impactos na biodiversidade evitam e minimizam os impactos negativos e maximizam os impactos positivos para os stakeholders.' },
            { id: '101-3', title: 'Acesso e repartição justa e equitativa de benefícios', requirements: 'a. Descrever o processo para garantir a conformidade com os regulamentos e medidas de acesso e repartição justa e equitativa de benefícios;|||b. Descrever ações voluntárias adotadas para promover o acesso e a repartição justa e equitativa de benefícios que são adicionais às obrigações legais ou quando não há regulamentos e medidas.' },
            { id: '101-4', title: 'Identificação de impactos na biodiversidade', requirements: 'a. Explicar como determinou quais das suas unidades operacionais e quais produtos e serviços da sua cadeia de fornecedores têm os impactos reais e potenciais mais significativos na biodiversidade.' },
            { id: '101-5', title: 'Locais com impactos na biodiversidade', requirements: 'a. Relatar a localização e o tamanho em hectares de suas unidades operacionais com os impactos mais significativos na biodiversidade;|||b. Para cada unidade relatada no item 101-5-a, relate se ela está dentro ou próxima a uma área ecologicamente sensível, a distância até essas áreas e se elas são: i. áreas importantes para a biodiversidade; ii. áreas de alta integridade ecossistêmica; iii. áreas com rápido declínio da integridade ecossistêmica; iv. áreas com altos riscos físicos relacionados à água; v. áreas importantes para o fornecimento de benefícios dos serviços ecossistêmicos para os Povos Indígenas, para as comunidades locais e outros stakeholders;|||c. Relate as atividades que ocorrem em cada unidade relatada no item 101-5-a;|||d. Relate os produtos e serviços em sua cadeia de fornecedores com os impactos mais significativos na biodiversidade e os países ou jurisdições onde as atividades relacionadas a esses produtos e serviços são realizadas.' },
            { id: '101-6', title: 'Fatores diretos de perda de biodiversidade', requirements: 'a. Para cada unidade operacional relatada no item 101-5-a onde suas atividades levam ou poderiam levar a mudanças no uso da terra e do mar, relatar: i. o tamanho em hectares do ecossistema natural convertido desde uma data-limite ou data de referência, a data-limite ou a data de referência e o tipo de ecossistema antes e depois da conversão; ii. o tamanho, em hectares, da terra e do mar convertidos de um ecossistema intensamente usado ou modificado para outro durante o período de relato e o tipo de ecossistema antes e depois da conversão;|||b. Para cada unidade operacional relatada no item 101-5-a onde suas atividades levam ou poderiam levar a exploração de recursos naturais, relatar: i. para cada espécie selvagem colhida, a quantidade, o tipo e o risco de extinção; ii. captação de água e consumo de água em megalitros;|||c. Para cada unidade operacional relatada no item 101-5-a onde suas atividades levam ou poderiam levar à poluição, relate a quantidade e o tipo de cada poluente gerado;|||d. Para cada unidade operacional relatada no item 101-5-a onde suas atividades levam ou poderiam levar à introdução de espécies exóticas invasoras, descreva como as espécies exóticas invasoras são ou podem ser introduzidas;|||e. Para cada produto e serviço em sua cadeia de fornecedores relatados no item 101-5-d, relate as informações necessárias nos itens 101-6-a, 101-6-b, 101-6-c e 101-6-d, discriminando por país ou jurisdição;|||f. Relate informações contextuais necessárias para a compreensão de como os dados foram compilados, tais como normas, metodologias e premissas adotadas.' },
            { id: '101-7', title: 'Mudanças no estado da biodiversidade', requirements: 'a. Para cada unidade operacional relatada no item 101-5-a, relatar as seguintes informações sobre ecossistemas afetados ou potencialmente afetados: i. o tipo de ecossistema para o ano-base; ii. o tamanho do ecossistema em hectares para o ano-base; iii. a condição do ecossistema para o ano-base e o atual período de relato;|||b. Relatar informações contextuais necessárias para a compreensão de como os dados foram compilados, tais como normas, metodologias e premissas adotadas.' },
            { id: '101-8', title: 'Serviços ecossistêmicos', requirements: 'a. Listar os serviços ecossistêmicos e beneficiários afetados.|||b. Explicar como são ou poderiam ser afetados.' }
        ]
    },
    {
        id: 'GRI 305', title: 'GRI 305: Emissões 2016',
        disclosures: [
            { id: '305-1', title: 'Emissões diretas (Escopo 1) de GEE', requirements: 'a. Emissões brutas diretas (Escopo 1) de GEE em toneladas métricas de CO2 equivalente.|||b. Gases incluídos no cálculo.|||c. Emissões biogênicas de CO2.|||d. Ano base para o cálculo.|||e. Fonte dos fatores de emissão e taxas de potencial de aquecimento global (GWP).|||f. Abordagem de consolidação para emissões.|||g. Padrões, metodologias, premissas e/ou ferramentas de cálculo utilizadas.' },
            { id: '305-2', title: 'Emissões indiretas (Escopo 2) de GEE', requirements: 'a. Emissões brutas indiretas (Escopo 2) de GEE em toneladas métricas de CO2 equivalente (baseado em localização e em mercado).|||b. Gases incluídos no cálculo.|||c. Ano base para o cálculo.|||d. Fonte dos fatores de emissão e taxas de GWP.|||e. Padrões, metodologias, premissas e/ou ferramentas de cálculo utilizadas.' },
            { id: '305-3', title: 'Outras emissões indiretas (Escopo 3) de GEE', requirements: 'a. Emissões brutas indiretas (Escopo 3) de GEE em toneladas métricas de CO2 equivalente.|||b. Gases incluídos no cálculo.|||c. Categorias do Escopo 3 incluídas.|||d. Ano base para o cálculo.|||e. Fonte dos fatores de emissão e taxas de GWP.|||f. Padrões, metodologias, premissas e/ou ferramentas de cálculo utilizadas.' },
            { id: '305-4', title: 'Intensidade de emissões de GEE', requirements: 'a. Índice de intensidade de emissões de GEE para a organização.|||b. Métrica específica da organização escolhida para o denominador.|||c. Tipos de emissões de GEE incluídos na intensidade.' },
            { id: '305-5', title: 'Redução de emissões de GEE', requirements: 'a. Redução de emissões de GEE como resultado direto de iniciativas de redução, em toneladas métricas de CO2 equivalente.|||b. Gases incluídos.|||c. Escopos nos quais as reduções ocorreram.|||d. Ano base para o cálculo.' },
            { id: '305-6', title: 'Emissões de substâncias destruidoras da camada de ozônio (ODS)', requirements: 'a. Emissões de substâncias que destroem a camada de ozônio (ODS), em toneladas de CFC-11 equivalente.|||b. Substâncias incluídas no cálculo.|||c. Fonte dos fatores de emissão utilizados.|||d. Padrões, metodologias, premissas e/ou ferramentas de cálculo utilizados.' },
            { id: '305-7', title: 'Emissões de NOx, SOx e outras emissões atmosféricas significativas', requirements: 'a. Emissões de Óxidos de Nitrogênio (NOx), Óxidos de Enxofre (SOx), Poluentes Orgânicos Persistentes (POPs), Compostos Orgânicos Voláteis (COVs), Poluentes Atmosféricos Perigosos (HAPs) e Material Particulado (MP).' }
        ]
    },
    {
        id: 'GRI 306', title: 'GRI 306: Resíduos 2020',
        disclosures: [
            { id: '306-1', title: 'Geração de resíduos e impactos significativos', requirements: 'a. Descrever as entradas, atividades e saídas que levam à geração de resíduos e impactos significativos relacionados a resíduos.|||b. Descrição de como os impactos são gerenciados.' },
            { id: '306-2', title: 'Gestão de impactos significativos relacionados a resíduos', requirements: 'a. Medidas tomadas para evitar a produção de resíduos e garantir que os resíduos gerados sejam reutilizados, reciclados ou recuperados.|||b. Ações, incluindo engajamento com stakeholders, para mitigar impactos negativos significativos.' },
            { id: '306-3', title: 'Resíduos gerados', requirements: 'a. Peso total dos resíduos gerados em toneladas métricas, discriminado por composição.|||b. Detalhes contextuais para entender a geração de resíduos.' },
            { id: '306-4', title: 'Resíduos não destinados para disposição final', requirements: 'a. Peso total dos resíduos não destinados para disposição, discriminado por composição e por operações de recuperação (preparação para reutilização, reciclagem, outras operações de recuperação).' },
            { id: '306-5', title: 'Resíduos destinados para disposição final', requirements: 'a. Peso total dos resíduos destinados para disposição, discriminado por composição e por operações de disposição (incineração, aterro, outras operações de disposição).' }
        ]
    },
    {
        id: 'GRI 308', title: 'GRI 308: Avaliação Ambiental de Fornecedores 2016',
        disclosures: [
            { id: '308-1', title: 'Novos fornecedores selecionados com base em critérios ambientais', requirements: 'a. Percentual de novos fornecedores selecionados com base em critérios ambientais.' },
            { id: '308-2', title: 'Impactos ambientais negativos da cadeia de fornecedores e medidas tomadas', requirements: 'a. Número de fornecedores avaliados com relação aos impactos ambientais.|||b. Número de fornecedores identificados com impactos ambientais negativos significativos.|||c. Medidas tomadas para gerenciar esses impactos.' }
        ]
    },
    // Social Series
    {
        id: 'GRI 401', title: 'GRI 401: Emprego 2016',
        disclosures: [
            { id: '401-1', title: 'Novas contratações e rotatividade de empregados', requirements: 'a. Número total e taxa de novas contratações de empregados durante o período de relato, por faixa etária, gênero e região.|||b. Número total e taxa de rotatividade de empregados durante o período de relato, por faixa etária, gênero e região.' },
            { id: '401-2', title: 'Benefícios oferecidos a empregados em tempo integral que não são oferecidos a temporários', requirements: 'a. Benefícios padrão para empregados em tempo integral que não são oferecidos a empregados temporários ou em tempo parcial, por locais de operações significativas.' },
            { id: '401-3', title: 'Licença maternidade/paternidade', requirements: 'a. Número total de empregados com direito a tirar licença parental, por gênero.|||b. Número total de empregados que tiraram licença parental, por gênero.|||c. Taxas de retorno ao trabalho e retenção de empregados que tiraram licença parental, por gênero.' }
        ]
    },
    {
        id: 'GRI 402', title: 'GRI 402: Relações de Trabalho 2016',
        disclosures: [
            { id: '402-1', title: 'Prazo mínimo de aviso sobre mudanças operacionais', requirements: 'a. Prazo mínimo de aviso, em semanas, para mudanças operacionais significativas, e se isso está especificado em acordos coletivos.' }
        ]
    },
    {
        id: 'GRI 403', title: 'GRI 403: Saúde e Segurança do Trabalho 2018',
        disclosures: [
            { id: '403-1', title: 'Sistema de gestão de saúde e segurança do trabalho', requirements: 'a. Declaração sobre se foi implementado um sistema de gestão de saúde e segurança do trabalho e quais trabalhadores estão cobertos por ele.' },
            { id: '403-2', title: 'Identificação de periculosidade, avaliação de riscos e investigação de incidentes', requirements: 'a. Descrição dos processos utilizados para identificar periculosidade, avaliar riscos e investigar incidentes relacionados ao trabalho.' },
            { id: '403-3', title: 'Serviços de saúde do trabalho', requirements: 'a. Descrição dos serviços de saúde do trabalho prestados aos trabalhadores.|||b. Descrição de como a organização facilita o acesso dos trabalhadores a esses serviços.|||c. Descrição de como a organização busca garantir a qualidade desses serviços de saúde, incluindo se são baseados em padrões profissionais e fornecidos por profissionais competentes.|||d. Descrição de como os dados de saúde dos trabalhadores são usados e protegidos.' },
            { id: '403-4', title: 'Participação, consulta e comunicação aos trabalhadores sobre saúde e segurança', requirements: 'a. Descrição dos processos para participação e consulta dos trabalhadores em saúde e segurança do trabalho.' },
            { id: '403-5', title: 'Capacitação de trabalhadores em saúde e segurança do trabalho', requirements: 'a. Descrição de capacitação em saúde e segurança do trabalho oferecida aos trabalhadores, incluindo temas e frequência.' },
            { id: '403-6', title: 'Promoção da saúde do trabalhador', requirements: 'a. Descrição dos programas e iniciativas voluntárias de promoção da saúde oferecidos aos trabalhadores para abordar importantes problemas de saúde não relacionados ao trabalho.|||b. Descrição de como a organização facilita o acesso dos trabalhadores a esses programas.|||c. Descrição do escopo desses programas, incluindo quais trabalhadores e suas famílias têm acesso.' },
            { id: '403-7', title: 'Prevenção e mitigação de impactos na saúde e segurança diretamente ligados às relações de negócio', requirements: 'a. Descrição de como a organização previne ou mitiga impactos negativos significativos na saúde e segurança do trabalho que estão diretamente ligados às suas operações, produtos ou serviços por suas relações de negócios.' },
            { id: '403-8', title: 'Trabalhadores cobertos pelo sistema de gestão de saúde e segurança do trabalho', requirements: 'a. Número total e percentual de todos os trabalhadores cobertos por um sistema de gestão de saúde e segurança do trabalho.|||b. Descrição de quaisquer trabalhadores que não são cobertos por um sistema de gestão de saúde e segurança do trabalho e os motivos para não os cobrir.|||c. Descrição se o sistema de gestão de saúde e segurança do trabalho foi implementado com base em um requisito legal ou em uma norma reconhecida, ou se foi auditado ou certificado por um terceiro independente.' },
            { id: '403-9', title: 'Acidentes de trabalho', requirements: 'a. Para todos os empregados: (i) número e índice de fatalidades como resultado de um acidente de trabalho; (ii) número e índice de acidentes de trabalho com consequências graves (excluindo fatalidades); (iii) número e índice de acidentes de trabalho registráveis; (iv) principais tipos de acidentes de trabalho; (v) número de horas trabalhadas.|||b. Para todos os trabalhadores que não são empregados, mas cujo trabalho e/ou local de trabalho é controlado pela organização: (i) número e índice de fatalidades como resultado de um acidente de trabalho; (ii) número e índice de acidentes de trabalho com consequências graves (excluindo fatalidades); (iii) número e índice de acidentes de trabalho registráveis; (iv) principais tipos de acidentes de trabalho; (v) número de horas trabalhadas.|||c. Os perigos relacionados ao trabalho que representam um risco de lesão de alta consequência.|||d. Quaisquer ações tomadas para eliminar esses perigos e minimizar os riscos.' },
            { id: '403-10', title: 'Doenças profissionais', requirements: 'a. Para todos os empregados: (i) número de fatalidades como resultado de doença profissional; (ii) número de casos de doenças profissionais registráveis.|||b. Para todos os trabalhadores que não são empregados, mas cujo trabalho e/ou local de trabalho é controlado pela organização: (i) número de fatalidades como resultado de doença profissional; (ii) número de casos de doenças profissionais registráveis.' }
        ]
    },
    {
        id: 'GRI 404', title: 'GRI 404: Capacitação e Educação 2016',
        disclosures: [
            { id: '404-1', title: 'Média de horas de capacitação por ano, por empregado', requirements: 'a. Média de horas de capacitação por empregado por ano, discriminada por gênero e categoria funcional.' },
            { id: '404-2', title: 'Programas para o aperfeiçoamento de competências e de assistência para transição de carreira', requirements: 'a. Tipo e escopo dos programas de aperfeiçoamento de competências dos empregados.|||b. Programas de assistência para transição de carreira para facilitar a continuidade do emprego para empregados que estão terminando suas carreiras.' },
            { id: '404-3', title: 'Percentual de empregados que recebem avaliações regulares de desempenho', requirements: 'a. Percentual do total de empregados que receberam avaliação regular de desempenho e desenvolvimento de carreira, por gênero e categoria funcional.' }
        ]
    },
    {
        id: 'GRI 405', title: 'GRI 405: Diversidade e Igualdade de Oportunidades 2016',
        disclosures: [
            { id: '405-1', title: 'Diversidade em órgãos de governança e empregados', requirements: 'a. Percentual de indivíduos em órgãos de governança por categoria de diversidade (gênero, faixa etária, etc.).|||b. Percentual de empregados por categoria de diversidade (gênero, faixa etária, etc.) por categoria funcional.' },
            { id: '405-2', title: 'Proporção entre o salário-base e a remuneração recebidos pelas mulheres e homens', requirements: 'a. Proporção entre o salário-base e a remuneração de mulheres e homens por categoria funcional, por locais de operações significativas.' }
        ]
    },
    {
        id: 'GRI 406', title: 'GRI 406: Não Discriminação 2016',
        disclosures: [
            { id: '406-1', title: 'Casos de discriminação e medidas corretivas tomadas', requirements: 'a. Número total de casos de discriminação ocorridos durante o período de relato.|||b. Medidas corretivas tomadas.' }
        ]
    },
    {
        id: 'GRI 407', title: 'GRI 407: Liberdade Sindical e Negociação Coletiva 2016',
        disclosures: [
            { id: '407-1', title: 'Operações e fornecedores em que o direito à liberdade sindical pode estar em risco', requirements: 'a. Operações e fornecedores nos quais o direito de exercer a liberdade sindical e a negociação coletiva pode ser violado ou estar em risco significativo.' }
        ]
    },
    {
        id: 'GRI 408', title: 'GRI 408: Trabalho Infantil 2016',
        disclosures: [
            { id: '408-1', title: 'Operações e fornecedores com risco significativo de casos de trabalho infantil', requirements: 'a. Operações e fornecedores com riscos significativos de ocorrência de trabalho infantil, e as medidas tomadas para contribuir para a eliminação do trabalho infantil.' }
        ]
    },
    {
        id: 'GRI 409', title: 'GRI 409: Trabalho Forçado ou Análogo ao Escravo 2016',
        disclosures: [
            { id: '409-1', title: 'Operações e fornecedores com risco significativo de casos de trabalho forçado', requirements: 'a. Operações e fornecedores com riscos significativos de ocorrência de trabalho forçado ou análogo ao escravo, e as medidas tomadas para contribuir para a eliminação de todas as formas de trabalho forçado.' }
        ]
    },
    {
        id: 'GRI 410', title: 'GRI 410: Práticas de Segurança 2016',
        disclosures: [
          { id: '410-1', title: 'Pessoal de segurança capacitado em políticas ou procedimentos de direitos humanos', requirements: 'a. Percentual do pessoal de segurança que recebeu capacitação formal nas políticas ou procedimentos de direitos humanos da organização que são relevantes para as operações.' }
        ]
    },
    {
        id: 'GRI 411', title: 'GRI 411: Direitos de Povos Indígenas 2016',
        disclosures: [
          { id: '411-1', title: 'Casos de violação de direitos de povos indígenas', requirements: 'a. Número total de casos identificados de violações envolvendo os direitos dos povos indígenas e as medidas tomadas.' }
        ]
    },
    {
        id: 'GRI 413', title: 'GRI 413: Comunidades Locais 2016',
        disclosures: [
            { id: '413-1', title: 'Operações com engajamento, avaliações de impacto e programas de desenvolvimento', requirements: 'a. Percentual de operações que implementaram engajamento com a comunidade local, avaliações de impacto e programas de desenvolvimento.' },
            { id: '413-2', title: 'Operações com impactos negativos significativos nas comunidades locais', requirements: 'a. Operações com impactos negativos reais e potenciais significativos nas comunidades locais, e as medidas tomadas para mitigá-los.' }
        ]
    },
    {
        id: 'GRI 414', title: 'GRI 414: Avaliação Social de Fornecedores 2016',
        disclosures: [
            { id: '414-1', title: 'Novos fornecedores selecionados com base em critérios sociais', requirements: 'a. Percentual de novos fornecedores selecionados com base em critérios sociais.' },
            { id: '414-2', title: 'Impactos sociais negativos da cadeia de fornecedores e medidas tomadas', requirements: 'a. Número de fornecedores avaliados com relação aos impactos sociais.|||b. Número de fornecedores identificados com impactos sociais negativos significativos.|||c. Medidas tomadas para gerenciar esses impactos.' }
        ]
    },
    {
        id: 'GRI 415', title: 'GRI 415: Políticas Públicas 2016',
        disclosures: [
            { id: '415-1', title: 'Contribuições políticas', requirements: 'a. Valor monetário total de contribuições políticas financeiras e em espécie feitas diretamente e indiretamente pela organização, por país e por destinatário.' }
        ]
    },
    {
        id: 'GRI 416', title: 'GRI 416: Saúde e Segurança do Consumidor 2016',
        disclosures: [
            { id: '416-1', title: 'Avaliação dos impactos na saúde e segurança causados por categorias de produtos e serviços', requirements: 'a. Percentual de categorias significativas de produtos e serviços para as quais são avaliados os impactos na saúde e segurança para fins de melhoria.' },
            { id: '416-2', title: 'Casos de não conformidade em relação aos impactos na saúde e segurança', requirements: 'a. Número total de casos de não conformidade com regulamentos e/ou códigos voluntários relativos aos impactos na saúde e segurança de produtos e serviços durante seu ciclo de vida, por tipo de resultado.' }
        ]
    },
    {
        id: 'GRI 417', title: 'GRI 417: Marketing e Rotulagem 2016',
        disclosures: [
            { id: '417-1', title: 'Requisitos para informações e rotulagem de produtos e serviços', requirements: 'a. Se os tipos de informações sobre produtos e serviços são exigidos pelos procedimentos da organização para informações e rotulagem de produtos e serviços, e o percentual de produtos e serviços significativos sujeitos a tais requisitos.' },
            { id: '417-2', title: 'Casos de não conformidade em relação a informações e rotulagem', requirements: 'a. Número total de casos de não conformidade com regulamentos e/ou códigos voluntários relativos a informações e rotulagem de produtos e serviços, por tipo de resultado.' },
            { id: '417-3', title: 'Casos de não conformidade em relação a comunicação de marketing', requirements: 'a. Número total de casos de não conformidade com regulamentos e/ou códigos voluntários relativos a comunicações de marketing, incluindo publicidade, promoção e patrocínio, por tipo de resultado.' }
        ]
    },
    {
        id: 'GRI 418', title: 'GRI 418: Privacidade do Cliente 2016',
        disclosures: [
            { id: '418-1', title: 'Queixas comprovadas relativas a violação da privacidade e perda de dados de clientes', requirements: 'a. Número total de queixas comprovadas relativas a violação da privacidade e perda de dados de clientes.' }
        ]
    },
    // Sector Standards
    {
      id: 'GRI 11', title: 'GRI 11: Setor de Petróleo e Gás 2021',
      disclosures: [
        { id: '11-1', title: 'Emissões de GEE', requirements: 'Relatar sobre Conteúdo 3-3, 302-1, 302-2, 302-3, 305-1, 305-2, 305-3, 305-4 e recomendações adicionais: a. (3-3 adicional) Descreva as medidas tomadas para gerenciar queima e liberação na atmosfera e a eficácia dessas medidas.|||b. (305-1 adicional) Relate o percentual das emissões diretas brutas (Escopo 1) de GEE de CH4.  Relate uma discriminação das emissões diretas brutas (Escopo 1) de GEE por tipo de fonte (combustão estacionária, processo, fugitiva).' },
        { id: '11-2', title: 'Adaptação, resiliência e transição climática', requirements: 'Relatar sobre Conteúdo 3-3, 201-2, 305-5 e recomendações e conteúdos adicionais.' },
        { id: '11-3', title: 'Emissões atmosféricas', requirements: 'Relatar sobre Conteúdo 3-3, 305-7, 416-1 e recomendações adicionais.' },
        { id: '11-4', title: 'Biodiversidade', requirements: 'Relatar sobre Conteúdo 3-3, 304-1, 304-2, 304-3, 304-4 e recomendações adicionais.' },
        { id: '11-5', title: 'Resíduos', requirements: 'Relatar sobre Conteúdo 3-3, 306-1, 306-2, 306-3, 306-4, 306-5 e recomendações adicionais.' },
        { id: '11-6', title: 'Água e efluentes', requirements: 'Relatar sobre Conteúdo 3-3, 303-1, 303-2, 303-3, 303-4, 303-5 e recomendações adicionais.' },
        { id: '11-7', title: 'Encerramento e reabilitação', requirements: 'Relatar sobre Conteúdo 3-3, 402-1, 404-2 e conteúdos adicionais.' },
        { id: '11-8', title: 'Integridade de ativos e gestão de acidentes', requirements: 'Relatar sobre Conteúdo 3-3, 306-3 e conteúdos adicionais.' },
        { id: '11-9', title: 'Saúde e segurança do trabalho', requirements: 'Relatar sobre Conteúdo 3-3, 403-1 a 403-10.' },
        { id: '11-10', title: 'Práticas empregatícias', requirements: 'Relatar sobre Conteúdo 3-3, 401-1, 402-1, 404-2, 414-2.' },
        { id: '11-11', title: 'Não discriminação e igualdade de oportunidades', requirements: 'Relatar sobre Conteúdo 3-3, 202-2, 401-3, 405-1, 405-2, 406-1.' },
        { id: '11-12', title: 'Trabalho forçado e escravidão moderna', requirements: 'Relatar sobre Conteúdo 3-3, 409-1, 414-1.' },
        { id: '11-13', title: 'Liberdade sindical e negociação coletiva', requirements: 'Relatar sobre Conteúdo 3-3, 407-1.' },
        { id: '11-14', title: 'Impactos econômicos', requirements: 'Relatar sobre Conteúdo 3-3, 201-1, 202-2, 203-1, 203-2, 204-1.' },
        { id: '11-15', title: 'Comunidades locais', requirements: 'Relatar sobre Conteúdo 3-3, 413-1, 413-2 e recomendações e conteúdos adicionais.' },
        { id: '11-16', title: 'Direitos à terra e aos recursos naturais', requirements: 'Relatar sobre Conteúdo 3-3 e conteúdos adicionais.' },
        { id: '11-17', title: 'Direitos de povos indígenas', requirements: 'Relatar sobre Conteúdo 3-3, 411-1 e recomendações e conteúdos adicionais.' },
        { id: '11-18', title: 'Conflito e segurança', requirements: 'Relatar sobre Conteúdo 3-3, 410-1 e recomendações adicionais.' },
        { id: '11-19', title: 'Concorrência desleal', requirements: 'Relatar sobre Conteúdo 3-3, 206-1.' },
        { id: '11-20', title: 'Combate à corrupção', requirements: 'Relatar sobre Conteúdo 3-3, 205-1, 205-2, 205-3 e recomendações e conteúdos adicionais.' },
        { id: '11-21', title: 'Pagamentos a governos', requirements: 'Relatar sobre Conteúdo 3-3, 201-1, 201-4, 207-1, 207-2, 207-3, 207-4 e recomendações e conteúdos adicionais.' },
        { id: '11-22', title: 'Políticas públicas', requirements: 'Relatar sobre Conteúdo 3-3, 415-1 e recomendações adicionais.' },
      ]
    },
    {
      id: 'GRI 12', title: 'GRI 12: Setor de Carvão 2022',
      disclosures: [
        { id: '12-1', title: 'Emissões de GEE', requirements: 'Relatar sobre Conteúdo 3-3, 302-1, 302-3, 305-1, 305-2, 305-3, 305-4 e recomendações adicionais.' },
        { id: '12-2', title: 'Adaptação, resiliência e transição climática', requirements: 'Relatar sobre Conteúdo 3-3, 201-2, 305-5 e recomendações e conteúdos adicionais.' },
        { id: '12-3', title: 'Encerramento e reabilitação', requirements: 'Relatar sobre Conteúdo 3-3, 402-1, 404-2 e conteúdos adicionais.' },
        { id: '12-4', title: 'Emissões atmosféricas', requirements: 'Relatar sobre Conteúdo 3-3, 305-7 e recomendações adicionais.' },
        { id: '12-5', title: 'Biodiversidade', requirements: 'Relatar sobre Conteúdo 3-3, 304-1, 304-2, 304-3, 304-4 e recomendações adicionais.' },
        { id: '12-7', title: 'Água e efluentes', requirements: 'Relatar sobre Conteúdo 3-3, 303-1, 303-2, 303-3, 303-4, 303-5.' },
        { id: '12-8', title: 'Impactos econômicos', requirements: 'Relatar sobre Conteúdo 3-3, 201-1, 202-2, 203-2, 204-1.' },
        { id: '12-9', title: 'Comunidades locais', requirements: 'Relatar sobre Conteúdo 3-3, 413-1, 413-2 e recomendações e conteúdos adicionais.' },
        { id: '12-10', title: 'Direitos à terra e aos recursos naturais', requirements: 'Relatar sobre Conteúdo 3-3 e conteúdos adicionais.' },
        { id: '12-11', title: 'Direitos de povos indígenas', requirements: 'Relatar sobre Conteúdo 3-3, 411-1 e recomendações e conteúdos adicionais.' },
        { id: '12-12', title: 'Conflito e segurança', requirements: 'Relatar sobre Conteúdo 3-3, 410-1 e recomendações adicionais.' },
        { id: '12-13', title: 'Integridade de ativos e gestão de acidentes', requirements: 'Relatar sobre Conteúdo 3-3, 306-3 e conteúdos adicionais.' },
        { id: '12-14', title: 'Saúde e segurança do trabalho', requirements: 'Relatar sobre Conteúdo 3-3, 403-1 a 403-10.' },
        { id: '12-16', title: 'Trabalho infantil', requirements: 'Relatar sobre Conteúdo 3-3, 408-1, 414-1.' },
        { id: '12-17', title: 'Trabalho forçado e escravidão moderna', requirements: 'Relatar sobre Conteúdo 3-3, 409-1, 414-1.' },
        { id: '12-18', title: 'Liberdade sindical e negociação coletiva', requirements: 'Relatar sobre Conteúdo 3-3, 407-1.' },
        { id: '12-20', title: 'Combate à corrupção', requirements: 'Relatar sobre Conteúdo 3-3, 205-1, 205-2, 205-3 e recomendações e conteúdos adicionais.' },
        { id: '12-21', title: 'Pagamentos a governos', requirements: 'Relatar sobre Conteúdo 3-3, 201-1, 201-4, 207-1, 207-2, 207-3, 207-4 e recomendações e conteúdos adicionais.' },
        { id: '12-22', title: 'Políticas públicas', requirements: 'Relatar sobre Conteúdo 3-3, 415-1 e recomendações adicionais.' },
      ]
    },
    {
      id: 'GRI 13', title: 'GRI 13: Setores de Agropecuária, Aquicultura e Pesca 2022',
      disclosures: [
        { id: '13-1', title: 'Emissões', requirements: 'Relatar sobre Conteúdo 3-3, 305-1, 305-2, 305-3, 305-4, 305-5, 305-6, 305-7 e recomendações adicionais.' },
        { id: '13-2', title: 'Adaptação e resiliência climática', requirements: 'Relatar sobre Conteúdo 3-3, 201-2 e recomendações adicionais.' },
        { id: '13-3', title: 'Biodiversidade', requirements: 'Relatar sobre Conteúdo 3-3, 304-1, 304-2, 304-3, 304-4 e conteúdos adicionais.' },
        { id: '13-4', title: 'Conversão de ecossistemas naturais', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações e conteúdos adicionais.' },
        { id: '13-5', title: 'Saúde do solo', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações adicionais.' },
        { id: '13-6', title: 'Uso de agrotóxicos', requirements: 'Relatar sobre Conteúdo 3-3 e conteúdos adicionais.' },
        { id: '13-7', title: 'Água e efluentes', requirements: 'Relatar sobre Conteúdo 3-3, 303-1 a 303-5.' },
        { id: '13-8', title: 'Resíduos', requirements: 'Relatar sobre Conteúdo 3-3, 306-1 a 306-5 e recomendações adicionais.' },
        { id: '13-9', title: 'Segurança alimentar', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações e conteúdos adicionais.' },
        { id: '13-10', title: 'Inocuidade dos alimentos', requirements: 'Relatar sobre Conteúdo 3-3, 416-1, 416-2 e conteúdos adicionais.' },
        { id: '13-11', title: 'Saúde e bem-estar animal', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações e conteúdos adicionais.' },
        { id: '13-12', title: 'Comunidades locais', requirements: 'Relatar sobre Conteúdo 3-3, 413-1, 413-2.' },
        { id: '13-13', title: 'Direitos à terra e aos recursos naturais', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações adicionais.' },
        { id: '13-14', title: 'Direitos de povos indígenas', requirements: 'Relatar sobre Conteúdo 3-3, 411-1 e recomendações e conteúdos adicionais.' },
        { id: '13-15', title: 'Não discriminação e igualdade de oportunidades', requirements: 'Relatar sobre Conteúdo 3-3, 405-1, 405-2, 406-1.' },
        { id: '13-16', title: 'Trabalho forçado ou análogo ao escravo', requirements: 'Relatar sobre Conteúdo 3-3, 409-1.' },
        { id: '13-17', title: 'Trabalho infantil', requirements: 'Relatar sobre Conteúdo 3-3, 408-1.' },
        { id: '13-18', title: 'Liberdade sindical e negociação coletiva', requirements: 'Relatar sobre Conteúdo 3-3, 407-1.' },
        { id: '13-19', title: 'Saúde e segurança do trabalho', requirements: 'Relatar sobre Conteúdo 3-3, 403-1 a 403-10.' },
        { id: '13-20', title: 'Práticas empregatícias', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações adicionais.' },
        { id: '13-21', title: 'Renda digna e salário digno', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações e conteúdos adicionais.' },
        { id: '13-22', title: 'Inclusão econômica', requirements: 'Relatar sobre Conteúdo 3-3, 203-1, 203-2 e recomendações adicionais.' },
        { id: '13-23', title: 'Rastreabilidade da cadeia de fornecedores', requirements: 'Relatar sobre Conteúdo 3-3 e recomendações e conteúdos adicionais.' },
        { id: '13-24', title: 'Políticas públicas', requirements: 'Relatar sobre Conteúdo 3-3, 415-1.' },
        { id: '13-26', title: 'Combate à corrupção', requirements: 'Relatar sobre Conteúdo 3-3, 205-1 a 205-3.' },
      ]
    },
];

const sasbStandards: SASBStandard[] = [
    // Renewable Resources & Alternative Energy
    {
        id: 'SASB-BF', title: 'SASB - Biocombustíveis',
        disclosures: [
            { id: 'RR-BC-110a.1', title: 'Análise do Ciclo de Vida das Emissões de GEE', requirements: 'Emissões de GEE do ciclo de vida por unidade de energia do combustível.' },
            { id: 'RR-BC-130a.1', title: 'Gestão da Água', requirements: 'Volume total de água retirada e consumida, percentual em regiões com estresse hídrico.' },
            { id: 'RR-BC-410a.1', title: 'Impactos no Abastecimento de Alimentos', requirements: 'Descrição da abordagem para gerenciar os impactos no abastecimento e preços dos alimentos.' },
        ]
    },
    {
        id: 'SASB-FM', title: 'SASB - Manejo Florestal',
        disclosures: [
            { id: 'RR-FM-160a.1', title: 'Impactos na Biodiversidade', requirements: 'Área de terra em zonas de alto valor de conservação.' },
            { id: 'RR-FM-430a.1', title: 'Certificação de Terras', requirements: 'Percentual da área total de terra certificada por esquemas de terceiros.' },
            { id: 'RR-FM-430a.2', title: 'Sequestro de Carbono', requirements: 'Estoque total de carbono em terras manejadas.' },
        ]
    },
    {
        id: 'SASB-FC', title: 'SASB - Células de Combustível e Baterias Industriais',
        disclosures: [
            { id: 'RT-FC-410a.1', title: 'Fornecimento de Materiais e Minerais de Conflito', requirements: 'Discussão sobre a estratégia de fornecimento de materiais críticos (lítio, cobalto, etc.).' },
            { id: 'RT-FC-410a.2', title: 'Gestão de Fim de Vida dos Produtos', requirements: 'Taxa de reciclagem de baterias e células de combustível.' },
        ]
    },
    {
        id: 'SASB-PP', title: 'SASB - Produtos de Celulose e Papel',
        disclosures: [
            { id: 'RR-PP-110a.1', title: 'Intensidade Energética e Emissões de GEE', requirements: 'Intensidade de GEE (CO2e/tonelada de produto) e consumo de energia.' },
            { id: 'RR-PP-430a.1', title: 'Fornecimento de Fibra', requirements: 'Percentual de fibra de madeira proveniente de fontes certificadas.' },
            { id: 'RR-PP-140a.1', title: 'Qualidade do Efluente', requirements: 'Volume de efluentes descartados e Demanda Bioquímica de Oxigênio (DBO).' },
        ]
    },
    {
        id: 'SASB-ST', title: 'SASB - Tecnologia Solar e Desenvolvedores de Projetos',
        disclosures: [
            { id: 'RR-ST-410a.1', title: 'Fornecimento de Materiais', requirements: 'Discussão sobre a gestão de riscos na cadeia de suprimentos (polissilício, etc.).' },
            { id: 'RR-ST-410a.2', title: 'Gestão de Fim de Vida dos Painéis', requirements: 'Quantidade de resíduos de painéis solares e taxa de reciclagem.' },
            { id: 'RR-ST-220a.1', title: 'Impactos no Uso da Terra e Biodiversidade', requirements: 'Descrição da abordagem para seleção de locais e gestão de impactos na biodiversidade.' },
        ]
    },
    {
        id: 'SASB-WT', title: 'SASB - Tecnologia Eólica e Desenvolvedores de Projetos',
        disclosures: [
            { id: 'RR-WT-210a.1', title: 'Impactos na Vida Selvagem e Habitats', requirements: 'Número de fatalidades de aves e morcegos, por espécie.' },
            { id: 'RR-WT-410a.1', title: 'Reciclagem de Pás de Turbina', requirements: 'Quantidade de material de pás de turbina descomissionado e percentual reciclado.' },
            { id: 'RR-WT-540a.1', title: 'Saúde e Segurança da Comunidade', requirements: 'Número de incidentes relacionados à falha de componentes (gelo, pás, etc.).' },
        ]
    },
     // Infrastructure
    {
        id: 'SASB-EU', title: 'SASB - Concessionárias de Energia Elétrica e Geração de Energia',
        disclosures: [
            { id: 'IF-EU-110a.1', title: 'Emissões de GEE', requirements: 'Intensidade de emissões de CO2, SO2 e NOx (kg/MWh).' },
            { id: 'IF-EU-140a.1', title: 'Gestão de Água', requirements: 'Volume total de água retirada e consumida por tipo de tecnologia de resfriamento.' },
            { id: 'IF-EU-540a.1', title: 'Resiliência da Rede e Segurança', requirements: 'Duração média de interrupção do sistema (SAIDI) e frequência (SAIFI).' },
            { id: 'IF-EU-550a.1', title: 'Segurança Nuclear', requirements: 'Número de eventos de segurança nuclear classificados pela AIEA.' },
        ]
    },
    {
        id: 'SASB-EC', title: 'SASB - Serviços de Engenharia e Construção',
        disclosures: [
            { id: 'IF-EC-540a.1', title: 'Governança e Integridade de Projetos', requirements: 'Receita total de projetos com componentes de sustentabilidade certificados.' },
            { id: 'IF-EC-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR, fatalidades e taxa de quase-acidentes.' },
            { id: 'IF-EC-130a.1', title: 'Gestão de Água', requirements: 'Descrição das práticas para gerenciar o escoamento de águas pluviais e a qualidade da água.' },
        ]
    },
    {
        id: 'SASB-GU', title: 'SASB - Concessionárias e Distribuidoras de Gás',
        disclosures: [
            { id: 'IF-GU-110a.1', title: 'Emissões de Metano', requirements: 'Percentual de emissões fugitivas de metano sobre o total de gás transportado.' },
            { id: 'IF-GU-540a.1', title: 'Integridade da Infraestrutura de Distribuição', requirements: 'Número de vazamentos por tipo de risco e milhas de dutos.' },
            { id: 'IF-GU-210a.1', title: 'Segurança e Acessibilidade do Cliente', requirements: 'Número de incidentes de segurança com o cliente e fatalidades.' },
        ]
    },
    {
        id: 'SASB-HB', title: 'SASB - Construtoras de Imóveis',
        disclosures: [
            { id: 'IF-HB-240a.1', title: 'Eficiência Energética de Edifícios', requirements: 'Percentual de casas construídas que atendem a certificações de construção verde (LEED, etc.).' },
            { id: 'IF-HB-140a.1', title: 'Gestão de Água em Empreendimentos', requirements: 'Percentual de casas com equipamentos eficientes em água e paisagismo resistente à seca.' },
            { id: 'IF-HB-410a.1', title: 'Fornecimento de Materiais e Gestão de Resíduos', requirements: 'Percentual de materiais de construção de fontes recicladas ou sustentáveis.' },
        ]
    },
    {
        id: 'SASB-RE', title: 'SASB - Imobiliárias e Serviços Imobiliários',
        disclosures: [
            { id: 'IF-RE-130a.1', title: 'Consumo de Energia em Portfólio', requirements: 'Consumo de energia por metro quadrado para o portfólio gerenciado.' },
            { id: 'IF-RE-140a.1', title: 'Consumo de Água em Portfólio', requirements: 'Consumo de água por metro quadrado para o portfólio gerenciado.' },
            { id: 'IF-RE-450a.1', title: 'Resiliência Climática', requirements: 'Área de edifícios localizados em planícies de inundação de 100 anos.' },
        ]
    },
    {
        id: 'SASB-WM', title: 'SASB - Gestão de Resíduos',
        disclosures: [
            { id: 'SV-WM-110a.1', title: 'Emissões de GEE de Aterros', requirements: 'Emissões de metano de aterros e percentual capturado.' },
            { id: 'SV-WM-150a.1', title: 'Taxas de Desvio de Resíduos', requirements: 'Taxa de desvio de aterro, por fluxo de resíduo (reciclagem, compostagem, etc.).' },
            { id: 'SV-WM-120a.1', title: 'Qualidade do Ar', requirements: 'Emissões de poluentes atmosféricos perigosos (HAPs).' },
        ]
    },
    {
        id: 'SASB-WU', title: 'SASB - Concessionárias e Serviços de Água',
        disclosures: [
            { id: 'IF-WU-140a.1', title: 'Qualidade da Água e Conformidade', requirements: 'Percentual da população atendida em conformidade com os padrões de água potável.' },
            { id: 'IF-WU-140b.1', title: 'Integridade da Infraestrutura de Distribuição', requirements: 'Taxa de perda de água na rede de distribuição.' },
            { id: 'IF-WU-450a.1', title: 'Gestão do Risco de Escassez Hídrica', requirements: 'Descrição da estratégia de gestão de secas e resiliência hídrica.' },
        ]
    },
    // Resource Transformation
    {
        id: 'SASB-AD', title: 'SASB - Aeronáutica e Defesa',
        disclosures: [
            { id: 'RT-AD-250a.1', title: 'Segurança e Qualidade do Produto', requirements: 'Número de recalls e investigações de segurança.' },
            { id: 'RT-AD-410a.1', title: 'Gestão da Cadeia de Suprimentos', requirements: 'Percentual de fornecedores avaliados em critérios sociais e ambientais.' },
            { id: 'RT-AD-510a.1', title: 'Corrupção e Ética nos Negócios', requirements: 'Valor total de perdas monetárias por corrupção e suborno.' },
        ]
    },
    {
        id: 'SASB-CH', title: 'SASB - Químicos',
        disclosures: [
            { id: 'RT-CH-110a.1', title: 'Intensidade de Emissões de GEE', requirements: 'Intensidade de GEE (CO2e/receita) e consumo de energia.' },
            { id: 'RT-CH-410a.1', title: 'Segurança de Produtos Químicos', requirements: 'Percentual de receita de produtos em conformidade com regulações de segurança (REACH, etc.).' },
            { id: 'RT-CH-150a.1', title: 'Gestão de Resíduos Perigosos', requirements: 'Quantidade de resíduos perigosos gerados e percentual reciclado.' },
        ]
    },
    {
        id: 'SASB-CP', title: 'SASB - Embalagens e Recipientes',
        disclosures: [
            { id: 'RT-CP-410a.1', title: 'Fornecimento de Matéria-Prima', requirements: 'Percentual de matéria-prima de fontes recicladas e/ou renováveis certificadas.' },
            { id: 'RT-CP-410b.1', title: 'Design para Reciclabilidade', requirements: 'Percentual de produtos projetados para serem recicláveis ou compostáveis.' },
            { id: 'RT-CP-130a.1', title: 'Gestão de Água', requirements: 'Volume total de água consumida, percentual em regiões com estresse hídrico.' },
        ]
    },
    {
        id: 'SASB-EE', title: 'SASB - Equipamentos Elétricos e Eletrônicos',
        disclosures: [
            { id: 'RT-EE-410a.1', title: 'Gestão de Resíduos Eletrônicos (E-waste)', requirements: 'Taxa de coleta e reciclagem de produtos em fim de vida.' },
            { id: 'RT-EE-410a.2', title: 'Minerais de Conflito na Cadeia de Suprimentos', requirements: 'Descrição da devida diligência para estanho, tungstênio, tântalo e ouro.' },
            { id: 'RT-EE-410b.1', title: 'Eficiência Energética de Produtos', requirements: 'Receita de produtos que atendem a padrões de eficiência energética (ENERGY STAR, etc.).' },
        ]
    },
    {
        id: 'SASB-IM', title: 'SASB - Máquinas e Bens Industriais',
        disclosures: [
            { id: 'RT-IM-250a.1', title: 'Eficiência e Segurança do Produto', requirements: 'Descrição da abordagem para incorporar eficiência de combustível/energia e segurança no design.' },
            { id: 'RT-IM-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR, fatalidades e taxa de exposição a materiais perigosos.' },
            { id: 'RT-IM-410a.1', title: 'Fornecimento de Materiais', requirements: 'Descrição da gestão de riscos ambientais e sociais na cadeia de suprimentos.' },
        ]
    },
    {
        id: 'SASB-AG', title: 'SASB - Produtos Agrícolas',
        disclosures: [
            { id: 'AG-PR-130a.1', title: 'Gestão de Água', requirements: 'Volume total de água retirada e percentual em regiões com alto estresse hídrico.' },
            { id: 'AG-PR-140a.1', title: 'Impactos da Qualidade da Água e Escoamento de Nutrientes', requirements: 'Área de terra sob gestão de nutrientes, por tipo de plano.' },
            { id: 'AG-PR-270a.1', title: 'Segurança Alimentar e Nutricional', requirements: 'Receita de produtos que atendem a critérios nutricionais específicos.' },
            { id: 'AG-PR-430a.1', title: 'Uso e Segurança de Pesticidas', requirements: 'Quantidade de pesticidas aplicados, por tipo.' },
        ]
    },
    {
        id: 'SASB-FB', title: 'SASB - Alimentos e Bebidas',
        disclosures: [
            { id: 'FB-PF-110a.1', title: 'Gestão de Emissões de GEE', requirements: 'Emissões de GEE Escopo 1, em toneladas métricas de CO2e.' },
            { id: 'FB-PF-130a.1', title: 'Uso de Água e Gestão de Riscos Hídricos', requirements: 'Volume total de água retirada, em miles de m³.' },
            { id: 'FB-PF-430b.1', title: 'Rotulagem de Alimentos e Saúde do Consumidor', requirements: 'Receita de produtos rotulados como orgânicos, não-OGM, etc.' },
            { id: 'FB-PF-260a.1', title: 'Bem-estar Animal', requirements: 'Percentual de carne suína produzida sem o uso de caixas de gestação.' },
            { id: 'FB-PF-410a.1', title: 'Gestão da Cadeia de Fornecimento', requirements: 'Percentual de fornecedores em conformidade com políticas sociais e ambientais.' },
        ]
    },
    {
        id: 'SASB-COAL', title: 'SASB - Operações de Carvão',
        disclosures: [
            { id: 'EM-CL-110a.1', title: 'Emissões de GEE', requirements: 'Emissões brutas de GEE Escopo 1, em toneladas métricas de CO2e.' },
            { id: 'EM-CL-120a.1', title: 'Qualidade do Ar', requirements: 'Emissões de NOx, SOx e particulados.' },
            { id: 'EM-CL-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'Taxa de Frequência Total de Incidentes Registráveis (TFIR) e fatalidades.' },
            { id: 'EM-CL-160a.2', title: 'Recuperação de Terras', requirements: 'Percentual e área de terras mineradas recuperadas.' },
        ]
    },
    {
        id: 'SASB-CM', title: 'SASB - Materiais de Construção',
        disclosures: [
            { id: 'EM-CM-110a.1', title: 'Emissões de GEE', requirements: 'Emissões de GEE Escopo 1 provenientes da queima de combustível e processos.' },
            { id: 'EM-CM-130a.1', title: 'Gestão de Água', requirements: 'Volume total de água retirada e percentual em regiões com alto estresse hídrico.' },
            { id: 'EM-CM-150a.1', title: 'Gestão de Resíduos', requirements: 'Quantidade total de resíduos não perigosos e perigosos gerados.' },
            { id: 'EM-CM-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR, fatalidades e taxa de doenças ocupacionais.' },
        ]
    },
    {
        id: 'SASB-IS', title: 'SASB - Produtores de Ferro e Aço',
        disclosures: [
            { id: 'EM-IS-000.A', title: 'Produção de produtos de aço', requirements: 'Número de toneladas métricas de produtos de aço produzidos.' },
            { id: 'EM-IS-000.B', title: 'Produção de ferro gusa', requirements: 'Número de toneladas métricas de ferro gusa produzido.' },
            { id: 'EM-IS-110a.1', title: 'Emissões de GEE', requirements: 'Intensidade de emissões de GEE (toneladas de CO2e por tonelada de aço bruto).' },
            { id: 'EM-IS-110a.2', title: 'Consumo de Energia', requirements: 'Energia total consumida, percentual de eletricidade da rede, percentual de fontes renováveis.' },
            { id: 'EM-IS-120a.1', title: 'Emissões de Poluentes Atmosféricos', requirements: 'Emissões globais brutas do Escopo 1 dos seguintes poluentes: (1) NOx (excluindo N2O), (2) SOx, (3) compostos orgânicos voláteis (COVs) e (4) material particulado (PM10).' },
            { id: 'EM-IS-130a.1', title: 'Gestão de Água', requirements: 'Volume total de água retirada, consumida e percentual reciclado.' },
            { id: 'EM-IS-130a.2', title: 'Retirada de Água em Áreas de Estresse Hídrico', requirements: 'Percentual de água retirada em regiões com Estresse Hídrico de Base Alto ou Extremamente Alto.' },
            { id: 'EM-IS-150a.1', title: 'Gestão de Resíduos Perigosos', requirements: 'Total de resíduos perigosos gerados, percentual reciclado.' },
            { id: 'EM-IS-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR, fatalidades e taxa de exposição a ruído.' },
            { id: 'EM-IS-430a', title: 'Gestão de Materiais Críticos', requirements: 'Descrição da gestão de riscos associados ao uso de materiais críticos para a transição energética.' },
        ]
    },
    {
        id: 'SASB-MM', title: 'SASB - Metais e Mineração',
        disclosures: [
            { id: 'EM-MM-000.A', title: 'Produção de metais e minerais', requirements: 'Produção total, por peso, para: (1) cobre acabado, (2) ouro, (3) metais do grupo da platina (PGMs), (4) minério de ferro, (5) carvão, (6) urânio e (7) potássio.' },
            { id: 'EM-MM-000.B', title: 'Número total de empregados', requirements: 'Número total de empregados.' },
            { id: 'EM-MM-110a.1', title: 'Emissões de GEE', requirements: 'Emissões brutas de GEE Escopo 1, em toneladas métricas de CO2e.' },
            { id: 'EM-MM-110a.2', title: 'Gestão de Energia', requirements: 'Energia total consumida, percentual de eletricidade da rede, percentual de fontes renováveis.' },
            { id: 'EM-MM-120a.1', title: 'Qualidade do Ar', requirements: 'Emissões de: (1) NOx (excluindo N2O), (2) SOx, (3) material particulado (PM10), (4) mercúrio (Hg) e (5) chumbo (Pb).' },
            { id: 'EM-MM-130a.1', title: 'Retirada de água em regiões de estresse hídrico', requirements: 'Percentual de água retirada em regiões com Estresse Hídrico de Base Alto ou Extremamente Alto.' },
            { id: 'EM-MM-140a.1', title: 'Gestão de Água', requirements: 'Volume total de água retirada e percentual em regiões com alto estresse hídrico.' },
            { id: 'EM-MM-150a.1', title: 'Gestão de Resíduos', requirements: 'Quantidade total de resíduos sólidos e perigosos gerados.' },
            { id: 'EM-MM-150a.7', title: 'Quantidade de estéril', requirements: 'Quantidade total de estéril, em toneladas métricas.' },
            { id: 'EM-MM-150a.8', title: 'Quantidade de rocha residual', requirements: 'Quantidade total de rocha residual, em toneladas métricas.' },
            { id: 'EM-MM-150a.10', title: 'Quantidade de rejeitos processados', requirements: 'Quantidade total de rejeitos processados, em toneladas métricas.' },
            { id: 'EM-MM-160a.1', title: 'Impactos na Biodiversidade', requirements: 'Descrição das políticas e práticas para gestão de impactos na biodiversidade em áreas protegidas.' },
            { id: 'EM-MM-160a.3', title: 'Área de terra perturbada e recuperada', requirements: '(1) Área total de terra perturbada e (2) área total de terra recém-perturbada. (3) Área total de terra recuperada.' },
            { id: 'EM-MM-210a.1', title: 'Relações com a Comunidade', requirements: 'Discussão sobre engajamento, avaliação de impacto e desenvolvimento com comunidades locais.' },
            { id: 'EM-MM-210b.1', title: 'Segurança e Direitos Humanos', requirements: 'Número de incidentes de violações envolvendo os direitos de povos indígenas e comunidades locais.' },
            { id: 'EM-MM-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'Taxa de Frequência Total de Incidentes Registráveis (TFIR), fatalidades e taxa de doenças ocupacionais.' },
            { id: 'EM-MM-510a.1', title: 'Segurança, Direitos Humanos e Direitos dos Povos Indígenas', requirements: 'Percentual de pessoal de segurança que recebeu treinamento em direitos humanos. Número de alegações de violações de direitos humanos apresentadas contra a empresa. Discussão sobre o engajamento com povos indígenas e respeito ao Consentimento Livre, Prévio e Informado (CLPI).' },
            { id: 'EM-MM-540a.1', title: 'Gestão de Barragens de Rejeitos', requirements: 'Número e volume de barragens de rejeitos, por classificação de risco.' },
            { id: 'EM-MM-540a.2', title: 'Gestão de instalações de armazenamento de rejeitos', requirements: 'Número de instalações de armazenamento de rejeitos por classificação de risco. Discussão das práticas de gestão de segurança.' },
            { id: 'EM-MM-540a.3', title: 'Incidentes em instalações de armazenamento de rejeitos', requirements: 'Número e natureza de incidentes significativos.' },
        ]
    },
    {
        id: 'SASB-OG', title: 'SASB - Petróleo e Gás – Exploração e Produção',
        disclosures: [
            { id: 'EM-EP-110a.1', title: 'Emissões de GEE e Intensidade de Carbono', requirements: 'Emissões de GEE Escopo 1; Intensidade de metano.' },
            { id: 'EM-EP-140a.1', title: 'Gestão de Água e Efluentes', requirements: 'Volume de água retirada e percentual em regiões com alto estresse hídrico.' },
            { id: 'EM-EP-540a.1', title: 'Prevenção de derramamentos e resposta a emergências', requirements: 'Número e volume de derramamentos de hidrocarbonetos.' },
            { id: 'EM-EP-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'Taxa de Frequência Total de Incidentes Registráveis (TFIR).' },
            { id: 'EM-EP-210a.1', title: 'Reservas e Capital Expenditures', requirements: 'Estimativas de reservas provadas e prováveis.' },
        ]
    },
    {
        id: 'SASB-OM', title: 'SASB - Petróleo e Gás – Transporte e Armazenagem (Midstream)',
        disclosures: [
            { id: 'EM-MD-110a.1', title: 'Emissões de GEE de Operações', requirements: 'Emissões de GEE Escopo 1 de fontes estacionárias e móveis.' },
            { id: 'EM-MD-540a.1', title: 'Segurança de Dutos e Prevenção de Vazamentos', requirements: 'Número de vazamentos de dutos e volume liberado.' },
            { id: 'EM-MD-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR e fatalidades para empregados e contratados.' },
            { id: 'EM-MD-210a.1', title: 'Relações com a Comunidade', requirements: 'Discussão sobre engajamento com comunidades locais e povos indígenas.' },
        ]
    },
    {
        id: 'SASB-OR', title: 'SASB - Petróleo e Gás – Refino e Comercialização',
        disclosures: [
            { id: 'EM-RN-110a.1', title: 'Emissões de GEE', requirements: 'Intensidade de emissões de GEE por throughput (CO2e/barril).' },
            { id: 'EM-RN-120a.1', 'title': 'Emissões Atmosféricas', requirements: 'Emissões de SOx, NOx, e Compostos Orgânicos Voláteis (COVs).' },
            { id: 'EM-RN-540a.2', 'title': 'Prevenção de Vazamentos e Resposta', requirements: 'Número de vazamentos de Nível 1, 2 e 3.' },
            { id: 'EM-RN-410a.1', 'title': 'Qualidade e Segurança de Produtos', requirements: 'Percentual de produtos refinados em conformidade com padrões de baixo enxofre.' },
        ]
    },
    {
        id: 'SASB-OS', title: 'SASB - Petróleo e Gás – Serviços',
        disclosures: [
            { id: 'EM-SV-320a.1', title: 'Saúde e Segurança Ocupacional', requirements: 'TFIR e taxa de fatalidades para empregados e contratados.' },
            { id: 'EM-SV-140a.1', title: 'Gestão de Água em Fraturamento Hidráulico', requirements: 'Volume de água retirada e percentual reciclado para operações de fraturamento.' },
            { id: 'EM-SV-540a.1', title: 'Prevenção de Vazamentos de Poços', requirements: 'Número de incidentes de perda de contenção de poços.' },
            { id: 'EM-SV-210a.1', title: 'Relações com a Comunidade', requirements: 'Discussão sobre gestão de impactos na comunidade (tráfego, ruído).' },
        ]
    },
    {
      id: 'SASB-FN', title: 'SASB - Serviços Financeiros',
      disclosures: [
        {id: 'FN-CB-410a.1', title: 'Integração de Fatores ESG em Análise de Crédito', requirements: 'Valor de ativos financeiros expostos a setores com alto risco climático.'},
        {id: 'FN-CB-270a.1', title: 'Segurança de Dados e Privacidade do Cliente', requirements: 'Número de violações de dados de clientes.'},
        {id: 'FN-CB-220a.1', title: 'Venda Responsável de Produtos', requirements: 'Número de reclamações de clientes sobre práticas de venda.'},
        {id: 'FN-IB-270a.2', title: 'Governança Corporativa e Gestão de Riscos', requirements: 'Descrição da abordagem para identificação e gestão de riscos, incluindo riscos ESG.'},
        {id: 'FN-CB-230a.1', title: 'Inclusão Financeira', requirements: 'Número de contas de depósito ou empréstimos concedidos a indivíduos de baixa renda.' },
      ]
    },
     {
      id: 'SASB-SV', title: 'SASB - Software e Serviços de TI',
      disclosures: [
        {id: 'TC-SI-220a.1', title: 'Segurança de Dados e Privacidade', requirements: 'Número de violações de dados, percentual de usuários afetados.'},
        {id: 'TC-SI-550a.1', title: 'Gestão do Ciclo de Vida de Hardware', requirements: 'Quantidade de resíduos eletrônicos reciclados.'},
        {id: 'TC-SI-130a.1', title: 'Consumo de Energia e Água em Data Centers', requirements: 'Consumo total de energia e água em data centers, PUE (Power Usage Effectiveness).'},
        {id: 'TC-SI-330a.1', title: 'Gestão de Talentos e Diversidade', requirements: 'Percentual de mulheres e minorias em cargos de gestão e técnicos.'},
        {id: 'TC-SI-210a.1', title: 'Liberdade de Expressão e Conteúdo Controverso', requirements: 'Número de solicitações governamentais para remoção de conteúdo.' },
      ]
    },
];

const sectorIndicatorMap: { [key: string]: string[] } = {
    // Infraestrutura
    'Concessionárias de Energia Elétrica e Geração de Energia': ['SASB-EU', 'GRI 302', 'GRI 305'],
    'Serviços de Engenharia e Construção': ['SASB-EC', 'GRI 403', 'GRI 301'],
    'Concessionárias e Distribuidoras de Gás': ['SASB-GU', 'GRI 305'],
    'Construtoras de Imóveis': ['SASB-HB', 'GRI 301', 'GRI 302'],
    'Imobiliárias': ['SASB-RE', 'GRI 302'],
    'Serviços Imobiliários': ['SASB-RE', 'GRI 302'],
    'Gestão de Resíduos': ['SASB-WM', 'GRI 306', 'GRI 305'],
    'Concessionárias e Serviços de Água': ['SASB-WU', 'GRI 303'],
    // Recursos Renováveis e Energia Alternativa
    'Biocombustíveis': ['SASB-BF', 'GRI 305', 'GRI 303'],
    'Manejo Florestal': ['SASB-FM', 'GRI 101-BD'],
    'Células de Combustível e Baterias Industriais': ['SASB-FC', 'GRI 301', 'GRI 308'],
    'Produtos de Celulose e Papel': ['SASB-PP', 'GRI 303', 'GRI 305', 'GRI 308'],
    'Tecnologia Solar e Desenvolvedores de Projetos': ['SASB-ST', 'GRI 101-BD'],
    'Tecnologia Eólica e Desenvolvedores de Projetos': ['SASB-WT', 'GRI 101-BD'],
    // Transformação de Recursos
    'Aeronáutica e Defesa': ['SASB-AD', 'GRI 205', 'GRI 414'],
    'Químicos': ['SASB-CH', 'GRI 305', 'GRI 306', 'GRI 416'],
    'Embalagens e Recipientes': ['SASB-CP', 'GRI 301'],
    'Equipamentos Elétricos e Eletrônicos': ['SASB-EE', 'GRI 301', 'GRI 308'],
    'Máquinas e Bens Industriais': ['SASB-IM', 'GRI 403', 'GRI 416'],
    // Outros
    'Agropecuária': ['GRI 13', 'SASB-AG', 'GRI 303', 'GRI 305', 'GRI 403', 'GRI 408', 'GRI 409', 'GRI 416'],
    'Alimentos e Bebidas': ['SASB-FB', 'GRI 13', 'GRI 301', 'GRI 302', 'GRI 305', 'GRI 306', 'GRI 403', 'GRI 416', 'GRI 417'],
    'Serviços Financeiros': ['SASB-FN', 'GRI 205', 'GRI 418'],
    'Software e Serviços de TI': ['SASB-SV', 'GRI 418'],
    'Operações de Carvão': ['GRI 12', 'SASB-COAL', 'GRI 305', 'GRI 306', 'GRI 403'],
    'Materiais de Construção': ['SASB-CM', 'GRI 301', 'GRI 305', 'GRI 306', 'GRI 403'],
    'Produtores de Ferro e Aço': ['SASB-IS', 'GRI 302', 'GRI 305', 'GRI 403'],
    'Metais e Mineração': ['SASB-MM', 'GRI 303', 'GRI 305', 'GRI 306', 'GRI 403', 'GRI 411', 'GRI 413'],
    'Petróleo e Gás – Exploração e Produção': ['GRI 11', 'SASB-OG', 'GRI 303', 'GRI 305', 'GRI 413'],
    'Petróleo e Gás – Transporte e Armazenagem (Midstream)': ['GRI 11', 'SASB-OM', 'GRI 305', 'GRI 413'],
    'Petróleo e Gás – Refino e Comercialização': ['GRI 11', 'SASB-OR', 'GRI 305', 'GRI 416', 'GRI 417'],
    'Petróleo e Gás – Serviços': ['GRI 11', 'SASB-OS', 'GRI 305', 'GRI 403'],
};


// --- Utility Functions ---
const getStatusText = (status: IndicatorStatus) => {
    switch (status) {
        case 'pending_assignment': return 'Pendente Atribuição';
        case 'pending_collection': return 'Não Iniciado';
        case 'in_progress': return 'Em Preenchimento';
        case 'pending_review': return 'Pendente Revisão';
        case 'changes_requested': return 'Alterações Solicitadas';
        case 'internally_approved': return 'Aprovado Internamente';
        case 'final_approved': return 'Aprovado';
        default: return 'Desconhecido';
    }
};

const getStatusColor = (status: IndicatorStatus) => {
    switch (status) {
        case 'pending_assignment': return '#e2e8f0';
        case 'pending_collection': return '#fefcbf';
        case 'in_progress': return '#dbeafe';
        case 'pending_review': return '#fed7aa';
        case 'changes_requested': return '#fecaca';
        case 'internally_approved': return '#a7f3d0';
        case 'final_approved': return '#bfdbfe';
        default: return '#cbd5e0';
    }
};

const getDeadlineStatus = (deadline: string): { status: 'overdue' | 'due_soon' | 'on_track' | 'none'; priority: number } => {
    if (!deadline) {
        return { status: 'none', priority: 4 };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const deadlineDate = new Date(`${deadline}T00:00:00Z`);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { status: 'overdue', priority: 1 };
    }
    if (diffDays <= 7) {
        return { status: 'due_soon', priority: 2 };
    }
    return { status: 'on_track', priority: 3 };
};


const parseRequirements = (requirements: string): string[] => {
    // A custom, unambiguous separator '|||' is used in the data source to split requirements.
    const SEPARATOR = '|||';
    if (requirements.includes(SEPARATOR)) {
        return requirements.split(SEPARATOR).map(s => s.trim()).filter(Boolean);
    }
    // If no separator is found, it's a single requirement.
    return [requirements.trim()];
};


type CustomIndicatorGroups = {
    [key: string]: Disclosure[];
};

// --- Components ---
const App = () => {
    const [step, setStep] = useState(1);
    const [currentUser, setCurrentUser] = useState('Administrador');
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({ name: '', mission: '', vision: '', values: '' });
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [indicators, setIndicators] = useState<Indicators>({});
    const [customIndicators, setCustomIndicators] = useState<CustomIndicatorGroups>({});
    const [responsiblePeople, setResponsiblePeople] = useState<ResponsiblePerson[]>([]);
    const [sustainabilityReportText, setSustainabilityReportText] = useState('');

    const isAdministrator = useMemo(() => currentUser === 'Administrador', [currentUser]);
    const users = useMemo(() => ['Administrador', ...responsiblePeople.map(p => p.name)], [responsiblePeople]);

    useEffect(() => {
        if (!users.includes(currentUser)) {
            setCurrentUser('Administrador');
        }
    }, [users, currentUser]);

    // Redirect non-admin users if they are on a forbidden step
    useEffect(() => {
        if (!isAdministrator && (step < 4 || step > 5)) {
            setStep(4);
        }
    }, [isAdministrator, step]);

    // Daily email simulation for Admin
    useEffect(() => {
        if (currentUser === 'Administrador') {
            const pendingFinalApproval = Object.values(indicators).filter(i => i.status === 'internally_approved');
            if (pendingFinalApproval.length > 0) {
                const indicatorList = pendingFinalApproval.map(i => `- ${i.id}: ${i.title}`).join('\n');
                const message = `
                    Resumo Diário:
                    
                    Os seguintes indicadores foram revisados e aguardam sua aprovação final:
                    ${indicatorList}
                    
                    Acesse a plataforma para concluir o processo.
                `;
                const timer = setTimeout(() => {
                    alert(`--- SIMULAÇÃO DE E-MAIL DIÁRIO ---\n\n${message}`);
                }, 500); 
                
                return () => clearTimeout(timer);
            }
        }
    }, [currentUser, indicators]);

    const handleNextStep = () => setStep(prev => Math.min(prev + 1, 7));
    const handleSetStep = (newStep: number) => {
        if (!isAdministrator && (newStep < 4 || newStep > 5)) {
            return;
        }
        setStep(newStep);
    };

    const handleUpdateIndicator = (id: string, field: string, value: any) => {
        setIndicators(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const fetchHistoricalContext = async (indicator: Indicator) => {
        handleUpdateIndicator(indicator.id, 'historyLoading', true);

        if (!sustainabilityReportText.trim()) {
            handleUpdateIndicator(indicator.id, 'historicalContext', 'Por favor, cole o conteúdo do seu relatório de sustentabilidade no campo acima antes de buscar.');
            handleUpdateIndicator(indicator.id, 'historyLoading', false);
            return;
        }

        try {
            const prompt = `
                Analise o "Relatório de Sustentabilidade" fornecido e extraia o trecho exato que corresponde especificamente ao indicador a seguir.
                Se não encontrar uma correspondência exata, resuma a informação mais próxima que encontrar ou indique que não foi encontrada.
                
                Indicador a ser buscado:
                - ID: ${indicator.id}
                - Título: ${indicator.title}
                - Requisitos: ${indicator.requirements}

                Relatório de Sustentabilidade:
                ---
                ${sustainabilityReportText}
                ---
            `;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });

            handleUpdateIndicator(indicator.id, 'historicalContext', response.text);
        } catch (error) {
            console.error("Error fetching historical context:", error);
            handleUpdateIndicator(indicator.id, 'historicalContext', 'Erro ao buscar dados. Tente novamente.');
        } finally {
            handleUpdateIndicator(indicator.id, 'historyLoading', false);
        }
    };
    
    const handleSubmitForReview = (indicatorId: string) => {
        const indicator = indicators[indicatorId];
        if (indicator && indicator.reviewer) {
            const reviewerPerson = responsiblePeople.find(p => p.name === indicator.reviewer);
            if (reviewerPerson) {
                const deadlineText = indicator.deadline
                    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${indicator.deadline}T00:00:00Z`))
                    : 'não definida';

                const message = `
                    Olá ${reviewerPerson.name},
                    
                    O indicador abaixo foi preenchido e está aguardando sua revisão:
                    - ${indicator.id}: ${indicator.title}
                    
                    A data limite para a revisão é ${deadlineText}.
                    
                    Acesse a plataforma para revisar os dados.
                `;
                alert(`--- SIMULAÇÃO DE E-MAIL ---\n\nPara: ${reviewerPerson.email}\n\nAssunto: Tarefa de Revisão ESG Pendente\n\n${message}`);
            }
        }

        setIndicators(prev => ({
            ...prev,
            [indicatorId]: { ...prev[indicatorId], status: 'pending_review', reviewComments: '' }
        }));
    };

    const handleRequestChanges = (indicatorId: string, comments: string) => {
        setIndicators(prev => ({
            ...prev,
            [indicatorId]: { ...prev[indicatorId], status: 'changes_requested', reviewComments: comments }
        }));
    };
    
    const handleApprove = (indicatorId: string) => {
         setIndicators(prev => ({
            ...prev,
            [indicatorId]: { ...prev[indicatorId], status: 'internally_approved' }
        }));
    };

    const handleFinalApprove = (indicatorId: string) => {
        setIndicators(prev => ({
            ...prev,
            [indicatorId]: { ...prev[indicatorId], status: 'final_approved' }
        }));
    };

    const handleAskQuestion = (indicatorId: string, question: string) => {
        const indicator = indicators[indicatorId];
        const asker = currentUser;
        if (!indicator || !question.trim() || asker === 'Administrador') return;

        const newQnA: QnA = {
            id: Date.now().toString(),
            question: question.trim(),
            answer: '',
            asker: asker,
            questionTimestamp: new Date().toISOString(),
            answerTimestamp: '',
        };

        handleUpdateIndicator(indicatorId, 'qna', [...(indicator.qna || []), newQnA]);

        const message = `
            Olá Administrador,

            Uma nova dúvida foi enviada para o indicador:
            - Indicador: ${indicator.id} - ${indicator.title}
            - Ponto Focal: ${asker}
            - Dúvida: "${question.trim()}"

            Por favor, acesse a plataforma para responder.
        `;
        alert(`--- SIMULAÇÃO DE E-MAIL ---\n\nPara: Administrador\n\nAssunto: Nova Dúvida na Plataforma ESG\n\n${message}`);
    };

    const handleAnswerQuestion = (indicatorId: string, qnaId: string, answer: string) => {
        const indicator = indicators[indicatorId];
        if (!indicator || !answer.trim() || currentUser !== 'Administrador') return;

        const updatedQna = (indicator.qna || []).map(q => {
            if (q.id === qnaId) {
                return { ...q, answer: answer.trim(), answerTimestamp: new Date().toISOString() };
            }
            return q;
        });

        handleUpdateIndicator(indicatorId, 'qna', updatedQna);

        const qnaItem = updatedQna.find(q => q.id === qnaId);
        const askerPerson = responsiblePeople.find(p => p.name === qnaItem?.asker);
        if (askerPerson) {
             const message = `
                Olá ${askerPerson.name},

                Sua dúvida sobre o indicador foi respondida:
                - Indicador: ${indicator.id} - ${indicator.title}
                - Resposta: "${answer.trim()}"

                Acesse a plataforma para ver a resposta completa.
            `;
             alert(`--- SIMULAÇÃO DE E-MAIL ---\n\nPara: ${askerPerson.email}\n\nAssunto: Resposta da sua Dúvida ESG\n\n${message}`);
        }
    };

    const stepStatus = useMemo(() => {
        const indicatorList = Object.values(indicators);
        const totalIndicators = indicatorList.length;

        // Step 1: Profile
        const step1Completed = companyProfile.name.trim() !== '';
        const step1StatusText = step1Completed ? 'Preenchido' : 'Pendente';

        if (totalIndicators === 0) {
            return [
                { completed: step1Completed, statusText: step1StatusText },
                ...Array(6).fill({ completed: false, statusText: 'Não iniciado' })
            ];
        }

        const approvedCount = indicatorList.filter(i => i.status === 'final_approved').length;
        const allApproved = totalIndicators > 0 && approvedCount === totalIndicators;
    
        // Step 2: Selection
        const step2Completed = totalIndicators > 0;
        const step2StatusText = `${totalIndicators} indicadores selecionados`;
    
        // Step 3: Assignment
        const assignedCount = indicatorList.filter(i => i.focalPoint && i.deadline).length;
        const step3Completed = assignedCount === totalIndicators;
        const step3StatusText = step3Completed ? 'Concluído' : `${assignedCount}/${totalIndicators} atribuídos`;
    
        // Step 4: Data Collection
        const collectionPendingCount = indicatorList.filter(i => ['pending_collection', 'in_progress', 'changes_requested'].includes(i.status)).length;
        const step4Completed = allApproved;
        const step4StatusText = collectionPendingCount > 0 
            ? `${collectionPendingCount} pendente(s)` 
            : (allApproved ? 'Concluído' : 'Nenhum item pendente');
    
        // Step 5: Internal Review
        const reviewPendingCount = indicatorList.filter(i => i.status === 'pending_review').length;
        const step5Completed = allApproved;
        const step5StatusText = reviewPendingCount > 0 
            ? `${reviewPendingCount} para revisar` 
            : (allApproved ? 'Concluído' : 'Nenhum item pendente');
    
        // Step 6: Final Approval
        const finalPendingCount = indicatorList.filter(i => i.status === 'internally_approved').length;
        const step6Completed = allApproved;
        const step6StatusText = finalPendingCount > 0 
            ? `${finalPendingCount} para aprovação final` 
            : (allApproved ? 'Concluído' : 'Nenhum item pendente');

        // Step 7: Export
        const step7Completed = allApproved;
        const step7StatusText = `${approvedCount} aprovados para exportar`;
    
        return [
            { completed: step1Completed, statusText: step1StatusText },
            { completed: step2Completed, statusText: step2StatusText },
            { completed: step3Completed, statusText: step3StatusText },
            { completed: step4Completed, statusText: step4StatusText },
            { completed: step5Completed, statusText: step5StatusText },
            { completed: step6Completed, statusText: step6StatusText },
            { completed: step7Completed, statusText: step7StatusText },
        ];
    }, [indicators, companyProfile]);

    const allSteps = useMemo(() => [
        { number: 1, title: 'Perfil da Empresa', icon: 'business' },
        { number: 2, title: 'Seleção de Indicadores', icon: 'checklist' },
        { number: 3, title: 'Responsáveis', icon: 'group' },
        { number: 4, title: 'Coleta de Dados', icon: 'edit_document' },
        { number: 5, title: 'Revisão Interna', icon: 'rate_review' },
        { number: 6, title: 'Revisão Consultoria ESG', icon: 'verified' },
        { number: 7, title: 'Exportação', icon: 'download' },
    ], []);

    const visibleSteps = useMemo(() => {
        if (isAdministrator) {
            return allSteps;
        }
        return allSteps.filter(s => s.number >= 4 && s.number <= 5);
    }, [isAdministrator, allSteps]);
    
    const handleUserChange = (newUser: string) => {
        setCurrentUser(newUser);
        if (newUser !== 'Administrador') {
            setStep(4);
        }
    };

    return (
        <>
            <header>
                <h1><span className="material-icons">assessment</span>Plataforma de Sustentabilidade</h1>
                <div className="user-switcher">
                    <label htmlFor="user-select">Usuário Atual:</label>
                    <select id="user-select" value={currentUser} onChange={e => handleUserChange(e.target.value)}>
                        {users.map(user => <option key={user} value={user}>{user}</option>)}
                    </select>
                </div>
            </header>
            <div className="main-container">
                <ProgressSidebar
                    currentStep={step}
                    setStep={handleSetStep}
                    stepStatus={stepStatus}
                    steps={visibleSteps}
                />
                <main className="content-area">
                    {step === 1 && isAdministrator && <Step1_CompanyProfile profile={companyProfile} setProfile={setCompanyProfile} onComplete={handleNextStep} />}
                    {step === 2 && isAdministrator && <Step2_IndicatorSelection 
                        selectedSectors={selectedSectors} 
                        setSelectedSectors={setSelectedSectors} 
                        indicators={indicators} 
                        setIndicators={setIndicators} 
                        onComplete={handleNextStep} 
                        customIndicators={customIndicators}
                        setCustomIndicators={setCustomIndicators}
                    />}
                    {step === 3 && isAdministrator && <Step3_Assignment 
                        indicators={indicators} 
                        setIndicators={handleUpdateIndicator} 
                        onComplete={handleNextStep} 
                        currentUser={currentUser} 
                        responsiblePeople={responsiblePeople}
                        setResponsiblePeople={setResponsiblePeople}
                    />}
                    {step === 4 && <Step4_DataCollection
                        indicators={indicators}
                        onUpdate={handleUpdateIndicator}
                        onSubmit={handleSubmitForReview}
                        currentUser={currentUser}
                        fetchHistoricalContext={fetchHistoricalContext}
                        sustainabilityReportText={sustainabilityReportText}
                        setSustainabilityReportText={setSustainabilityReportText}
                        onAskQuestion={handleAskQuestion}
                        onAnswerQuestion={handleAnswerQuestion}
                    />}
                    {step === 5 && <Step5_InternalReview indicators={indicators} onApprove={handleApprove} onRequestChanges={handleRequestChanges} currentUser={currentUser} />}
                    {step === 6 && isAdministrator && <Step6_ESGReview indicators={indicators} onFinalApprove={handleFinalApprove} onReturnForAdjustments={handleRequestChanges} currentUser={currentUser} />}
                    {step === 7 && isAdministrator && <Step7_Export indicators={indicators} companyProfile={companyProfile} />}
                </main>
            </div>
        </>
    );
};

const ProgressSidebar: React.FC<{
    currentStep: number;
    setStep: (step: number) => void;
    stepStatus: { completed: boolean; statusText: string }[];
    steps: { number: number; title: string; icon: string }[];
}> = ({ currentStep, setStep, stepStatus, steps }) => {
    return (
        <aside className="sidebar">
            {steps.map((step) => {
                const statusIndex = step.number - 1;
                return (
                    <div
                        key={step.number}
                        className={`step ${currentStep === step.number ? 'active' : ''} ${stepStatus[statusIndex]?.completed ? 'completed' : ''}`}
                        onClick={() => setStep(step.number)}
                    >
                        <span className="material-icons">{stepStatus[statusIndex]?.completed && currentStep !== step.number ? 'check_circle' : step.icon}</span>
                        <div className="step-content">
                            <span className="step-title">{step.title}</span>
                            <span className="step-status">{stepStatus[statusIndex]?.statusText || 'Não iniciado'}</span>
                        </div>
                    </div>
                );
            })}
        </aside>
    );
};

const Step1_CompanyProfile: React.FC<{
    profile: CompanyProfile;
    setProfile: (profile: CompanyProfile) => void;
    onComplete: () => void;
}> = ({ profile, setProfile, onComplete }) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfile({ ...profile, [name]: value });
    };

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 1: Perfil da Empresa</h2>
                <p>Forneça as informações básicas sobre a sua organização. Estes dados ajudarão a contextualizar o seu relatório de sustentabilidade.</p>
            </div>

            <div className="card">
                <div className="form-group">
                    <label htmlFor="name">Nome da Empresa</label>
                    <input type="text" id="name" name="name" value={profile.name} onChange={handleChange} placeholder="Ex: Sustentare S.A." />
                </div>
                <div className="form-group">
                    <label htmlFor="mission">Missão</label>
                    <textarea id="mission" name="mission" value={profile.mission} onChange={handleChange} placeholder="Qual é o propósito da sua empresa?" />
                </div>
                <div className="form-group">
                    <label htmlFor="vision">Visão</label>
                    <textarea id="vision" name="vision" value={profile.vision} onChange={handleChange} placeholder="Onde sua empresa quer chegar no futuro?" />
                </div>
                <div className="form-group">
                    <label htmlFor="values">Valores</label>
                    <textarea id="values" name="values" value={profile.values} onChange={handleChange} placeholder="Quais são os princípios que guiam suas ações?" />
                </div>
            </div>

            <div className="button-group">
                <button className="button" onClick={onComplete} disabled={!profile.name.trim()}>
                    Salvar e Avançar
                </button>
            </div>
        </div>
    );
};


const StandardGroupItem: React.FC<{
    standard: GRIStandard | SASBStandard;
    selectedIndicatorIds: Set<string>;
    getIndicatorFullId: (standard: GRIStandard | SASBStandard, disclosure: Disclosure | SASBDisclosure) => string;
    handleIndicatorToggle: (id: string) => void;
    handleSelectAllToggle: (standard: GRIStandard | SASBStandard, shouldSelect: boolean) => void;
    isOpen: boolean;
}> = ({ standard, selectedIndicatorIds, getIndicatorFullId, handleIndicatorToggle, handleSelectAllToggle, isOpen }) => {
    const disclosureIds = useMemo(() => standard.disclosures.map(d => getIndicatorFullId(standard, d)), [standard, getIndicatorFullId]);
    const selectedCount = useMemo(() => disclosureIds.filter(id => selectedIndicatorIds.has(id)).length, [disclosureIds, selectedIndicatorIds]);
    
    const allSelected = disclosureIds.length > 0 && selectedCount === disclosureIds.length;
    const someSelected = selectedCount > 0 && !allSelected;

    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    return (
        <details key={standard.id} open={isOpen}>
            <summary>{standard.title}</summary>
            <div className="disclosure-list-container">
                <div className="select-all-container">
                    <input
                        type="checkbox"
                        id={`select-all-${standard.id}`}
                        ref={selectAllCheckboxRef}
                        checked={allSelected}
                        onChange={(e) => handleSelectAllToggle(standard, e.target.checked)}
                        aria-label={`Selecionar todos os indicadores de ${standard.title}`}
                    />
                    <label htmlFor={`select-all-${standard.id}`}>Selecionar/Deselecionar Todos</label>
                </div>
                <hr className="divider" />
                {standard.disclosures.map(disclosure => {
                    const fullId = getIndicatorFullId(standard, disclosure);
                    const label = standard.id.startsWith('CUSTOM-') ? disclosure.id : (fullId.startsWith('SASB') ? disclosure.id : fullId);
                    return (
                        <div key={fullId} className="disclosure-item">
                            <input
                                type="checkbox"
                                id={fullId}
                                checked={selectedIndicatorIds.has(fullId)}
                                onChange={() => handleIndicatorToggle(fullId)}
                            />
                            <label htmlFor={fullId}>{label} - {disclosure.title}</label>
                        </div>
                    );
                })}
            </div>
        </details>
    );
};

const Step2_IndicatorSelection: React.FC<{
    selectedSectors: string[];
    setSelectedSectors: (sectors: string[]) => void;
    indicators: Indicators;
    setIndicators: (indicators: Indicators) => void;
    onComplete: () => void;
    customIndicators: CustomIndicatorGroups;
    setCustomIndicators: (indicators: CustomIndicatorGroups) => void;
}> = ({ selectedSectors, setSelectedSectors, indicators, setIndicators, onComplete, customIndicators, setCustomIndicators }) => {
    const [selectedIndicatorIds, setSelectedIndicatorIds] = useState<Set<string>>(new Set(Object.keys(indicators)));
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newIndicatorData, setNewIndicatorData] = useState({ id: '', title: '', requirements: '', group: 'custom' });

    const customIndicatorGroups = {
        custom: 'Indicadores Personalizados (Geral)',
        universal: 'Normas Universais',
        sectorial: 'Normas Setoriais',
        economic: 'Normas Temáticas: Série 200 (Econômico)',
        environmental: 'Normas Temáticas: Série 300 (Ambiental)',
        social: 'Normas Temáticas: Série 400 (Social)',
        sasb: 'Normas SASB',
    };

    const getIndicatorFullId = useCallback((standard: GRIStandard | SASBStandard, disclosure: Disclosure | SASBDisclosure): string => {
        if (standard.id.startsWith('CUSTOM-')) {
            return disclosure.id;
        }
        if (standard.id.startsWith('GRI')) {
             if (standard.id === 'GRI 2' || standard.id === 'GRI 3') {
                return `GRI ${disclosure.id}`;
             }
             const standardNumber = standard.id.replace('GRI ', '');
             if (disclosure.id.startsWith(standardNumber)) {
                return `GRI ${disclosure.id}`;
             }
             return `GRI ${standardNumber}-${disclosure.id}`;
        }
        return `SASB-${disclosure.id}`;
    }, []);

    const allStandardIds = useMemo(() => {
        const ids = new Set<string>();
        [...griStandards, ...sasbStandards].forEach(standard => {
            standard.disclosures.forEach(disclosure => {
                ids.add(getIndicatorFullId(standard, disclosure));
            });
        });
        return ids;
    }, [getIndicatorFullId]);

    useEffect(() => {
        const newSelectedIds = new Set(selectedIndicatorIds);
        const suggestedStandardIds = new Set<string>();

        // Always add Universal GRI standards
        griStandards.filter(s => s.id === 'GRI 2' || s.id === 'GRI 3').forEach(std => suggestedStandardIds.add(std.id));

        selectedSectors.forEach(sector => {
            const mappedIds = sectorIndicatorMap[sector] || [];
            mappedIds.forEach(id => suggestedStandardIds.add(id));
        });

        // Add disclosures from suggested standards
        [...griStandards, ...sasbStandards].forEach(standard => {
            if (suggestedStandardIds.has(standard.id)) {
                standard.disclosures.forEach(disc => newSelectedIds.add(getIndicatorFullId(standard, disc)));
            }
        });

        setSelectedIndicatorIds(newSelectedIds);
    }, [selectedSectors, getIndicatorFullId]);


    const handleSectorToggle = (sector: string) => {
        const newSectors = selectedSectors.includes(sector)
            ? selectedSectors.filter(s => s !== sector)
            : [...selectedSectors, sector];
        setSelectedSectors(newSectors);
    };

    const handleIndicatorToggle = (id: string) => {
        const newSelected = new Set(selectedIndicatorIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIndicatorIds(newSelected);
    };
    
    const handleSelectAllToggle = (standard: GRIStandard | SASBStandard, shouldSelect: boolean) => {
        const newSelected = new Set(selectedIndicatorIds);
        const disclosureIds = standard.disclosures.map(d => getIndicatorFullId(standard, d));

        if (shouldSelect) {
            disclosureIds.forEach(id => newSelected.add(id));
        } else {
            disclosureIds.forEach(id => newSelected.delete(id));
        }
        setSelectedIndicatorIds(newSelected);
    };
    
     const allCustomStandardsForDisplay = useMemo(() => {
        return Object.entries(customIndicators)
            .filter(([, disclosures]) => disclosures.length > 0)
            .map(([groupKey, disclosures]) => ({
                id: `CUSTOM-${groupKey}`,
                title: `Personalizados - ${customIndicatorGroups[groupKey as keyof typeof customIndicatorGroups]}`,
                disclosures: disclosures,
                group: groupKey,
            }));
    }, [customIndicators]);

    const handleConfirmSelection = () => {
        const allStandards: (GRIStandard | SASBStandard)[] = [...griStandards, ...sasbStandards, ...allCustomStandardsForDisplay];
        
        const newIndicatorsState: Indicators = {};

        // Iterate through all possible indicators and check if they are in the selected set
        allStandards.forEach(standard => {
            standard.disclosures.forEach(disclosure => {
                const fullId = getIndicatorFullId(standard, disclosure);

                if (selectedIndicatorIds.has(fullId)) {
                    // If the indicator is selected, add it to the new state.
                    // Preserve existing data if it's already in the main state.
                    if (indicators[fullId]) {
                        newIndicatorsState[fullId] = indicators[fullId];
                    } else {
                        // This is a newly selected indicator
                        newIndicatorsState[fullId] = {
                            id: fullId,
                            title: disclosure.title,
                            standard: standard.id.startsWith('CUSTOM-') ? 'Personalizado' : standard.title,
                            requirements: disclosure.requirements,
                            status: 'pending_assignment',
                            focalPoint: '',
                            reviewer: '',
                            deadline: '',
                            data: {},
                            files: [],
                            reviewComments: '',
                            historicalContext: '',
                            historyLoading: false,
                            qna: [],
                        };
                    }
                }
            });
        });

        setIndicators(newIndicatorsState);
        onComplete();
    };
    
    const filteredStandards = useMemo(() => {
        const allStandardList: (GRIStandard | SASBStandard | any)[] = [...griStandards, ...sasbStandards, ...allCustomStandardsForDisplay];
        
        if (!searchTerm.trim()) {
             return {
                custom: allCustomStandardsForDisplay.filter(s => s.group === 'custom'),
                universal: [...griStandards.filter(s => s.id === 'GRI 2' || s.id === 'GRI 3'), ...allCustomStandardsForDisplay.filter(s => s.group === 'universal')],
                sectorial: [...griStandards.filter(s => s.id.startsWith('GRI 1')), ...allCustomStandardsForDisplay.filter(s => s.group === 'sectorial')],
                economic: [...griStandards.filter(s => s.id.startsWith('GRI 20')), ...allCustomStandardsForDisplay.filter(s => s.group === 'economic')],
                environmental: [...griStandards.filter(s => s.id.startsWith('GRI 30') || s.id.startsWith('GRI 101') || s.id.startsWith('GRI 304')), ...allCustomStandardsForDisplay.filter(s => s.group === 'environmental')],
                social: [...griStandards.filter(s => s.id.startsWith('GRI 40') || s.id.startsWith('GRI 41')), ...allCustomStandardsForDisplay.filter(s => s.group === 'social')],
                sasb: [...sasbStandards, ...allCustomStandardsForDisplay.filter(s => s.group === 'sasb')],
            };
        }

        const lowercasedFilter = searchTerm.toLowerCase();
        
        const results: (GRIStandard | SASBStandard | any)[] = [];
        for (const standard of allStandardList) {
            const standardTitleMatches = standard.title.toLowerCase().includes(lowercasedFilter);
            
            const matchingDisclosures = standard.disclosures.filter(
                (d: Disclosure) => getIndicatorFullId(standard, d).toLowerCase().includes(lowercasedFilter) || 
                     d.title.toLowerCase().includes(lowercasedFilter)
            );

            if (standardTitleMatches || matchingDisclosures.length > 0) {
                results.push({
                    ...standard,
                    disclosures: standardTitleMatches ? standard.disclosures : matchingDisclosures
                });
            }
        }
        
        return {
            custom: results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'custom'),
            universal: [...results.filter(s => s.id === 'GRI 2' || s.id === 'GRI 3'), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'universal')],
            sectorial: [...results.filter(s => s.id.startsWith('GRI 1')), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'sectorial')],
            economic: [...results.filter(s => s.id.startsWith('GRI 20')), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'economic')],
            environmental: [...results.filter(s => s.id.startsWith('GRI 30') || s.id.startsWith('GRI 101') || s.id.startsWith('GRI 304')), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'environmental')],
            social: [...results.filter(s => s.id.startsWith('GRI 40') || s.id.startsWith('GRI 41')), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'social')],
            sasb: [...results.filter(s => s.id.startsWith('SASB-')), ...results.filter(s => s.id.startsWith('CUSTOM-') && s.group === 'sasb')],
        };
    }, [searchTerm, getIndicatorFullId, allCustomStandardsForDisplay]);

    const noResults = useMemo(() => {
        return searchTerm.trim() !== '' && Object.values(filteredStandards).every(arr => arr.length === 0);
    }, [searchTerm, filteredStandards]);
    
    const handleOpenCreateForm = () => setIsCreatingNew(true);
    const handleCloseCreateForm = () => {
        setIsCreatingNew(false);
        setNewIndicatorData({ id: '', title: '', requirements: '', group: 'custom' });
    };

    const handleNewIndicatorChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewIndicatorData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSaveNewIndicator = () => {
        const { id: trimmedId, title: trimmedTitle, requirements: trimmedReqs, group } = newIndicatorData;

        if (!trimmedId.trim() || !trimmedTitle.trim() || !trimmedReqs.trim()) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        const idExistsInStandards = allStandardIds.has(trimmedId.trim());
        const idExistsInCustom = Object.values(customIndicators).flat().some(c => c.id === trimmedId.trim());

        if (idExistsInStandards || idExistsInCustom) {
            alert('Este ID de indicador já existe ou conflita com um indicador padrão (GRI/SASB). Por favor, escolha um ID único.');
            return;
        }
        
        const newIndicator: Disclosure = {
            id: trimmedId.trim(),
            title: trimmedTitle.trim(),
            requirements: trimmedReqs.trim(),
            standard: 'Personalizado'
        };

        setCustomIndicators({
            ...customIndicators,
            [group]: [...(customIndicators[group] || []), newIndicator],
        });
        
        const newSelected = new Set(selectedIndicatorIds);
        newSelected.add(newIndicator.id);
        setSelectedIndicatorIds(newSelected);
        
        handleCloseCreateForm();
    };

    const renderStandardGroup = (title: string, standardsToRender: (GRIStandard | SASBStandard)[]) => {
         if (standardsToRender.length === 0) return null;
         return (
             <div className="indicator-group">
                <h3 className="indicator-group-title">{title}</h3>
                {standardsToRender.map(standard => (
                     <StandardGroupItem
                        key={standard.id}
                        standard={standard}
                        selectedIndicatorIds={selectedIndicatorIds}
                        getIndicatorFullId={getIndicatorFullId}
                        handleIndicatorToggle={handleIndicatorToggle}
                        handleSelectAllToggle={handleSelectAllToggle}
                        isOpen={searchTerm.trim() !== '' || selectedSectors.some(s => (sectorIndicatorMap[s] || []).includes(standard.id)) || standard.id.startsWith('CUSTOM-') || title === 'Normas Universais'}
                    />
                ))}
            </div>
         );
    }

    return (
        <div>
             {isCreatingNew && (
                <div className="modal-overlay" onClick={handleCloseCreateForm}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Criar Novo Indicador</h3>
                            <button onClick={handleCloseCreateForm} className="close-button" aria-label="Fechar">&times;</button>
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-group">Grupo do Indicador</label>
                            <select id="new-group" name="group" value={newIndicatorData.group} onChange={handleNewIndicatorChange}>
                               {Object.entries(customIndicatorGroups).map(([key, value]) => (
                                   <option key={key} value={key}>{value}</option>
                               ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-id">ID do Indicador</label>
                            <input type="text" id="new-id" name="id" value={newIndicatorData.id} onChange={handleNewIndicatorChange} placeholder="Ex: C-01, EN-05" />
                        </div>
                         <div className="form-group">
                            <label htmlFor="new-title">Título do Indicador</label>
                            <input type="text" id="new-title" name="title" value={newIndicatorData.title} onChange={handleNewIndicatorChange} placeholder="Ex: Consumo de água no escritório" />
                        </div>
                         <div className="form-group">
                            <label htmlFor="new-reqs">Requisitos</label>
                            <textarea id="new-reqs" name="requirements" value={newIndicatorData.requirements} onChange={handleNewIndicatorChange} placeholder="Descreva o que precisa ser coletado. Use 'a.', 'b.', etc., para criar uma lista." />
                        </div>
                        <div className="button-group">
                            <button className="button secondary" onClick={handleCloseCreateForm}>Cancelar</button>
                            <button className="button" onClick={handleSaveNewIndicator}>Salvar Indicador</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="content-header">
                <h2>Etapa 2: Seleção de Indicadores</h2>
                <p>Selecione os setores de atuação da sua empresa para receber uma sugestão de indicadores GRI e SASB. Você pode customizar a seleção manualmente ou criar novos indicadores.</p>
            </div>

            <div className="card">
                <h3>Setores de Atuação</h3>
                <div className="sector-selection-container">
                    {sectorGroups.map(group => (
                        <details key={group.category} className="sector-group">
                            <summary className="sector-group-title">{group.category}</summary>
                            <div className="sector-list">
                                {group.sectors.map(sector => (
                                    <label key={sector} className="sector-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedSectors.includes(sector)}
                                            onChange={() => handleSectorToggle(sector)}
                                        />
                                        {sector}
                                    </label>
                                ))}
                            </div>
                        </details>
                    ))}
                </div>
            </div>

            <div className="card indicator-selector">
                 <h3>Indicadores para Relato ({selectedIndicatorIds.size} selecionados)</h3>
                 
                 <div className="indicator-controls">
                    <div className="search-bar-container">
                        <span className="material-icons">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por código ou título do indicador (ex: GRI 2-1, Emissões...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <button className="button secondary" onClick={handleOpenCreateForm}>
                        <span className="material-icons" style={{marginRight: '8px'}}>add_circle</span>
                        Novo Indicador
                    </button>
                </div>
                 
                <div style={{marginTop: '1rem'}}>
                    {renderStandardGroup('Indicadores Personalizados (Geral)', filteredStandards.custom)}
                    {renderStandardGroup('Normas Universais', filteredStandards.universal)}
                    {renderStandardGroup('Normas Setoriais', filteredStandards.sectorial)}
                    {renderStandardGroup('Normas Temáticas: Série 200 (Econômico)', filteredStandards.economic)}
                    {renderStandardGroup('Normas Temáticas: Série 300 (Ambiental)', filteredStandards.environmental)}
                    {renderStandardGroup('Normas Temáticas: Série 400 (Social)', filteredStandards.social)}
                    {renderStandardGroup('Normas SASB', filteredStandards.sasb)}

                    {noResults && (
                        <div className="no-results-message">
                            <p>Nenhum indicador encontrado para "<strong>{searchTerm}</strong>".</p>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="button-group">
                <button className="button" onClick={handleConfirmSelection} disabled={selectedIndicatorIds.size === 0}>
                    Confirmar Seleção e Avançar
                </button>
            </div>
        </div>
    );
};

const Step3_Assignment: React.FC<{
    indicators: Indicators;
    setIndicators: (id: string, field: string, value: any) => void;
    onComplete: () => void;
    currentUser: string;
    responsiblePeople: ResponsiblePerson[];
    setResponsiblePeople: (people: ResponsiblePerson[]) => void;
}> = ({ indicators, setIndicators, onComplete, currentUser, responsiblePeople, setResponsiblePeople }) => {
    const isEditable = currentUser === 'Administrador';

    const [newPerson, setNewPerson] = useState({ name: '', email: '', area: '' });

    const handleAddPerson = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPerson.name && newPerson.email && newPerson.area && !responsiblePeople.some(p => p.email === newPerson.email)) {
            const person: ResponsiblePerson = { id: Date.now().toString(), ...newPerson };
            setResponsiblePeople([...responsiblePeople, person]);
            setNewPerson({ name: '', email: '', area: '' });
        }
    };

    const handleRemovePerson = (id: string) => {
        const personToRemove = responsiblePeople.find(p => p.id === id);
        if (personToRemove) {
            Object.values(indicators).forEach(indicator => {
                if (indicator.focalPoint === personToRemove.name) {
                    setIndicators(indicator.id, 'focalPoint', '');
                    setIndicators(indicator.id, 'status', 'pending_assignment');
                }
                if (indicator.reviewer === personToRemove.name) {
                    setIndicators(indicator.id, 'reviewer', '');
                }
            });
        }
        setResponsiblePeople(responsiblePeople.filter(p => p.id !== id));
    };

    const handleAssignment = (indicatorId: string, type: 'focalPoint' | 'reviewer' | 'deadline', value: string) => {
        const indicator = indicators[indicatorId];
        const isNewFocalPoint = type === 'focalPoint' && value && indicator.focalPoint !== value;
        
        setIndicators(indicatorId, type, value);

        if (type === 'focalPoint' || type === 'deadline') {
            const updatedIndicator = { ...indicator, [type]: value };
            const focalPointPerson = responsiblePeople.find(p => p.name === updatedIndicator.focalPoint);
            
            if (isNewFocalPoint && updatedIndicator.deadline && focalPointPerson) {
                // Simulate email notification
                const deadlineDate = new Date(`${updatedIndicator.deadline}T00:00:00Z`); // Explicitly parse as UTC
                const focalPointDeadline = new Date(deadlineDate);
                focalPointDeadline.setUTCDate(deadlineDate.getUTCDate() - 7); // Use UTC methods

                const formattedDeadline = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(focalPointDeadline);

                const message = `
                    Olá ${focalPointPerson.name},
                    
                    Você foi designado(a) como Ponto Focal para o indicador:
                    - ${indicator.id}: ${indicator.title}
                    
                    A data limite para o preenchimento é ${formattedDeadline}.
                    
                    Acesse a plataforma para iniciar a coleta de dados.
                `;
                alert(`--- SIMULAÇÃO DE E-MAIL ---\n\nPara: ${focalPointPerson.email}\n\nAssunto: Nova tarefa de coleta de dados ESG\n\n${message}`);
            }
        }
        
        if (type === 'focalPoint' && indicator.status === 'pending_assignment') {
            if (value) {
                setIndicators(indicatorId, 'status', 'pending_collection');
            } else {
                setIndicators(indicatorId, 'status', 'pending_assignment');
            }
        }
    };

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 3: Atribuição de Responsáveis</h2>
                <p>Cadastre os responsáveis e, em seguida, atribua um "Ponto Focal", um "Revisor" (opcional) e uma "Data Limite" para cada indicador.</p>
            </div>

            <div className="card">
                <h3>Cadastro de Responsáveis</h3>
                {isEditable ? (
                    <form onSubmit={handleAddPerson} className="responsible-form">
                        <div className="form-group">
                            <label htmlFor="resp-name">Nome</label>
                            <input type="text" id="resp-name" value={newPerson.name} onChange={e => setNewPerson({...newPerson, name: e.target.value})} placeholder="Nome Completo" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="resp-email">Email</label>
                            <input type="email" id="resp-email" value={newPerson.email} onChange={e => setNewPerson({...newPerson, email: e.target.value})} placeholder="exemplo@empresa.com" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="resp-area">Área/Departamento</label>
                            <input type="text" id="resp-area" value={newPerson.area} onChange={e => setNewPerson({...newPerson, area: e.target.value})} placeholder="Sustentabilidade" required />
                        </div>
                        <button type="submit" className="button">Adicionar Responsável</button>
                    </form>
                ) : <p>Apenas o Administrador pode cadastrar novos responsáveis.</p>}

                {responsiblePeople.length > 0 && (
                    <div className="responsible-list">
                        {responsiblePeople.map(person => (
                            <div key={person.id} className="responsible-item">
                                <div>
                                    <strong>{person.name}</strong> ({person.area})<br />
                                    <small>{person.email}</small>
                                </div>
                                {isEditable && (
                                    <button onClick={() => handleRemovePerson(person.id)} className="remove-file-btn">
                                        <span className="material-icons">delete</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Atribuição de Indicadores</h3>
                <div className="table-container">
                    <table className="assignment-table">
                        <thead>
                            <tr>
                                <th>Indicador</th>
                                <th>Ponto Focal (Preenchimento)</th>
                                <th>Revisor (Aprovação Interna)</th>
                                <th>Data Limite</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(indicators).map(indicator => (
                                <tr key={indicator.id}>
                                    <td>
                                        <strong>{indicator.id}</strong><br />
                                        <small>{indicator.title}</small>
                                    </td>
                                    <td>
                                        <select
                                            value={indicator.focalPoint}
                                            onChange={e => handleAssignment(indicator.id, 'focalPoint', e.target.value)}
                                            disabled={!isEditable}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {responsiblePeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            value={indicator.reviewer}
                                            onChange={e => handleAssignment(indicator.id, 'reviewer', e.target.value)}
                                            disabled={!isEditable}
                                        >
                                            <option value="">Nenhum (Opcional)</option>
                                            {responsiblePeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="date"
                                            value={indicator.deadline}
                                            onChange={e => handleAssignment(indicator.id, 'deadline', e.target.value)}
                                            disabled={!isEditable}
                                            required
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="button-group">
                <button className="button" onClick={onComplete}>
                    Avançar para Coleta de Dados
                </button>
            </div>
        </div>
    );
};


const Dropzone: React.FC<{
    onFilesAdded: (files: File[]) => void;
    disabled: boolean;
}> = ({ onFilesAdded, disabled }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (disabled) return;
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files && files.length > 0) {
            onFilesAdded(files);
        }
    };
    
    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
         if (files && files.length > 0) {
            onFilesAdded(files);
        }
    }

    return (
        <>
        <input 
          type="file" 
          id="file-input" 
          style={{display: 'none'}} 
          multiple
          onChange={handleFileSelect}
          disabled={disabled}
        />
        <div
            className={`dropzone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
            <p>Arraste e solte os arquivos aqui, ou clique para selecionar.</p>
        </div>
        </>
    );
};

const CreateTableModal: React.FC<{
    onClose: () => void;
    onCreate: (rows: number, cols: number) => void;
}> = ({ onClose, onCreate }) => {
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);

    const handleCreate = () => {
        if (rows > 0 && cols > 0) {
            onCreate(rows, cols);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Criar Tabela</h3>
                    <button onClick={onClose} className="close-button" aria-label="Fechar">&times;</button>
                </div>
                <div className="form-group">
                    <label htmlFor="table-rows">Linhas</label>
                    <input 
                        type="number" 
                        id="table-rows" 
                        value={rows} 
                        onChange={e => setRows(parseInt(e.target.value, 10) || 1)} 
                        min="1" 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="table-cols">Colunas</label>
                    <input 
                        type="number" 
                        id="table-cols" 
                        value={cols} 
                        onChange={e => setCols(parseInt(e.target.value, 10) || 1)} 
                        min="1" 
                    />
                </div>
                <div className="button-group">
                    <button className="button secondary" onClick={onClose}>Cancelar</button>
                    <button className="button" onClick={handleCreate}>Criar Tabela</button>
                </div>
            </div>
        </div>
    );
};

const AskQuestionModal: React.FC<{
    indicator: Indicator;
    onClose: () => void;
    onSend: (question: string) => void;
}> = ({ indicator, onClose, onSend }) => {
    const [question, setQuestion] = useState('');

    const handleSend = () => {
        if (question.trim()) {
            onSend(question);
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Tirar Dúvida</h3>
                    <button onClick={onClose} className="close-button" aria-label="Fechar">&times;</button>
                </div>
                <p>Sua dúvida sobre o indicador <strong>{indicator.id} - {indicator.title}</strong> será enviada para o administrador.</p>
                <div className="form-group" style={{marginTop: '1rem'}}>
                    <label htmlFor="question-text">Sua Pergunta:</label>
                    <textarea
                        id="question-text"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        placeholder="Digite sua dúvida aqui..."
                        rows={5}
                    />
                </div>
                <div className="button-group">
                    <button className="button secondary" onClick={onClose}>Cancelar</button>
                    <button className="button" onClick={handleSend} disabled={!question.trim()}>Enviar Dúvida</button>
                </div>
            </div>
        </div>
    );
};


const Step4_DataCollection: React.FC<{
    indicators: Indicators;
    onUpdate: (id: string, field: string, value: any) => void;
    onSubmit: (id: string) => void;
    currentUser: string;
    fetchHistoricalContext: (indicator: Indicator) => void;
    sustainabilityReportText: string;
    setSustainabilityReportText: (text: string) => void;
    onAskQuestion: (indicatorId: string, question: string) => void;
    onAnswerQuestion: (indicatorId: string, qnaId: string, answer: string) => void;
}> = ({ indicators, onUpdate, onSubmit, currentUser, fetchHistoricalContext, sustainabilityReportText, setSustainabilityReportText, onAskQuestion, onAnswerQuestion }) => {

    const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('indicator_status');
    const [createTableModalInfo, setCreateTableModalInfo] = useState<{ indicatorId: string; reqIndex: number } | null>(null);
    const [isAskingQuestion, setIsAskingQuestion] = useState(false);
    const [answerTexts, setAnswerTexts] = useState<{ [qnaId: string]: string }>({});

    const tasks = useMemo(() => {
        let baseTasks = (currentUser === 'Administrador')
            ? Object.values(indicators)
            : Object.values(indicators).filter(i =>
                i.focalPoint === currentUser && (i.status === 'pending_collection' || i.status === 'changes_requested' || i.status === 'in_progress')
            );

        if (searchTerm.trim()) {
            const lowercasedFilter = searchTerm.toLowerCase();
            baseTasks = baseTasks.filter(indicator =>
                indicator.id.toLowerCase().includes(lowercasedFilter) ||
                indicator.title.toLowerCase().includes(lowercasedFilter) ||
                (indicator.focalPoint && indicator.focalPoint.toLowerCase().includes(lowercasedFilter)) ||
                (indicator.reviewer && indicator.reviewer.toLowerCase().includes(lowercasedFilter))
            );
        }
        
        const statusOrder: { [key in IndicatorStatus]: number } = {
            'changes_requested': 1,
            'in_progress': 2,
            'pending_collection': 3,
            'pending_review': 4,
            'internally_approved': 5,
            'final_approved': 6,
            'pending_assignment': 7,
        };

        const sortedTasks = [...baseTasks].sort((a, b) => {
            const dateA = a.deadline ? new Date(a.deadline).getTime() : 0;
            const dateB = b.deadline ? new Date(b.deadline).getTime() : 0;
    
            switch (sortOption) {
                case 'deadline_asc':
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateA - dateB;
                case 'deadline_desc':
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateB - dateA;
                case 'indicator_status':
                default:
                    const priorityA = statusOrder[a.status] || 99;
                    const priorityB = statusOrder[b.status] || 99;
                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }
                     // Secondary sort by deadline if statuses are the same
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateA - dateB;
            }
        });

        return sortedTasks;

    }, [indicators, currentUser, searchTerm, sortOption]);

    const selectedIndicator = useMemo(() => {
        if (!selectedIndicatorId) return null;
        return indicators[selectedIndicatorId] || null;
    }, [selectedIndicatorId, indicators]);

    const handleSelectIndicator = (indicator: Indicator) => {
        setSelectedIndicatorId(indicator.id);
        setActiveTab('current');
    };

    const handleFileAdd = (indicatorId: string, newFiles: File[]) => {
        const currentFiles = indicators[indicatorId].files || [];
        onUpdate(indicatorId, 'files', [...currentFiles, ...newFiles]);
    };

    const handleFileRemove = (indicatorId: string, fileToRemove: File) => {
        const currentFiles = indicators[indicatorId].files || [];
        onUpdate(indicatorId, 'files', currentFiles.filter(file => file !== fileToRemove));
    };
    
    const handleTextDataChange = (indicator: Indicator, reqIndex: number, value: string) => {
        const newData = { ...(indicator.data || {}), [reqIndex]: value };
        onUpdate(indicator.id, 'data', newData);
        if (indicator.status === 'pending_collection') {
             onUpdate(indicator.id, 'status', 'in_progress');
        }
    };

    const handleTableCellChange = (indicator: Indicator, reqIndex: number, rowIndex: number, colIndex: number, value: string) => {
        try {
            const currentData = JSON.parse(indicator.data[reqIndex] || '{}');
            if (currentData.type === 'table') {
                const newTableData = [...currentData.data];
                newTableData[rowIndex] = [...newTableData[rowIndex]]; // Create new row array
                newTableData[rowIndex][colIndex] = value;
                const newDataPayload = JSON.stringify({ type: 'table', data: newTableData });
                const newData = { ...(indicator.data || {}), [reqIndex]: newDataPayload };
                onUpdate(indicator.id, 'data', newData);

                if (indicator.status === 'pending_collection') {
                    onUpdate(indicator.id, 'status', 'in_progress');
                }
            }
        } catch (e) {
            console.error("Failed to update table cell", e);
        }
    };

    const handleTableCreate = (rows: number, cols: number) => {
        if (!createTableModalInfo) return;
        const { indicatorId, reqIndex } = createTableModalInfo;

        const newTable = Array(rows).fill(null).map(() => Array(cols).fill(''));
        const newDataPayload = JSON.stringify({ type: 'table', data: newTable });
        
        const indicator = indicators[indicatorId];
        const newData = { ...(indicator.data || {}), [reqIndex]: newDataPayload };
        onUpdate(indicatorId, 'data', newData);

        if (indicator.status === 'pending_collection') {
            onUpdate(indicator.id, 'status', 'in_progress');
        }
        setCreateTableModalInfo(null);
    };

    const handleRemoveTable = (indicatorId: string, reqIndex: number) => {
        const indicator = indicators[indicatorId];
        const newData = { ...(indicator.data || {}), [reqIndex]: '' };
        onUpdate(indicatorId, 'data', newData);
    };

    const handleSubmit = (indicatorId: string) => {
        onSubmit(indicatorId);
        setSelectedIndicatorId(null);
    };

    const handleSaveProgress = () => {
        setShowSaveConfirmation(true);
        setTimeout(() => {
            setShowSaveConfirmation(false);
        }, 2500);
    };

    if (selectedIndicator) {
        const requirements = parseRequirements(selectedIndicator.requirements);
        const allFieldsFilled = requirements.every((_, index) => {
            const reqData = selectedIndicator.data?.[index];
            if (!reqData) return false;

            try {
                const parsed = JSON.parse(reqData);
                if (parsed && parsed.type === 'table' && Array.isArray(parsed.data)) {
                    return parsed.data.every((row: any[]) => Array.isArray(row) && row.every(cell => String(cell).trim() !== ''));
                }
            } catch (e) { /* Not a table */ }
            
            return reqData.trim() !== '';
        });

        return (
            <div className="indicator-detail-view">
                 {createTableModalInfo && (
                    <CreateTableModal
                        onClose={() => setCreateTableModalInfo(null)}
                        onCreate={handleTableCreate}
                    />
                )}
                {isAskingQuestion && (
                    <AskQuestionModal
                        indicator={selectedIndicator}
                        onClose={() => setIsAskingQuestion(false)}
                        onSend={(question) => onAskQuestion(selectedIndicator.id, question)}
                    />
                )}
                <button onClick={() => setSelectedIndicatorId(null)} className="back-button">
                    <span className="material-icons">arrow_back</span> Voltar para a lista
                </button>
                <div className={`card ${selectedIndicator.status === 'changes_requested' ? 'changes-requested-border' : ''}`}>
                    <h4>{selectedIndicator.standard}: {selectedIndicator.id} - {selectedIndicator.title}</h4>
                    
                    {selectedIndicator.status === 'changes_requested' && selectedIndicator.reviewComments && (
                        <div className="review-comments-box">
                            <h4><span className="material-icons">feedback</span>Solicitação de Alteração do Revisor</h4>
                            <p>{selectedIndicator.reviewComments}</p>
                        </div>
                    )}
                    
                    <div className="tabs">
                        <button className={`tab-button ${activeTab === 'current' ? 'active' : ''}`} onClick={() => setActiveTab('current')}>Dados Atuais</button>
                        <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Contexto Histórico (IA)</button>
                    </div>

                    <div className="tab-content">
                        {activeTab === 'current' && (
                            <>
                                <div style={{ marginTop: '1.5rem' }}>
                                    {requirements.map((req, index) => {
                                        const reqData = (selectedIndicator.data && selectedIndicator.data[index]) || '';
                                        let tableContent: { type: 'table', data: string[][] } | null = null;
                                        try {
                                            const parsed = JSON.parse(reqData);
                                            if (parsed && parsed.type === 'table' && Array.isArray(parsed.data)) {
                                                tableContent = parsed;
                                            }
                                        } catch (e) { /* Not a JSON object, treat as text */ }

                                        return (
                                            <div className="form-group" key={index}>
                                                <label htmlFor={`data-${selectedIndicator.id}-${index}`} className="requirement-label">{req}</label>
                                                {tableContent ? (
                                                    <div className="editable-table-container">
                                                        <table className="editable-table">
                                                            <tbody>
                                                                {tableContent.data.map((row, rowIndex) => (
                                                                    <tr key={rowIndex}>
                                                                        {row.map((cell, colIndex) => (
                                                                            <td key={colIndex}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={cell}
                                                                                    onChange={e => handleTableCellChange(selectedIndicator, index, rowIndex, colIndex, e.target.value)}
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <button onClick={() => handleRemoveTable(selectedIndicator.id, index)} className="remove-table-btn">
                                                            <span className="material-icons" style={{fontSize: '1rem'}}>delete</span> Remover Tabela
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="requirement-input-container">
                                                        <textarea
                                                            id={`data-${selectedIndicator.id}-${index}`}
                                                            value={reqData}
                                                            onChange={e => handleTextDataChange(selectedIndicator, index, e.target.value)}
                                                        />
                                                        <button 
                                                            className="insert-table-btn" 
                                                            onClick={() => setCreateTableModalInfo({ indicatorId: selectedIndicator.id, reqIndex: index })}
                                                        >
                                                            Inserir Tabela
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                <div className="form-group">
                                    <label>Anexar Evidências</label>
                                    <Dropzone onFilesAdded={(files) => handleFileAdd(selectedIndicator.id, files)} disabled={false} />
                                    {selectedIndicator.files && selectedIndicator.files.length > 0 && (
                                        <ul className="file-list">
                                            {selectedIndicator.files.map((file, index) => (
                                                <li key={index} className="file-item">
                                                    <div className="file-info">
                                                        <span className="material-icons">attachment</span>
                                                        <span>{file.name}</span>
                                                    </div>
                                                    <button className="remove-file-btn" onClick={() => handleFileRemove(selectedIndicator.id, file)}>
                                                        <span className="material-icons">delete</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="button-group">
                                    {currentUser !== 'Administrador' && (
                                        <button className="button secondary" onClick={() => setIsAskingQuestion(true)}>
                                             <span className="material-icons" style={{marginRight: '8px'}}>help_outline</span>
                                            Tirar Dúvida
                                        </button>
                                    )}
                                    <span style={{flexGrow: 1}}></span>
                                    {showSaveConfirmation && <span className="save-confirmation">Progresso salvo!</span>}
                                    <button className="button secondary" onClick={handleSaveProgress}>
                                        Salvar Progresso
                                    </button>
                                    <button className="button" onClick={() => handleSubmit(selectedIndicator.id)} disabled={!allFieldsFilled}>
                                        {selectedIndicator.status === 'changes_requested' ? 'Reenviar para Revisão' : 'Enviar para Revisão'}
                                    </button>
                                </div>
                            </>
                        )}
                        {activeTab === 'history' && (
                             <div className="historical-context">
                                <h4>Assistente de IA - Relatório Anterior</h4>
                                <div className="form-group">
                                    <label htmlFor="report-content">Conteúdo do Relatório de Sustentabilidade Anterior</label>
                                    <p>Cole o texto do seu relatório anterior no campo abaixo. A IA usará este conteúdo para encontrar informações relevantes para o indicador selecionado.</p>
                                    <textarea
                                        id="report-content"
                                        placeholder="Cole o conteúdo do seu relatório aqui..."
                                        value={sustainabilityReportText}
                                        onChange={(e) => setSustainabilityReportText(e.target.value)}
                                    />
                                </div>
                                <div className="button-group" style={{justifyContent: 'center', margin: '1rem 0'}}>
                                    <button 
                                        className="button secondary" 
                                        onClick={() => fetchHistoricalContext(selectedIndicator)} 
                                        disabled={selectedIndicator.historyLoading || !sustainabilityReportText.trim()}
                                    >
                                        {selectedIndicator.historyLoading ? 'Buscando...' : 'Buscar no Relatório Colado'}
                                    </button>
                                </div>
                                {selectedIndicator.historyLoading && <div className="loader-container"><div className="loader"></div></div>}
                                {selectedIndicator.historicalContext && !selectedIndicator.historyLoading && (
                                    <div className="review-data">
                                        <p>{selectedIndicator.historicalContext}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedIndicator.qna && selectedIndicator.qna.length > 0 && (
                        <div className="qna-section">
                            <h4>Dúvidas e Respostas</h4>
                            {selectedIndicator.qna.map(qnaItem => (
                                <div key={qnaItem.id} className="qna-item">
                                    <p className="qna-question">{qnaItem.question}</p>
                                    <p className="qna-meta">
                                        Perguntado por: {qnaItem.asker} em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(qnaItem.questionTimestamp))}
                                    </p>
                                    {qnaItem.answer ? (
                                        <div className="qna-answer-box">
                                            <p className="qna-answer">{qnaItem.answer}</p>
                                            <p className="qna-meta">
                                                Respondido por: Administrador em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(qnaItem.answerTimestamp))}
                                            </p>
                                        </div>
                                    ) : (
                                        currentUser === 'Administrador' && (
                                            <div className="answer-form">
                                                <div className="form-group">
                                                    <label htmlFor={`answer-${qnaItem.id}`}>Sua Resposta:</label>
                                                    <textarea
                                                        id={`answer-${qnaItem.id}`}
                                                        value={answerTexts[qnaItem.id] || ''}
                                                        onChange={e => setAnswerTexts({...answerTexts, [qnaItem.id]: e.target.value})}
                                                    />
                                                </div>
                                                <div className="button-group">
                                                    <button
                                                        className="button"
                                                        onClick={() => onAnswerQuestion(selectedIndicator.id, qnaItem.id, answerTexts[qnaItem.id] || '')}
                                                        disabled={!(answerTexts[qnaItem.id] || '').trim()}
                                                    >
                                                        Responder
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 4: Coleta de Dados</h2>
                <p>{currentUser === 'Administrador' ? 'Visualize o progresso de todos os indicadores.' : 'Clique em um indicador para preencher as informações e anexar evidências.'}</p>
            </div>
            <div className="card">
                <h3>{currentUser === 'Administrador' ? 'Painel Geral de Indicadores' : 'Minhas Tarefas'}</h3>
                <div className="controls-container">
                    <div className="search-bar-container">
                        <span className="material-icons">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por código, título, ponto focal ou revisor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="sort-controls">
                        <label htmlFor="sort-select">Ordenar por:</label>
                        <select id="sort-select" value={sortOption} onChange={e => setSortOption(e.target.value)}>
                            <option value="indicator_status">Status do Indicador</option>
                            <option value="deadline_asc">Data Limite (Mais Próxima)</option>
                            <option value="deadline_desc">Data Limite (Mais Longe)</option>
                        </select>
                    </div>
                </div>
                {tasks.length > 0 ? (
                    <div className="table-container">
                        <table className="task-table">
                            <thead>
                                <tr>
                                    <th>Indicador</th>
                                    <th>Status</th>
                                    <th>Ponto Focal</th>
                                    <th>Data Limite</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map(indicator => {
                                    const deadlineInfo = getDeadlineStatus(indicator.deadline);
                                    const hasOpenQuestion = currentUser === 'Administrador' && indicator.qna?.some(q => !q.answer);
                                    return (
                                    <tr key={indicator.id} onClick={() => handleSelectIndicator(indicator)} title="Clique para editar">
                                        <td>
                                            <strong>{indicator.id}</strong><br />
                                            <small>{indicator.title}</small>
                                        </td>
                                        <td><span className={`status-badge status-${indicator.status.replace(/_/g, '-')}`}>{getStatusText(indicator.status)}</span></td>
                                        <td>{indicator.focalPoint || 'N/D'}</td>
                                        <td className={`deadline-cell ${deadlineInfo.status}`}>
                                            {indicator.deadline ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${indicator.deadline}T00:00:00Z`)) : 'N/D'}
                                            {hasOpenQuestion && <span className="material-icons question-icon" title="Dúvida pendente">help_outline</span>}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-light)' }}>
                         {searchTerm.trim()
                            ? `Nenhum indicador encontrado para "${searchTerm}".`
                            : (currentUser === 'Administrador' ? 'Nenhum indicador para exibir.' : 'Você não tem indicadores pendentes para preenchimento.')
                        }
                    </p>
                )}
            </div>
        </div>
    );
};


const Step5_InternalReview: React.FC<{
    indicators: Indicators;
    onApprove: (id: string) => void;
    onRequestChanges: (id: string, comments: string) => void;
    currentUser: string;
}> = ({ indicators, onApprove, onRequestChanges, currentUser }) => {
    const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
    const [localComments, setLocalComments] = useState<{ [key: string]: string }>({});

    const handleCommentChange = (id: string, value: string) => {
        setLocalComments(prev => ({ ...prev, [id]: value }));
    };

    const tasksToReview = useMemo(() => Object.values(indicators).filter(i =>
        i.status === 'pending_review' && (i.reviewer === currentUser || currentUser === 'Administrador')
    ), [indicators, currentUser]);

    const selectedIndicator = useMemo(() => {
        if (!selectedIndicatorId) return null;
        return indicators[selectedIndicatorId] || null;
    }, [selectedIndicatorId, indicators]);

    const handleApprove = (indicatorId: string) => {
        onApprove(indicatorId);
        setSelectedIndicatorId(null);
    };

    const handleRequestChanges = (indicatorId: string) => {
        onRequestChanges(indicatorId, localComments[indicatorId] || '');
        setSelectedIndicatorId(null);
    };

    if (selectedIndicator) {
        return (
            <div className="indicator-detail-view">
                <button onClick={() => setSelectedIndicatorId(null)} className="back-button">
                    <span className="material-icons">arrow_back</span> Voltar para a lista de revisão
                </button>
                <div className="card">
                    <h4>{selectedIndicator.standard}: {selectedIndicator.id} - {selectedIndicator.title}</h4>
                    
                    <label style={{fontWeight: 600, color: 'var(--secondary-color)', marginTop: '1rem', display: 'block'}}>Dados e Resposta Submetidos:</label>
                    {(() => {
                        const requirements = parseRequirements(selectedIndicator.requirements);
                        return (
                            <div className="review-data">
                                {requirements.map((req, index) => {
                                    const reqData = selectedIndicator.data?.[index] || 'Não preenchido.';
                                    let tableContent: { data: string[][] } | null = null;
                                    try {
                                        const parsed = JSON.parse(reqData);
                                        if (parsed && parsed.type === 'table' && Array.isArray(parsed.data)) {
                                            tableContent = parsed;
                                        }
                                    } catch (e) {}

                                    return (
                                        <div className="review-item" key={index}>
                                            <strong>{req}</strong>
                                            {tableContent ? (
                                                <table className="review-table">
                                                    <tbody>
                                                        {tableContent.data.map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                {row.map((cell, cIdx) => (
                                                                    <td key={cIdx}>{cell}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p>{reqData}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    <label style={{fontWeight: 600, color: 'var(--secondary-color)'}}>Evidências Anexadas:</label>
                    {selectedIndicator.files && selectedIndicator.files.length > 0 ? (
                        <ul className="file-list">
                            {selectedIndicator.files.map((file, index) => (
                                <li key={index} className="file-item">
                                    <div className="file-info">
                                        <span className="material-icons">attachment</span>
                                        <span>{file.name}</span>
                                    </div>
                                    <a
                                        href={URL.createObjectURL(file)}
                                        download={file.name}
                                        className="download-file-btn"
                                        title={`Baixar ${file.name}`}
                                    >
                                        <span className="material-icons">download</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : <p>Nenhuma evidência anexada.</p>}

                     <div className="form-group" style={{marginTop: '1.5rem'}}>
                        <label htmlFor={`comment-${selectedIndicator.id}`}>Comentários para Alteração (obrigatório se solicitar alterações)</label>
                        <textarea
                            id={`comment-${selectedIndicator.id}`}
                            value={localComments[selectedIndicator.id] || ''}
                            onChange={e => handleCommentChange(selectedIndicator.id, e.target.value)}
                         />
                    </div>
                    <div className="button-group">
                         <button className="button warning" onClick={() => handleRequestChanges(selectedIndicator.id)} disabled={!localComments[selectedIndicator.id]}>
                            Solicitar Alterações
                        </button>
                        <button className="button success" onClick={() => handleApprove(selectedIndicator.id)}>
                            Aprovar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 5: Revisão Interna</h2>
                <p>Revise os dados e evidências submetidos pelos Pontos Focais.</p>
            </div>
            <div className="card">
                <h3>{currentUser === 'Administrador' ? 'Painel Geral de Revisão' : 'Minhas Tarefas de Revisão'}</h3>
                {tasksToReview.length > 0 ? (
                    <div className="table-container">
                        <table className="task-table">
                            <thead>
                                <tr>
                                    <th>Indicador</th>
                                    <th>Status</th>
                                    <th>Ponto Focal</th>
                                    <th>Data Limite</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasksToReview.map(indicator => (
                                    <tr key={indicator.id} onClick={() => setSelectedIndicatorId(indicator.id)} title="Clique para revisar">
                                        <td>
                                            <strong>{indicator.id}</strong><br />
                                            <small>{indicator.title}</small>
                                        </td>
                                        <td><span className={`status-badge status-${indicator.status.replace(/_/g, '-')}`}>{getStatusText(indicator.status)}</span></td>
                                        <td>{indicator.focalPoint || 'N/D'}</td>
                                        <td>{indicator.deadline ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${indicator.deadline}T00:00:00Z`)) : 'N/D'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Nenhum indicador aguardando sua revisão.</p>
                )}
            </div>
        </div>
    );
};

const Step6_ESGReview: React.FC<{
    indicators: Indicators;
    onFinalApprove: (id: string) => void;
    onReturnForAdjustments: (id: string, comments: string) => void;
    currentUser: string;
}> = ({ indicators, onFinalApprove, onReturnForAdjustments, currentUser }) => {
    const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
    const [localComments, setLocalComments] = useState<{ [key: string]: string }>({});

    const handleCommentChange = (id: string, value: string) => {
        setLocalComments(prev => ({ ...prev, [id]: value }));
    };

    const tasksToReview = useMemo(() => Object.values(indicators).filter(i =>
        i.status === 'internally_approved'
    ), [indicators]);

    const selectedIndicator = useMemo(() => {
        if (!selectedIndicatorId) return null;
        return indicators[selectedIndicatorId] || null;
    }, [selectedIndicatorId, indicators]);

    const handleFinalApprove = (indicatorId: string) => {
        onFinalApprove(indicatorId);
        setSelectedIndicatorId(null);
    };

    const handleReturnForAdjustments = (indicatorId: string) => {
        onReturnForAdjustments(indicatorId, localComments[indicatorId] || '');
        setSelectedIndicatorId(null);
    };

    const isAllowed = currentUser === 'Administrador';

    if (!isAllowed) {
        return (
            <div>
                <div className="content-header">
                    <h2>Etapa 6: Revisão Final (Consultoria ESG)</h2>
                    <p>Aprovação final dos indicadores revisados internamente. Apenas o Administrador pode executar esta ação.</p>
                </div>
                <div className="card">
                    <p>Você não tem permissão para acessar esta etapa.</p>
                </div>
            </div>
        );
    }

    if (selectedIndicator) {
        return (
            <div className="indicator-detail-view">
                <button onClick={() => setSelectedIndicatorId(null)} className="back-button">
                    <span className="material-icons">arrow_back</span> Voltar para a lista de aprovação
                </button>
                <div className="card">
                    <h4>{selectedIndicator.standard}: {selectedIndicator.id} - {selectedIndicator.title}</h4>
                    
                    <label style={{fontWeight: 600, color: 'var(--secondary-color)', marginTop: '1rem', display: 'block'}}>Dados e Resposta Aprovados Internamente:</label>
                    {(() => {
                        const requirements = parseRequirements(selectedIndicator.requirements);
                         return (
                            <div className="review-data">
                                {requirements.map((req, index) => {
                                    const reqData = selectedIndicator.data?.[index] || 'Não preenchido.';
                                    let tableContent: { data: string[][] } | null = null;
                                    try {
                                        const parsed = JSON.parse(reqData);
                                        if (parsed && parsed.type === 'table' && Array.isArray(parsed.data)) {
                                            tableContent = parsed;
                                        }
                                    } catch (e) {}

                                    return (
                                        <div className="review-item" key={index}>
                                            <strong>{req}</strong>
                                            {tableContent ? (
                                                <table className="review-table">
                                                    <tbody>
                                                        {tableContent.data.map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                {row.map((cell, cIdx) => (
                                                                    <td key={cIdx}>{cell}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p>{reqData}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    <label style={{fontWeight: 600, color: 'var(--secondary-color)'}}>Evidências Anexadas:</label>
                    {selectedIndicator.files && selectedIndicator.files.length > 0 ? (
                        <ul className="file-list">
                            {selectedIndicator.files.map((file, index) => (
                                <li key={index} className="file-item">
                                    <div className="file-info">
                                        <span className="material-icons">attachment</span>
                                        <span>{file.name}</span>
                                    </div>
                                     <a
                                        href={URL.createObjectURL(file)}
                                        download={file.name}
                                        className="download-file-btn"
                                        title={`Baixar ${file.name}`}
                                    >
                                        <span className="material-icons">download</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : <p>Nenhuma evidência anexada.</p>}

                     <div className="form-group" style={{marginTop: '1.5rem'}}>
                        <label htmlFor={`comment-final-${selectedIndicator.id}`}>Comentários para Ajustes (obrigatório se retornar)</label>
                        <textarea
                            id={`comment-final-${selectedIndicator.id}`}
                            value={localComments[selectedIndicator.id] || ''}
                            onChange={e => handleCommentChange(selectedIndicator.id, e.target.value)}
                         />
                    </div>
                    <div className="button-group">
                        <button className="button warning" onClick={() => handleReturnForAdjustments(selectedIndicator.id)} disabled={!localComments[selectedIndicator.id]}>
                            Retornar para Ajustes
                        </button>
                        <button className="button success" onClick={() => handleFinalApprove(selectedIndicator.id)}>
                            Aprovação Final
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 6: Revisão Final (Consultoria ESG)</h2>
                <p>Aprovação final dos indicadores revisados internamente. Apenas o Administrador pode executar esta ação.</p>
            </div>
            <div className="card">
                <h3>Painel de Aprovação Final</h3>
                {tasksToReview.length > 0 ? (
                    <div className="table-container">
                        <table className="task-table">
                            <thead>
                                <tr>
                                    <th>Indicador</th>
                                    <th>Status</th>
                                    <th>Ponto Focal</th>
                                    <th>Revisor</th>
                                    <th>Data Limite</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasksToReview.map(indicator => (
                                    <tr key={indicator.id} onClick={() => setSelectedIndicatorId(indicator.id)} title="Clique para revisar">
                                        <td>
                                            <strong>{indicator.id}</strong><br />
                                            <small>{indicator.title}</small>
                                        </td>
                                        <td><span className={`status-badge status-${indicator.status.replace(/_/g, '-')}`}>{getStatusText(indicator.status)}</span></td>
                                        <td>{indicator.focalPoint || 'N/D'}</td>
                                        <td>{indicator.reviewer || 'N/D'}</td>
                                        <td>{indicator.deadline ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${indicator.deadline}T00:00:00Z`)) : 'N/D'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Nenhum indicador aguardando sua aprovação final.</p>
                )}
            </div>
        </div>
    );
};


const Step7_Export: React.FC<{
    indicators: Indicators;
    companyProfile: CompanyProfile;
}> = ({ indicators, companyProfile }) => {
    const approvedIndicators = useMemo(() => {
        return Object.values(indicators).filter(i => i.status === 'final_approved');
    }, [indicators]);

    const [selectedForExportIds, setSelectedForExportIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setSelectedForExportIds(new Set(approvedIndicators.map(i => i.id)));
    }, [approvedIndicators]);

    const statusSummary = useMemo(() => {
        const counts: { [key in IndicatorStatus]?: number } = {};
        const indicatorList = Object.values(indicators);
        const total = indicatorList.length;

        if (total === 0) return { data: [], labels: [], total: 0, details: [], backgroundColors: [] };

        indicatorList.forEach(indicator => {
            counts[indicator.status] = (counts[indicator.status] || 0) + 1;
        });
        
        const statusOrder: IndicatorStatus[] = [
            'pending_assignment',
            'pending_collection',
            'in_progress',
            'changes_requested',
            'pending_review',
            'internally_approved',
            'final_approved'
        ];

        const details = statusOrder
            .filter(status => counts[status] && counts[status]! > 0)
            .map(status => ({
                status,
                text: getStatusText(status),
                count: counts[status] || 0,
                percentage: ((counts[status] || 0) / total) * 100,
                color: getStatusColor(status)
            }));

        const data = details.map(d => d.count);
        const labels = details.map(d => d.text);
        const backgroundColors = details.map(d => d.color);

        return { data, labels, total, details, backgroundColors };
    }, [indicators]);

    const chartData = {
        labels: statusSummary.labels,
        datasets: [{
            label: 'Indicadores',
            data: statusSummary.data,
            backgroundColor: statusSummary.backgroundColors,
            borderColor: statusSummary.backgroundColors.map(c => '#ffffff'),
            borderWidth: 2,
        }],
    };
    
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: false, // We are creating a custom legend
            },
            tooltip: {
                callbacks: {
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed !== null) {
                            label += context.parsed;
                        }
                        return label;
                    }
                }
            }
        },
    };

    const handleSelectionChange = (indicatorId: string) => {
        const newSelection = new Set(selectedForExportIds);
        if (newSelection.has(indicatorId)) {
            newSelection.delete(indicatorId);
        } else {
            newSelection.add(indicatorId);
        }
        setSelectedForExportIds(newSelection);
    };

    const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedForExportIds(new Set(approvedIndicators.map(i => i.id)));
        } else {
            setSelectedForExportIds(new Set());
        }
    };

    const allSelected = approvedIndicators.length > 0 && selectedForExportIds.size === approvedIndicators.length;
    const someSelected = selectedForExportIds.size > 0 && !allSelected;

    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    const handleExportExcel = () => {
        const indicatorsToExport = approvedIndicators.filter(i => selectedForExportIds.has(i.id));
        const dataForExcel: any[] = [];
        indicatorsToExport.forEach(indicator => {
            const requirements = parseRequirements(indicator.requirements);
            requirements.forEach((req, index) => {
                const responseData = (indicator.data && indicator.data[index]) ? indicator.data[index] : '';
                dataForExcel.push({
                    'ID do Indicador': indicator.id,
                    'Título': indicator.title,
                    'Padrão': indicator.standard,
                    'Requisito': req,
                    'Resposta': responseData, // This will contain the JSON string for tables
                    'Ponto Focal': indicator.focalPoint,
                    'Revisor': indicator.reviewer || 'N/A',
                    'Anexos': indicator.files.map(f => f.name).join(', ') || 'Nenhum'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados Aprovados');
        XLSX.writeFile(workbook, 'Relatorio_Sustentabilidade.xlsx');
    };

    const handleExportPDF = () => {
        const indicatorsToExport = approvedIndicators.filter(i => selectedForExportIds.has(i.id));
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const usableWidth = pageWidth - 2 * margin;
        
        // --- Page 1: Title Page ---
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(companyProfile.name || 'Relatório de Sustentabilidade', pageWidth / 2, 80, { align: 'center' });
    
        if (companyProfile.name) {
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.text('Relatório de Sustentabilidade', pageWidth / 2, 95, { align: 'center' });
        }
    
        doc.setFontSize(12);
        const generatedDate = new Intl.DateTimeFormat('pt-BR').format(new Date());
        doc.text(`Gerado em: ${generatedDate}`, pageWidth / 2, 110, { align: 'center' });

        // --- Page 2: Company Profile ---
        doc.addPage();
        let y = margin + 5;
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Perfil da Empresa', margin, y);
        y += 15;
    
        const addProfileSection = (title: string, content: string) => {
            if (!content.trim()) return; 
            if (y > pageHeight - 40) { 
                doc.addPage();
                y = margin;
            }
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, margin, y);
            y += 7;
    
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(content, usableWidth);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 10;
        };
    
        addProfileSection('Missão', companyProfile.mission);
        addProfileSection('Visão', companyProfile.vision);
        addProfileSection('Valores', companyProfile.values);
    
        // --- Indicator pages ---
        indicatorsToExport.forEach((indicator) => {
            doc.addPage();
            y = 20;

            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Relatório de Sustentabilidade - ${companyProfile.name || ''}`, margin, margin - 5);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(40);
            const titleLines = doc.splitTextToSize(`${indicator.id}: ${indicator.title}`, usableWidth);
            doc.text(titleLines, margin, y);
            y += titleLines.length * 7 + 5;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Padrão: ${indicator.standard}`, margin, y);
            y += 7;
            doc.text(`Ponto Focal: ${indicator.focalPoint}`, margin, y);
            y += 7;
            if(indicator.reviewer) doc.text(`Revisor: ${indicator.reviewer}`, margin, y);
            y += 10;
            
            const requirements = parseRequirements(indicator.requirements);
            requirements.forEach((req, reqIndex) => {
                 if (y > pageHeight - 30) { 
                    doc.addPage();
                    y = 20;
                 }
                 doc.setFont('helvetica', 'bold');
                 const reqLines = doc.splitTextToSize(req, usableWidth);
                 doc.text(reqLines, margin, y);
                 y += reqLines.length * 5 + 2;

                 doc.setFont('helvetica', 'normal');
                 const data = (indicator.data && indicator.data[reqIndex]) ? indicator.data[reqIndex] : 'Não preenchido.';
                 const dataLines = doc.splitTextToSize(data, usableWidth);
                 doc.text(dataLines, margin, y);
                 y += dataLines.length * 5 + 10;
            });
            
             if (y > pageHeight - 40) { 
                doc.addPage();
                y = 20;
             }

            doc.setFont('helvetica', 'bold');
            doc.text('Evidências Anexadas:', margin, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            if (indicator.files.length > 0) {
                indicator.files.forEach(file => {
                    if (y > pageHeight - 20) { 
                        doc.addPage();
                        y = 20;
                    }
                    doc.text(`- ${file.name}`, margin + 5, y);
                    y += 5;
                });
            } else {
                doc.text('Nenhuma evidência anexada.', margin + 5, y);
            }
        });
        
        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, {align: 'right'});
        }

        doc.save('Relatorio_Sustentabilidade.pdf');
    };

    return (
        <div>
            <div className="content-header">
                <h2>Etapa 7: Exportação de Dados</h2>
                <p>Veja o resumo do progresso, selecione os indicadores aprovados e baixe o relatório final.</p>
            </div>

            <div className="card">
                <h3>Resumo Geral do Status</h3>
                {statusSummary.total > 0 ? (
                    <div className="chart-summary-container">
                        <div className="chart-container">
                            <Pie data={chartData} options={chartOptions} />
                        </div>
                        <ul className="summary-list">
                            {statusSummary.details.map(item => (
                                <li key={item.status} className="summary-item">
                                    <span className="summary-color-box" style={{ backgroundColor: item.color }}></span>
                                    <span className="summary-text">{item.text}:</span>
                                    <span className="summary-value">{item.count} ({item.percentage.toFixed(1)}%)</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>Nenhum indicador selecionado para exibir o resumo.</p>
                )}
            </div>

            <div className="card">
                <h3>Selecionar Indicadores para Exportação</h3>
                
                 {approvedIndicators.length > 0 ? (
                    <div className="export-selection-container">
                        <div className="select-all-container">
                            <input
                                type="checkbox"
                                id="select-all-export"
                                ref={selectAllCheckboxRef}
                                checked={allSelected}
                                onChange={handleSelectAllChange}
                                aria-label="Selecionar todos os indicadores para exportação"
                            />
                            <label htmlFor="select-all-export">Selecionar/Deselecionar Todos ({selectedForExportIds.size}/{approvedIndicators.length})</label>
                        </div>
                        <hr className="divider" />
                        <div className="export-selection-list">
                            {approvedIndicators.map(indicator => (
                                <div key={indicator.id} className="export-item">
                                    <input
                                        type="checkbox"
                                        id={`export-${indicator.id}`}
                                        checked={selectedForExportIds.has(indicator.id)}
                                        onChange={() => handleSelectionChange(indicator.id)}
                                    />
                                    <label htmlFor={`export-${indicator.id}`}>{indicator.id} - {indicator.title}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                     <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>
                        Nenhum indicador foi aprovado ainda. Conclua a Etapa 6 para habilitar a exportação.
                    </p>
                )}

                <div className="button-group" style={{ justifyContent: 'flex-start', marginTop: '2rem' }}>
                    <button 
                        className="button" 
                        onClick={handleExportExcel} 
                        disabled={selectedForExportIds.size === 0}
                    >
                         <span className="material-icons" style={{marginRight: '8px', verticalAlign: 'bottom'}}>grid_on</span>
                        Exportar para Excel
                    </button>
                    <button 
                        className="button secondary" 
                        onClick={handleExportPDF}
                        disabled={selectedForExportIds.size === 0}
                    >
                         <span className="material-icons" style={{marginRight: '8px', verticalAlign: 'bottom'}}>picture_as_pdf</span>
                        Exportar para PDF
                    </button>
                </div>
                 {approvedIndicators.length > 0 && selectedForExportIds.size === 0 && (
                    <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>
                       Selecione pelo menos um indicador para exportar.
                    </p>
                )}
            </div>
        </div>
    );
};


const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
