export const secretFreeString = (value: unknown, secrets: readonly string[]): boolean => {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '')
  return secrets.every((secret) => secret.length === 0 || !text.includes(secret))
}
