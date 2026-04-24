import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
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
 * Compresse et redimensionne l'image a max 1280px de large avec qualite ~0.6.
 * Objectif : chaque photo passe sous 500 Ko pour éviter les 413 (request too
 * large) et accelerer l'upload sur réseau mobile BF.
 */
async function compressImage(localUri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch (err) {
    console.warn('[upload] compression failed, using original', err);
    return localUri;
  }
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
    // Compression prealable : resize + qualite reduite pour passer sous la
    // limite nginx et accelerer l'upload sur réseau mobile.
    const compressedUri = await compressImage(localUri);
    const form = new FormData();

    // On fixe le type mime a JPEG car la compression produit du JPEG
    const mime = 'image/jpeg';
    const name = `photo-${Date.now()}.jpg`;

    // React Native accepte { uri, name, type } dans un FormData (non typé standard)
    const fileDescriptor = {
      uri:
        Platform.OS === 'android'
          ? compressedUri
          : compressedUri.replace('file://', ''),
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
