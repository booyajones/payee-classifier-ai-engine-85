
import { BatchProcessingResult, PayeeClassification } from '../../types';

export interface ExportRow {
  [key: string]: any;
  'AI_Classification'?: string;
  'AI_Confidence_%'?: number;
  'AI_Processing_Tier'?: string;
  'AI_Reasoning'?: string;
  'AI_Processing_Method'?: string;
  'Keyword_Exclusion'?: string;
  'Matched_Keywords'?: string;
  'Keyword_Confidence_%'?: number;
  'Keyword_Reasoning'?: string;
  'Matching_Rules'?: string;
  'Similarity_Scores'?: string;
  'Classification_Timestamp'?: string;
  'Processing_Row_Index'?: number;
  'Data_Alignment_Status'?: string;
}

export interface ExportOptions {
  includeAllColumns?: boolean;
  addTimestamp?: boolean;
  customPrefix?: string;
}

export interface ExportContext {
  batchResult: BatchProcessingResult;
  options: ExportOptions;
  resultsMap: Map<number, PayeeClassification>;
}
