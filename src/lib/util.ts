export function isMock(name: 'GEMINI' | 'BRIGHTDATA' | 'CALL' | 'EMBEDDINGS'): boolean {
  return process.env[`MOCK_${name}`] === '1';
}

/** '0044-1772 9035' -> '004417729035'. Null and undefined become ''. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
