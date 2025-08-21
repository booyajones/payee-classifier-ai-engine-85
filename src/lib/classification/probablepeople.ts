import { logger } from '../logger';

// Fallback probablepeople module since the actual package is not available
let loadedModule: any = null;

const loadProbablePeople = async () => {
  if (loadedModule) return loadedModule;
  
  // Since probablepeople package is not available, use fallback only
  logger.warn('Warning: probablepeople package not available, using fallback classification only');
  loadedModule = {
    parse: () => {
      throw new Error('probablepeople not available');
    }
  };
  
  return loadedModule;
};

// Export a wrapper that handles the lazy loading
export const probablepeople = {
  parse: async (name: string) => {
    const pp = await loadProbablePeople();
    return pp.parse(name);
  }
};
