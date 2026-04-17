import { Linking, Platform } from 'react-native';

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

export function openMaps(latitude: number, longitude: number, label?: string): void {
  const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
  const url = Platform.OS === 'ios'
    ? `${scheme}?q=${label || 'Position'}&ll=${latitude},${longitude}`
    : `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${label || 'Position'})`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
  });
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
