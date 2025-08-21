import { getEnvVar } from '../utils/env';

const DEFAULT_ORIGINAL_FILE_DATA_LIMIT = 1000;
const envLimit = parseInt(getEnvVar('ORIGINAL_FILE_DATA_LIMIT', String(DEFAULT_ORIGINAL_FILE_DATA_LIMIT)), 10);
export const ORIGINAL_FILE_DATA_LIMIT = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_ORIGINAL_FILE_DATA_LIMIT;
