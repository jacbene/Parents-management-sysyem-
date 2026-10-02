/**
 * Utilitaire d'encodage SMS pour la gestion des caractères français (GSM-7 vs UCS-2)
 * Permet de diagnostiquer et d'optimiser l'envoi de SMS via Twilio et passerelles mobiles.
 */

// Alphabet GSM 03.38 standard (7 bits)
// Note: 'é', 'è', 'à', 'ù', 'ì', 'ò', 'Ç' font partie du GSM-7 standard.
// Les lettres 'ê', 'ë', 'â', 'î', 'ï', 'ô', 'û', 'ç' (minuscule) nécessitent UCS-2.
const GSM_7_REGEX = /^[@£$¥èéùìòÇ\r\nØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\f\^{}\[~\]\\|€]*$/;

// Caractères de la table d'extension GSM 03.38 (chacun compte pour 2 caractères / septets en GSM-7)
const GSM_EXTENDED_REGEX = /[\f\^{}\[~\]\\|€]/g;

export interface SmsEncodingAnalysis {
  encoding: 'GSM-7' | 'UCS-2 (Unicode)';
  isGsm7: boolean;
  length: number; // Longueur brute en caractères
  gsmLength: number; // Longueur réelle en unités GSM (inclus les caractères d'extension à double coût)
  segments: number;
  maxPerSingleSms: number;
  maxPerMultiSegment: number;
  charsRemainingInCurrentSegment: number;
  nonGsmCharacters: string[];
  extendedCharactersCount: number;
}

export interface SmsTemplateVariable {
  tag: string;
  aliases: string[];
  labelFr: string;
  labelEn: string;
  sampleValue: string;
  descriptionFr: string;
  descriptionEn: string;
}

export const SMS_DYNAMIC_VARIABLES: SmsTemplateVariable[] = [
  {
    tag: '{NOM_PARENT}',
    aliases: ['{parent_name}'],
    labelFr: 'Nom du Parent',
    labelEn: 'Parent Name',
    sampleValue: 'M. Martin BENE',
    descriptionFr: 'Nom complet du parent destinataire',
    descriptionEn: 'Full recipient parent name'
  },
  {
    tag: '{MONTANT_DU}',
    aliases: ['{remaining_amount}', '{total_due_amount}'],
    labelFr: 'Montant Dû',
    labelEn: 'Amount Due',
    sampleValue: '25 000 FCFA',
    descriptionFr: 'Solde restant de la cotisation exigible',
    descriptionEn: 'Remaining fee amount due'
  },
  {
    tag: '{DATE_ECHEANCE}',
    aliases: ['{due_date}'],
    labelFr: 'Date Échéance',
    labelEn: 'Due Date',
    sampleValue: '15/10/2026',
    descriptionFr: 'Date limite de paiement',
    descriptionEn: 'Payment deadline date'
  },
  {
    tag: '{ETABLISSEMENT}',
    aliases: ['{association_name}', '{short_name}'],
    labelFr: 'Établissement',
    labelEn: 'School Name',
    sampleValue: 'CES Ekali 1',
    descriptionFr: 'Nom ou sigle de l\'établissement scolaire',
    descriptionEn: 'School or APEE identifier'
  },
  {
    tag: '{ELEVES}',
    aliases: ['{student_names}'],
    labelFr: 'Élèves',
    labelEn: 'Students',
    sampleValue: 'Paul (4e)',
    descriptionFr: 'Prénom(s) et classe(s) des enfants rattachés',
    descriptionEn: 'Enrolled children and classroom'
  },
  {
    tag: '{DATE_JOUR}',
    aliases: ['{current_date}'],
    labelFr: 'Date du Jour',
    labelEn: 'Current Date',
    sampleValue: '02/10/2026',
    descriptionFr: 'Date courante au format JJ/MM/AAAA',
    descriptionEn: 'Current date (DD/MM/YYYY)'
  },
  {
    tag: '{ANNEE_SCOLAIRE}',
    aliases: ['{school_year}'],
    labelFr: 'Année Scolaire',
    labelEn: 'School Year',
    sampleValue: '2025/2026',
    descriptionFr: 'Année scolaire en cours',
    descriptionEn: 'Current academic year'
  }
];

export interface SmsPresetTemplate {
  id: string;
  nameFr: string;
  nameEn: string;
  template: string;
  descriptionFr: string;
  descriptionEn: string;
}

export const SMS_PRESET_TEMPLATES: SmsPresetTemplate[] = [
  {
    id: 'standard',
    nameFr: 'Rappel Standard Équilibré',
    nameEn: 'Standard Balanced Reminder',
    template: 'Rappel {NOM_PARENT}: Solde APEE de {MONTANT_DU} a regler avant le {DATE_ECHEANCE}. Merci de regulariser. {ETABLISSEMENT}.',
    descriptionFr: 'Idéal pour les rappels périodiques respectant strictement 160 caractères GSM.',
    descriptionEn: 'Ideal for periodic fee reminders strictly under 160 GSM characters.'
  },
  {
    id: 'court',
    nameFr: 'Modèle Économique Direct',
    nameEn: 'Direct Economic Notice',
    template: '{ETABLISSEMENT}: {NOM_PARENT}, solde restant: {MONTANT_DU}. Echeance: {DATE_ECHEANCE}. Merci de regulariser.',
    descriptionFr: 'Message très court maximisant la marge de sécurité quel que soit le nom du parent.',
    descriptionEn: 'Ultra-short message maximizing safety margin regardless of parent name length.'
  },
  {
    id: 'urgent',
    nameFr: 'Avis Urgent Retard',
    nameEn: 'Urgent Overdue Alert',
    template: 'URGENT {ETABLISSEMENT}: {NOM_PARENT}, cotisation impayee ({MONTANT_DU}). Regularisation requise avant le {DATE_ECHEANCE}.',
    descriptionFr: 'Pour les factures en souffrance ou en retard critique.',
    descriptionEn: 'For critically overdue tuition fees.'
  }
];

/**
 * Analyse le texte d'un SMS et détermine son encodage réel (GSM-7 ou UCS-2),
 * ainsi que le nombre de segments qui seront facturés par l'opérateur.
 */
export function analyzeSms(text: string): SmsEncodingAnalysis {
  if (!text) {
    return {
      encoding: 'GSM-7',
      isGsm7: true,
      length: 0,
      gsmLength: 0,
      segments: 0,
      maxPerSingleSms: 160,
      maxPerMultiSegment: 153,
      charsRemainingInCurrentSegment: 160,
      nonGsmCharacters: [],
      extendedCharactersCount: 0
    };
  }

  // Détection des caractères hors GSM-7 (ex: ç, ê, â, î, ô, û, œ)
  const nonGsmSet = new Set<string>();
  for (const char of text) {
    if (!GSM_7_REGEX.test(char)) {
      nonGsmSet.add(char);
    }
  }

  const isGsm7 = nonGsmSet.size === 0;
  const length = text.length;

  // Calcul du surcoût des caractères d'extension GSM (chacun compte double)
  const extendedMatches = text.match(GSM_EXTENDED_REGEX);
  const extendedCharactersCount = extendedMatches ? extendedMatches.length : 0;

  if (isGsm7) {
    // GSM-7 Standard : 160 caractères pour le 1er SMS, 153 par segment pour les SMS multiples
    const effectiveGsmLength = length + extendedCharactersCount;
    const maxSingle = 160;
    const maxMulti = 153;
    const segments = effectiveGsmLength <= maxSingle ? (effectiveGsmLength === 0 ? 0 : 1) : Math.ceil(effectiveGsmLength / maxMulti);
    const charsRemaining = effectiveGsmLength <= maxSingle 
      ? maxSingle - effectiveGsmLength 
      : (segments * maxMulti) - effectiveGsmLength;

    return {
      encoding: 'GSM-7',
      isGsm7: true,
      length,
      gsmLength: effectiveGsmLength,
      segments,
      maxPerSingleSms: maxSingle,
      maxPerMultiSegment: maxMulti,
      charsRemainingInCurrentSegment: Math.max(0, charsRemaining),
      nonGsmCharacters: [],
      extendedCharactersCount
    };
  } else {
    // UCS-2 (Unicode UTF-16) : 70 caractères pour le 1er SMS, 67 par segment pour les SMS multiples
    const maxSingle = 70;
    const maxMulti = 67;
    const segments = length <= maxSingle ? (length === 0 ? 0 : 1) : Math.ceil(length / maxMulti);
    const charsRemaining = length <= maxSingle 
      ? maxSingle - length 
      : (segments * maxMulti) - length;

    return {
      encoding: 'UCS-2 (Unicode)',
      isGsm7: false,
      length,
      gsmLength: length,
      segments,
      maxPerSingleSms: maxSingle,
      maxPerMultiSegment: maxMulti,
      charsRemainingInCurrentSegment: Math.max(0, charsRemaining),
      nonGsmCharacters: Array.from(nonGsmSet),
      extendedCharactersCount
    };
  }
}

/**
 * Simule le remplacement des variables dynamiques dans un template SMS
 * avec des données d'exemple ou réelles.
 */
export function simulateSmsMessage(
  template: string, 
  customValues?: Record<string, string>
): {
  simulatedText: string;
  rawAnalysis: SmsEncodingAnalysis;
  simulatedAnalysis: SmsEncodingAnalysis;
  isWithin160Limit: boolean;
  isValidSingleGsm: boolean;
  usedVariables: string[];
} {
  if (!template) {
    const emptyAnalysis = analyzeSms('');
    return {
      simulatedText: '',
      rawAnalysis: emptyAnalysis,
      simulatedAnalysis: emptyAnalysis,
      isWithin160Limit: true,
      isValidSingleGsm: true,
      usedVariables: []
    };
  }

  const rawAnalysis = analyzeSms(template);

  // Valeurs de remplacement d'exemple
  const defaultValues: Record<string, string> = {
    '{NOM_PARENT}': 'M. Martin BENE',
    '{parent_name}': 'M. Martin BENE',
    '{MONTANT_DU}': '25 000 FCFA',
    '{remaining_amount}': '25 000 FCFA',
    '{total_due_amount}': '50 000 FCFA',
    '{DATE_ECHEANCE}': '15/10/2026',
    '{due_date}': '15/10/2026',
    '{ETABLISSEMENT}': 'CES Ekali 1',
    '{association_name}': 'CES Ekali 1',
    '{short_name}': 'CES Ekali 1',
    '{ELEVES}': 'Paul (4e)',
    '{student_names}': 'Paul (4e)',
    '{DATE_JOUR}': new Date().toLocaleDateString('fr-FR'),
    '{current_date}': new Date().toLocaleDateString('fr-FR'),
    '{ANNEE_SCOLAIRE}': '2025/2026',
    '{school_year}': '2025/2026',
    ...(customValues || {})
  };

  let simulatedText = template;
  const usedVariables: string[] = [];

  // Remplacer toutes les balises trouvées
  for (const [tag, val] of Object.entries(defaultValues)) {
    if (simulatedText.includes(tag)) {
      usedVariables.push(tag);
      simulatedText = simulatedText.split(tag).join(val);
    }
  }

  // Supporte également les balises écrites en minuscules ou majuscules ({nom_parent}, {montant_du}, etc.)
  simulatedText = simulatedText
    .replace(/{nom_parent}/gi, defaultValues['{NOM_PARENT}'])
    .replace(/{montant_du}/gi, defaultValues['{MONTANT_DU}'])
    .replace(/{date_echeance}/gi, defaultValues['{DATE_ECHEANCE}'])
    .replace(/{etablissement}/gi, defaultValues['{ETABLISSEMENT}'])
    .replace(/{eleves}/gi, defaultValues['{ELEVES}'])
    .replace(/{date_jour}/gi, defaultValues['{DATE_JOUR}'])
    .replace(/{annee_scolaire}/gi, defaultValues['{ANNEE_SCOLAIRE}']);

  const simulatedAnalysis = analyzeSms(simulatedText);
  const isValidSingleGsm = simulatedAnalysis.isGsm7 && simulatedAnalysis.gsmLength <= 160;
  const isWithin160Limit = simulatedAnalysis.gsmLength <= 160;

  return {
    simulatedText,
    rawAnalysis,
    simulatedAnalysis,
    isWithin160Limit,
    isValidSingleGsm,
    usedVariables: Array.from(new Set(usedVariables))
  };
}

/**
 * Valide un modèle de SMS pour s'assurer qu'il respecte les contraintes GSM (160 caractères max).
 */
export function validateSmsTemplate(template: string, customValues?: Record<string, string>): {
  isValid: boolean;
  error?: string;
  warning?: string;
  simulatedLength: number;
  simulatedGsmCount: number;
  isGsm7: boolean;
  nonGsmChars: string[];
} {
  if (!template || !template.trim()) {
    return {
      isValid: false,
      error: 'Le modèle de message SMS ne peut pas être vide.',
      simulatedLength: 0,
      simulatedGsmCount: 0,
      isGsm7: true,
      nonGsmChars: []
    };
  }

  const simulation = simulateSmsMessage(template, customValues);
  const { simulatedAnalysis } = simulation;

  if (!simulatedAnalysis.isGsm7) {
    return {
      isValid: false,
      error: `Le modèle contient des caractères incompatibles GSM-7 (${simulatedAnalysis.nonGsmCharacters.join(', ')}). Cela force l'encodage UCS-2 et réduit la limite à 70 caractères par SMS.`,
      simulatedLength: simulatedAnalysis.length,
      simulatedGsmCount: simulatedAnalysis.gsmLength,
      isGsm7: false,
      nonGsmChars: simulatedAnalysis.nonGsmCharacters
    };
  }

  if (simulatedAnalysis.gsmLength > 160) {
    return {
      isValid: false,
      error: `La longueur estimée du SMS (${simulatedAnalysis.gsmLength} caractères GSM) dépasse la limite légale de 160 caractères pour un SMS unique (${simulatedAnalysis.segments} SMS seront facturés). Veuillez raccourcir le texte.`,
      simulatedLength: simulatedAnalysis.length,
      simulatedGsmCount: simulatedAnalysis.gsmLength,
      isGsm7: true,
      nonGsmChars: []
    };
  }

  let warning: string | undefined = undefined;
  if (simulatedAnalysis.gsmLength > 145) {
    warning = `Attention : La longueur estimée (${simulatedAnalysis.gsmLength}/160) est très proche du seuil critique. Si un nom de parent est très long, le message pourrait basculer sur 2 segments.`;
  }

  return {
    isValid: true,
    warning,
    simulatedLength: simulatedAnalysis.length,
    simulatedGsmCount: simulatedAnalysis.gsmLength,
    isGsm7: true,
    nonGsmChars: []
  };
}

/**
 * Optimise un texte contenant des accents français pour le standard GSM-7 (160 car./SMS)
 * en remplaçant uniquement les caractères non-GSM7 par des équivalents lisibles.
 * Ex : 'ç' -> 'c', 'ê' -> 'e', 'â' -> 'a', etc.
 * Les caractères 'é', 'è', 'à' qui sont DÉJÀ en GSM-7 sont scrupuleusement conservés.
 */
export function optimizeToGsm7(text: string): string {
  if (!text) return text;
  
  return text
    // 'ç' minuscule -> 'c' (car seul le 'Ç' majuscule est dans le GSM-7 standard)
    .replace(/ç/g, 'c')
    // Circonflexes et trémas (hors GSM-7)
    .replace(/[êë]/g, 'e')
    .replace(/[ÊË]/g, 'E')
    .replace(/[âä]/g, 'a')
    .replace(/[ÂÄ]/g, 'A')
    .replace(/[îï]/g, 'i')
    .replace(/[ÎÏ]/g, 'I')
    .replace(/[ôö]/g, 'o')
    .replace(/[ÔÖ]/g, 'O')
    .replace(/[ûü]/g, 'u')
    .replace(/[ÛÜ]/g, 'U')
    // Ligatures
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    // Apostrophes typographiques
    .replace(/[’‘`]/g, "'")
    // Guillemets français
    .replace(/[«»]/g, '"');
}
