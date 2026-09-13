export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      result[key] = obj[key];
    }
  }
  return result;
}
