import { LEGAL_SUFFIXES, BUSINESS_KEYWORDS, PROFESSIONAL_TITLES } from './config';

/**
 * Extended list of global legal suffixes for ultra-fast business detection
 * Includes international legal entity types
 */
export const EXTENDED_LEGAL_SUFFIXES = [
  ...LEGAL_SUFFIXES,
  // Additional international suffixes
  "GMBH", "AG", "KG", "OHG", "E.V.", "SARL", "S.A.", "N.V.", "B.V.",
  "PTY", "PTE", "LDA", "OOO", "ZAO", "A.Ş.", "S.P.A.", "S.R.L.",
  "有限公司", "株式会社", "주식회사", "บริษัท", "ВООО", "ООО", "ЗАО"
];

/**
 * Extended business keywords for identifying organizations
 */
export const EXTENDED_BUSINESS_KEYWORDS = [
  ...BUSINESS_KEYWORDS,
  "ENTERPRISES", "HOLDINGS", "CORPORATION", "WORLDWIDE", "INTERNATIONAL",
  "MANUFACTURING", "LOGISTICS", "CONSULTING", "SERVICES", "SOLUTIONS",
  "PARTNERS", "STUDIO", "STUDIOS", "AGENCY", "BANCORP", "BANK", "CAPITAL",
  "FOODS", "GROUP", "BRANDS", "NETWORK", "NETWORKS", "INSTITUTE", "COUNCIL",
  "ASSOCIATION", "FEDERATION", "LABORATORIES", "PHARMA", "CLUB", "SOCIETY",
  "COMMITTEE", "CENTER", "CENTRE", "AUTHORITY", "COMMISSION", "BOARD",
  "BUREAU", "DEPARTMENT", "MINISTRY", "DIVISION", "RESTAURANT", "CAFÉ",
  "HOTEL", "SHOP", "STORE", "MARKET", "OUTLET", "MALL", "CENTER", "FOUNDATION",
  "THEATER", "THEATRE", "GALLERY", "MUSEUM", "UNIVERSITY", "COLLEGE", "SCHOOL"
];

/**
 * Multi-cultural first names set for improved individual detection
 * To be used with a Trie data structure for O(1) lookups
 */
export const COMMON_FIRST_NAMES = new Set([
  // English first names
  "JAMES", "JOHN", "ROBERT", "MICHAEL", "WILLIAM", "DAVID", "RICHARD", "JOSEPH", "THOMAS", "CHARLES",
  "MARY", "PATRICIA", "LINDA", "BARBARA", "ELIZABETH", "JENNIFER", "MARIA", "SUSAN", "MARGARET", "DOROTHY",
  
  // Spanish first names
  "JOSE", "JUAN", "FRANCISCO", "ANTONIO", "MANUEL", "PEDRO", "LUIS", "JORGE", "MIGUEL", "CARLOS",
  "MARIA", "ANA", "CARMEN", "JOSEFA", "ISABEL", "DOLORES", "PILAR", "TERESA", "ROSA", "ANGELES",
  
  // French first names
  "JEAN", "PIERRE", "MICHEL", "JACQUES", "ANDRE", "PHILIPPE", "RENE", "LOUIS", "ALAIN", "BERNARD",
  "MARIE", "JEANNE", "FRANCOISE", "MONIQUE", "CATHERINE", "NICOLE", "JACQUELINE", "ANNE", "SYLVIE", "SUZANNE",
  
  // German first names
  "HANS", "PETER", "MICHAEL", "THOMAS", "KLAUS", "WOLFGANG", "JURGEN", "GUNTHER", "DIETER", "HORST",
  "MARIA", "URSULA", "HELGA", "ANNA", "RENATE", "MONIKA", "KARIN", "INGRID", "ERIKA", "ELISABETH",
  
  // Chinese first names (romanized)
  "WEI", "LEI", "YI", "MIN", "NA", "HONG", "XIAO", "LAN", "HUAN", "YONG",
  "JUN", "CHAO", "HUI", "PING", "GANG", "MING", "HUA", "JIAN", "JING", "XIONG",
  
  // Japanese first names (romanized)
  "TARO", "JIRO", "AKIRA", "TAKASHI", "DAIKI", "YUKI", "NAOKI", "HIROSHI", "KENJI", "TAKUMI",
  "YOKO", "YUMI", "NAOMI", "ETSUKO", "KAZUKO", "AKIKO", "YUMIKO", "MARIKO", "HANAKO", "AYUMI",
  
  // Indian first names
  "AMIT", "RAHUL", "VIJAY", "SANJAY", "RAJESH", "SUNIL", "ANIL", "AJAY", "SURESH", "RAMESH",
  "NEHA", "ANJALI", "POOJA", "PRIYA", "SUNITA", "ANITA", "REKHA", "NEETU", "MEENA", "GEETA",
  
  // Arabic first names
  "MOHAMED", "AHMED", "MAHMOUD", "ALI", "HASSAN", "HUSSEIN", "OMAR", "ABDULLAH", "KHALED", "IBRAHIM",
  "FATIMA", "AISHA", "MONA", "AMINA", "LAYLA", "ZAINAB", "SALMA", "NOURA", "HUDA", "SAMIRA"
]);

/**
 * Multi-cultural last names set for improved individual detection
 */
export const COMMON_LAST_NAMES = new Set([
  // English surnames
  "SMITH", "JOHNSON", "WILLIAMS", "BROWN", "JONES", "MILLER", "DAVIS", "GARCIA", "RODRIGUEZ", "WILSON",
  "MARTINEZ", "ANDERSON", "TAYLOR", "THOMAS", "HERNANDEZ", "MOORE", "MARTIN", "JACKSON", "THOMPSON", "WHITE",
  
  // Spanish surnames
  "GARCIA", "RODRIGUEZ", "GONZALEZ", "FERNANDEZ", "LOPEZ", "MARTINEZ", "SANCHEZ", "PEREZ", "GOMEZ", "MARTIN",
  
  // French surnames
  "MARTIN", "BERNARD", "THOMAS", "PETIT", "ROBERT", "RICHARD", "DURAND", "DUBOIS", "MOREAU", "LAURENT",
  
  // German surnames
  "MÜLLER", "SCHMIDT", "SCHNEIDER", "FISCHER", "WEBER", "MEYER", "WAGNER", "BECKER", "SCHULZ", "HOFFMANN",
  "MULLER", "SCHULTZ", // Non-umlaut versions
  
  // Chinese surnames (romanized)
  "LI", "WANG", "ZHANG", "LIU", "CHEN", "YANG", "HUANG", "ZHAO", "WU", "ZHOU",
  
  // Japanese surnames (romanized)
  "SATO", "SUZUKI", "TAKAHASHI", "TANAKA", "WATANABE", "ITO", "YAMAMOTO", "NAKAMURA", "KOBAYASHI", "KATO",
  
  // Indian surnames
  "SHARMA", "SINGH", "KUMAR", "RAO", "REDDY", "PATEL", "JAIN", "SHAH", "VERMA", "MEHTA",
  
  // Arabic surnames
  "MOHAMMED", "AL-SAID", "AL-HASSAN", "AL-AHMED", "AL-ALI", "AL-OMAR", "AL-ABDULLAH", "AL-KHALED", "AL-IBRAHIM", "AL-MAHMOUD"
]);

/**
 * Government entities prefixes and patterns for detecting public sector organizations
 */
export const EXTENDED_GOVERNMENT_PATTERNS = [
  // US Government patterns
  "CITY OF", "COUNTY OF", "STATE OF", "UNITED STATES", "U.S.", "US", "FEDERAL", "DEPARTMENT OF", 
  "OFFICE OF", "BUREAU OF", "AGENCY", "COMMISSION", "AUTHORITY", "DISTRICT", "BOARD OF", 
  "ADMINISTRATION", "DIVISION OF", "COMMITTEE",
  
  // International government patterns
  "COUNCIL", "MINISTRY OF", "NATIONAL", "ROYAL", "HER MAJESTY", "COMMONWEALTH", "REPUBLIC OF",
  "GOVERNMENT OF", "FEDERAL", "PROVINCIAL", "MUNICIPAL", "PARLAMENT", "ASSEMBLY",
  
  // Educational institutions
  "UNIVERSITY OF", "COLLEGE OF", "SCHOOL DISTRICT", "PUBLIC SCHOOL", "ACADEMY OF",
  
  // Healthcare institutions
  "HOSPITAL", "MEDICAL CENTER", "HEALTH DEPARTMENT", "CLINIC", "CENTER FOR"
];

/**
 * Cultural titles collection for improved individual detection
 * Includes honorifics from multiple cultures
 */
export const EXTENDED_PROFESSIONAL_TITLES = [
  ...PROFESSIONAL_TITLES,
  // Additional professional titles
  "ATTY", "JUDGE", "HON", "REV", "PASTOR", "FATHER", "SISTER", "BROTHER", "RABBI", "IMAM",
  "SHEIKH", "COLONEL", "CAPTAIN", "LIEUTENANT", "GENERAL", "MAJOR", "ADMIRAL", "COMMANDER",
  "SERGEANT", "CPT", "LT", "GEN", "SGT", "MAJ", "ADM", "CMDR",
  
  // Non-English titles
  "HERR", "FRAU", "FRAULEIN", "MONSIEUR", "MADAME", "MADEMOISELLE", "SENOR", "SENORA", "SENORITA",
  "SIGNOR", "SIGNORA", "SIGNORINA", "SENHOR", "SENHORA"
];

/**
 * Patterns for detecting personal name structures
 */
export const PERSONAL_NAME_PATTERNS = [
  /^[A-Za-z]+\s+[A-Za-z]+$/,                         // First Last
  /^[A-Za-z]+\s+[A-Za-z]\s+[A-Za-z]+$/,              // First Middle Last
  /^[A-Za-z]+\s+[A-Za-z]\.\s+[A-Za-z]+$/,            // First M. Last
  /^[A-Za-z]+,\s*[A-Za-z]+$/,                        // Last, First
  /^[A-Za-z]+,\s*[A-Za-z]+\s+[A-Za-z]$/,             // Last, First Middle
  /^[A-Za-z]+,\s*[A-Za-z]+\s+[A-Za-z]\.$/,           // Last, First M.
  /^[A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+$/,             // First Middle Last
  /^[A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+$/, // First Middle Middle Last
  /^[A-Za-z]+\s+[A-Za-z]+-[A-Za-z]+$/                // First Hyphenated-Last
];

/**
 * Setup for fast string normalization
 * Applies UTF-8 normalization and removes emoji/punctuation
 */
export function normalizeText(text: string): string {
  // Convert to uppercase for consistent matching
  text = text.toUpperCase();
  
  // Normalize UTF-8
  text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Replace consecutive spaces, tabs, etc with a single space
  text = text.replace(/\s+/g, " ").trim();
  
  return text;
}

/**
 * Extended rule-based detection for businesses
 * Implements the ultra-fast regex gate as described in spec
 */
export function detectBusinessByExtendedRules(payeeName: string): { isMatch: boolean; rules: string[] } {
  const name = normalizeText(payeeName);
  const rules: string[] = [];

  // Single-word capitalized names (likely business names)
  if (/^[A-Z]{2,}$/.test(payeeName)) {
    rules.push('All-caps single word (business identifier)');
  }

  // Check for business indicators in the name
  const businessIndicators = [
    { pattern: /\b(LLC|INC|CORP|LTD|CO|LP|LLP|PC|PLC|GMBH|SA|AG|PTY|LIMITED|INCORPORATED|COMPANY|CORPORATION)\b/i, rule: 'Legal suffix' },
    { pattern: /\b(SERVICES|SOLUTIONS|SYSTEMS|INDUSTRIES|ENTERPRISES|ASSOCIATES|CONSULTANTS|GROUP|AGENCY|STUDIOS|PARTNERS)\b/i, rule: 'Business suffix' },
    { pattern: /\b(GLOBAL|INTERNATIONAL|WORLDWIDE|NATIONAL|REGIONAL|LOCAL)\b/i, rule: 'Geographic scope indicator' },
    { pattern: /\b(POOL|POOLS|MAINTENANCE|GAS|PROPANE|HVAC|TRAVEL|PRO|DESIGNS|PLANNERS|EVENTS|DISTRIBUTORS|ENTERTAINMENT|SURFACE|HOTEL|IMAGE|BAKERY|RESTAURANT|CAFE|GRAPHICS|CREATIVE|MECHANICAL)\b/i, rule: 'Industry/service term' },
    { pattern: /\b(AIR|DELTA|AMERICAN|ADVANCED|EXPERT|CLEAN|CRUISE|CURATED|FLORAL)\b/i, rule: 'Business descriptor' },
    { pattern: /\b(AT|BY)\b/i, rule: 'Business relationship term' },
      { pattern: /&/i, rule: 'Ampersand (common in business names)' },
    { pattern: /\//i, rule: 'Forward slash (common in business partnerships)' }
  ];

  // Check each business indicator
  businessIndicators.forEach(({ pattern, rule }) => {
    if (pattern.test(name) && !rules.includes(rule)) {
      rules.push(rule);
    }
  });

  // Two or more capitalized words (likely business names)
  if (/^([A-Z][a-z]+\s+){1,}[A-Z][a-z]+$/.test(payeeName)) {
    rules.push('Multi-word capitalized name (likely business)');
  }

  return {
    isMatch: rules.length > 0,
    rules,
  };
}

/**
 * Extended individual detection using multicultural first/last name sets
 * Implements the ultra-fast name trie as described in spec
 */
export function detectIndividualByExtendedRules(payeeName: string): { isMatch: boolean; rules: string[] } {
  const normalizedName = normalizeText(payeeName);
  const matchingRules: string[] = [];
  
  // Check for professional titles
  for (const title of EXTENDED_PROFESSIONAL_TITLES) {
    const titleRegex = new RegExp(`\\b${title}\\b|\\b${title}[.,]`, 'i');
    if (titleRegex.test(normalizedName)) {
      matchingRules.push(`Professional title: ${title}`);
      break;
    }
  }
  
  // Check for common name patterns using regex
  for (const pattern of PERSONAL_NAME_PATTERNS) {
    if (pattern.test(payeeName)) {
      matchingRules.push("Individual name pattern detected");
      break;
    }
  }
  
  // Check for first name + last name pattern
  const words = normalizedName.split(/\s+/);
  if (words.length >= 2) {
    const potentialFirstName = words[0];
    const potentialLastName = words[words.length - 1];
    
    // O(1) lookups in Sets
    if (COMMON_FIRST_NAMES.has(potentialFirstName) && COMMON_LAST_NAMES.has(potentialLastName)) {
      matchingRules.push(`Common first name (${potentialFirstName}) and last name (${potentialLastName}) detected`);
    }
    else if (COMMON_FIRST_NAMES.has(potentialFirstName)) {
      matchingRules.push(`Common first name detected: ${potentialFirstName}`);
    }
    else if (COMMON_LAST_NAMES.has(potentialLastName)) {
      matchingRules.push(`Common last name detected: ${potentialLastName}`);
    }
  }
  
  // If "Last, First" format (common in databases)
  if (/^[A-Z]+,\s*[A-Z]+$/i.test(payeeName)) {
    const [lastName, firstName] = payeeName.split(",").map(s => s.trim().toUpperCase());
    if (COMMON_LAST_NAMES.has(lastName) && COMMON_FIRST_NAMES.has(firstName)) {
      matchingRules.push(`Database format "Last, First" detected with common names`);
    }
  }
  
  return { isMatch: matchingRules.length > 0, rules: matchingRules };
}

