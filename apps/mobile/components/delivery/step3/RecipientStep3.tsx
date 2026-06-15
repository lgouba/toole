import React from 'react';
import {
  View,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { recap as R } from '@/theme/recapTokens';
import { PersonCard } from './PersonCard';
import { HeldByOtherToggle } from './HeldByOtherToggle';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  recipientName: string;
  recipientPhone: string;
  onRecipientName: (t: string) => void;
  onRecipientPhone: (n: string) => void;

  heldByOther: boolean;
  onHeldByOther: (b: boolean) => void;

  holderName: string;
  holderPhone: string;
  onHolderName: (t: string) => void;
  onHolderPhone: (n: string) => void;

  /** Ouvre le picker de contacts (géré au niveau de l'écran). */
  onPickContact: (which: 'recipient' | 'holder') => void;
}

/** Étape 3 (destinataire) refondue : carte destinataire + bascule détenteur. */
export function RecipientStep3(props: Props) {
  const toggleHeld = (b: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    props.onHeldByOther(b);
  };

  return (
    <View style={styles.wrap}>
      <PersonCard
        variant="recipient"
        roleLabel="DESTINATAIRE"
        titleLabel="Qui reçoit le colis"
        name={props.recipientName}
        phone={props.recipientPhone}
        onNameChange={props.onRecipientName}
        onPhoneChange={props.onRecipientPhone}
        onPickContact={() => props.onPickContact('recipient')}
        namePlaceholder="Ex : Rasmane Kindo"
      />

      <HeldByOtherToggle value={props.heldByOther} onChange={toggleHeld} />

      {props.heldByOther && (
        <PersonCard
          variant="holder"
          roleLabel="DÉTENTEUR · EXPÉDITEUR"
          titleLabel="Qui détient le colis"
          name={props.holderName}
          phone={props.holderPhone}
          onNameChange={props.onHolderName}
          onPhoneChange={props.onHolderPhone}
          onPickContact={() => props.onPickContact('holder')}
          namePlaceholder="Ex : Awa Sawadogo"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.md, paddingTop: 2 },
});
