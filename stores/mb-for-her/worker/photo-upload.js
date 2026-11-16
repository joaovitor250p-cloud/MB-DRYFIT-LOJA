/**
 * Validação de fotos antes de gravar em R2. A autorização do dono é aplicada
 * no roteador /api/upload, antes de chamar esta função.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const json = (value, status) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

function trueImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 12 && [82,73,70,70].every((b, i) => bytes[i] === b) && [87,69,66,80].every((b, i) => bytes[i + 8] === b)) return 'image/webp';
  return null;
}

export async function uploadPhoto(request, bucket) {
  if (!bucket || typeof bucket.put !== 'function') return json({ error: 'Armazenamento de imagens indisponível.' }, 503);
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (!allowed.has(type)) return json({ error: 'Use JPG, PNG ou WebP.' }, 400);
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_PHOTO_BYTES)) {
    return json({ error: 'A foto deve ter até 5 MB.' }, 413);
  }
  if (!request.body) return json({ error: 'Selecione uma foto válida.' }, 400);
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PHOTO_BYTES) {
        await reader.cancel().catch(() => {});
        return json({ error: 'A foto deve ter até 5 MB.' }, 413);
      }
      chunks.push(value);
    }
  } catch {
    return json({ error: 'Não foi possível ler o arquivo. Tente novamente.' }, 400);
  } finally {
    reader.releaseLock();
  }
  if (length === 0) return json({ error: 'A foto está vazia.' }, 400);
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  if (trueImageType(bytes) !== type) {
    return json({ error: 'O conteúdo da imagem não corresponde ao formato informado.' }, 400);
  }
  const key = crypto.randomUUID();
  try {
    await bucket.put('photos/' + key, bytes, { httpMetadata: { contentType: type } });
  } catch {
    return json({ error: 'Falha ao armazenar a imagem. Nenhum produto foi alterado.' }, 503);
  }
  return json({ photo: '/api/photos/' + key }, 200);
}
