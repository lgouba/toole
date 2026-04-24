import { Alert, Linking, Platform } from 'react-native';

export function openWhatsApp(phone: string, message?: string): void {
  const cleaned = phone.replace(/\D/g, '');
  const encoded = message ? encodeURIComponent(message) : '';
  const url = `whatsapp://send?phone=${cleaned}${encoded ? `&text=${encoded}` : ''}`;
  Linking.openURL(url).catch(() => {
    // Fallback to web WhatsApp
    Linking.openURL(`https://wa.me/${cleaned}${encoded ? `?text=${encoded}` : ''}`);
  });
}

export function openPhone(phone: string): void {
  const cleaned = phone.replace(/\D/g, '');
  Linking.openURL(`tel:${cleaned}`);
}

/**
 * Ouvre un point sur la carte (juste le marqueur, pas la navigation).
 */
export function openMaps(latitude: number, longitude: number, label?: string): void {
  const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
  const url =
    Platform.OS === 'ios'
      ? `${scheme}?q=${label || 'Position'}&ll=${latitude},${longitude}`
      : `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${label || 'Position'})`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
  });
}

/**
 * Ouvre l'itinéraire turn-by-turn vers une destination GPS dans l'app de
 * navigation de l'utilisateur. Propose un choix entre Google Maps et Waze
 * s'ils sont installes, sinon fallback Google Maps web.
 */
export async function openNavigation(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<void> {
  const labelEncoded = encodeURIComponent(label || 'Destination');

  // URLs natives pour chaque app
  const googleMapsUrl =
    Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`
      : `google.navigation:q=${latitude},${longitude}&mode=d`;
  const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;
  // Fallback cross-platform (ouvre dans le navigateur ou l'app par defaut du systeme)
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving&destination_name=${labelEncoded}`;

  // Vérifié quelles apps sont installees
  const [hasGoogle, hasWaze] = await Promise.all([
    Linking.canOpenURL(googleMapsUrl).catch(() => false),
    Linking.canOpenURL(wazeUrl).catch(() => false),
  ]);

  const options: { text: string; url: string }[] = [];
  if (hasGoogle) options.push({ text: 'Google Maps', url: googleMapsUrl });
  if (hasWaze) options.push({ text: 'Waze', url: wazeUrl });

  // Si aucune app n'est installee, on ouvre direct l'URL web
  if (options.length === 0) {
    Linking.openURL(webUrl).catch(() => {});
    return;
  }

  // Si une seule app, pas besoin de demander
  if (options.length === 1) {
    Linking.openURL(options[0].url).catch(() => {
      Linking.openURL(webUrl).catch(() => {});
    });
    return;
  }

  // Plusieurs apps : laisse le choix a l'utilisateur
  Alert.alert(
    'Choisir une application',
    "Avec quelle application voulez-vous démarrer la navigation ?",
    [
      ...options.map((o) => ({
        text: o.text,
        onPress: () => {
          Linking.openURL(o.url).catch(() => {
            Linking.openURL(webUrl).catch(() => {});
          });
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ],
  );
}

export function shareLocationWhatsApp(
  phone: string,
  reference: string,
  latitude: number,
  longitude: number
): void {
  const message = `📦 Tolle - Voici ma position pour la livraison ${reference}: https://maps.google.com/?q=${latitude},${longitude}`;
  openWhatsApp(phone, message);
}
