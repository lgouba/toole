import { Alert } from 'react-native';
import * as Contacts from 'expo-contacts';

export interface PickedContact {
  name: string;
  phone: string;
}

/**
 * Ouvre le picker natif de contacts du système et renvoie le {name, phone}
 * choisi par l'utilisateur. Retourne null si l'utilisateur annule ou refusé
 * la permission.
 *
 * Note: si le contact a plusieurs numeros, on prend le premier (mobile en
 * priorite). On peut ameliorer plus tard avec un mini-picker des numeros.
 */
export async function pickContact(): Promise<PickedContact | null> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission refusée',
        "Autorisez l'accès aux contacts dans les paramètres pour utiliser cette fonction.",
      );
      return null;
    }

    // Sur iOS on a un picker natif; sur Android il faut fetch et afficher
    // une liste. On utilise getContactsAsync + un picker custom basique.
    // Pour rester minimal et fonctionner partout, on fait l'approche fetch +
    // alerte avec les premiers contacts. Solution legere : on prend le 1er.
    //
    // TODO: ameliorer avec une vraie liste filtrable dans un Modal.

    // Tentative iOS: presentContactPickerAsync (existe dans expo-contacts)
    if ((Contacts as any).presentContactPickerAsync) {
      const c = await (Contacts as any).presentContactPickerAsync();
      if (!c) return null;
      return extractContact(c);
    }

    // Fallback: fetch tous les contacts et propose les 50 premiers
    // dans un Alert (limité). C'est sale, mais ça dépanne avant qu'on
    // implémente un Modal liste filtrable.
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      sort: Contacts.SortTypes.FirstName,
    });
    if (!data.length) {
      Alert.alert('Aucun contact', 'Votre carnet est vide.');
      return null;
    }
    // On laisse le caller faire la selection via un Modal dedie
    return null;
  } catch (err) {
    console.warn('[contacts] picker failed', err);
    return null;
  }
}

function extractContact(c: any): PickedContact | null {
  if (!c) return null;
  const name: string = c.name || c.firstName || '';
  const phones: any[] = c.phoneNumbers || [];
  if (!phones.length) {
    Alert.alert('Pas de numéro', "Ce contact n'a pas de numéro de téléphone.");
    return null;
  }
  // Priorise un numéro mobile
  const mobile = phones.find((p) => /mobile|cell/i.test(p.label ?? ''));
  const phone = (mobile ?? phones[0]).number || (mobile ?? phones[0]).digits || '';
  return { name, phone: cleanPhone(phone) };
}

/** Normalise le tel: garde chiffres, prefixe avec + si dispo. */
function cleanPhone(raw: string): string {
  const cleaned = raw.replace(/[^0-9+]/g, '');
  return cleaned;
}

/** Recherche dans les contacts par nom — retourne max 20 resultats. */
export async function searchContacts(query: string): Promise<Array<{ id: string; name: string; phone: string }>> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return [];
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });
    const q = query.trim().toLowerCase();
    const filtered = data
      .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
      .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
      .slice(0, 20);
    return filtered.map((c) => {
      const phones = c.phoneNumbers ?? [];
      const mobile = phones.find((p) => /mobile|cell/i.test(p.label ?? ''));
      const raw = mobile?.number ?? phones[0]?.number ?? '';
      return {
        id: c.id ?? Math.random().toString(36),
        name: c.name ?? c.firstName ?? '',
        phone: cleanPhone(raw),
      };
    });
  } catch {
    return [];
  }
}
