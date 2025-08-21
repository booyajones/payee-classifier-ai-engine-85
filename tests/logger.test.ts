import { describe, it, expect, afterEach, vi } from 'vitest';
import { logger, setLogLevel } from '@/lib/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('info');
  });

  it('toggles verbosity based on log level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setLogLevel('warn');
    logger.info('hidden');
    logger.warn('shown');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
