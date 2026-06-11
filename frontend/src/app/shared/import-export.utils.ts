import { HttpClient } from '@angular/common/http';

/** Download a blob response as a file in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** POST multipart file import; returns JSON summary from API. */
export function postImportFile(
  http: HttpClient,
  url: string,
  file: File
): ReturnType<HttpClient['post']> {
  const fd = new FormData();
  fd.append('file', file);
  return http.post(url, fd);
}
