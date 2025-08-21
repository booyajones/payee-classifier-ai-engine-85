export function getEnvVar(key: string, defaultValue: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}
