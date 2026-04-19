import { Platform } from 'react-native';
import { API_BASE_URL } from '@/config/api';
import { tokenStorage } from './api.client';

export type UploadCategory = 'avatars' | 'packages' | 'kyc';

export interface UploadResult {
  url: string; // chemin relatif type "/uploads/packages/xxx.jpg"
  fullUrl: string; // URL absolue (ex: https://api.../uploads/...)
  filename: string;
  size: number;
}

/**
 * Upload un fichier local vers le backend.
 * Utilise fetch avec FormData (compatible Expo + React Native).
 */
export async function uploadImage(
  localUri: string,
  category: UploadCategory,
): Promise<UploadResult | null> {
  try {
    const token = await tokenStorage.getAccessToken();
    const form = new FormData();

    // On devine le type mime depuis l'extension
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mime =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const name = `photo-${Date.now()}.${ext}`;

    // React Native accepte { uri, name, type } dans un FormData (non typé standard)
    const fileDescriptor = {
      uri: Platform.OS === 'android' ? localUri : localUri.replace('file://', ''),
      name,
      type: mime,
    } as unknown as Blob;
    form.append('file', fileDescriptor);

    const res = await fetch(`${API_BASE_URL}/api/uploads/${category}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        // Ne PAS mettre Content-Type: fetch definit automatiquement le boundary
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log('[upload] failed', res.status, text);
      return null;
    }

    const json = (await res.json()) as {
      data: { url: string; filename: string; size: number };
    };
    const relativeUrl = json.data.url;
    return {
      url: relativeUrl,
      fullUrl: `${API_BASE_URL}${relativeUrl}`,
      filename: json.data.filename,
      size: json.data.size,
    };
  } catch (err) {
    console.log('[upload] exception', err);
    return null;
  }
}

/**
 * Convertit une URL relative en URL absolue (pour l'affichage Image).
 */
export function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE_URL}${url}`;
  return url; // file:// ou autre
}
