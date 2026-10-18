export function readFileDataUrl(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = (): void => { reader.abort(); fail(new Error('File reading was cancelled.')); };
    const finish = (): void => signal?.removeEventListener('abort', abort);
    const fail = (error: Error): void => { finish(); reject(error); };
    if (signal?.aborted) { fail(new Error('File reading was cancelled.')); return; }
    signal?.addEventListener('abort', abort, {once: true});
    reader.onload = () => {
      finish();
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The file could not be read.'));
    };
    reader.onerror = () => fail(reader.error || new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}
