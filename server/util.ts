export const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Converts a snake_case DB row into a plain camelCase object. */
export function camelize(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

/** Escapes % _ \ so user input is matched literally in LIKE ... ESCAPE '\'. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);
