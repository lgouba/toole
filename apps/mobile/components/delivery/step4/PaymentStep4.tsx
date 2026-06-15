import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step4 as S } from '@/theme/recapTokens';
import { PriceEstimate } from '@/types';
import { formatCFA } from '@/utils/format';
import { PaymentResult } from '@/utils/payment';
import { AmountCard } from './AmountCard';
import { MethodCard } from './MethodCard';
import { MobilePaymentFlow } from './MobilePaymentFlow';

export type PayMethod = 'cash' | 'orange_money' | 'moov_money';

interface Props {
  estimate: PriceEstimate | null;
  method: PayMethod;
  onMethodChange: (m: PayMethod) => void;
  paid: boolean;
  txId?: string;
  onPaid: (r: PaymentResult) => void;
}

export function PaymentStep4({ estimate, method, onMethodChange, paid, txId, onPaid }: Props) {
  const total = estimate?.price ?? 0;

  return (
    <View style={styles.wrap}>
      <AmountCard
        total={total}
        basePrice={estimate?.basePrice ?? 0}
        distancePrice={estimate?.distancePrice ?? 0}
        distanceKm={estimate?.distanceKm ?? 0}
      />

      <Text style={styles.section}>COMMENT RÉGLER ?</Text>

      <View style={{ gap: R.space.sm }}>
        <MethodCard
          variant="cash"
          title="Espèces à la livraison"
          subtitle="Le livreur encaisse à la remise"
          selected={method === 'cash'}
          onPress={() => onMethodChange('cash')}
        />
        <MethodCard
          variant="orange"
          title="Orange Money"
          subtitle="Paiement mobile sécurisé"
          selected={method === 'orange_money'}
          onPress={() => onMethodChange('orange_money')}
        />
        <MethodCard
          variant="moov"
          title="Moov Money"
          subtitle="Paiement mobile sécurisé"
          selected={method === 'moov_money'}
          onPress={() => onMethodChange('moov_money')}
        />
      </View>

      {/* Détail contextuel */}
      {method === 'cash' ? (
        <View style={styles.cashNote}>
          <MaterialIcons name="info-outline" size={18} color={S.cashFg} />
          <Text style={styles.cashText}>
            Prépare l'appoint si possible. Le livreur encaisse {formatCFA(total)} à la remise.
          </Text>
        </View>
      ) : (
        <MobilePaymentFlow
          method={method}
          amountXOF={total}
          paid={paid}
          txId={txId}
          onPaid={onPaid}
        />
      )}

      <View style={styles.reassure}>
        <MaterialIcons name="verified-user" size={15} color={S.textMuted} />
        <Text style={styles.reassureText}>Paiement sécurisé · aucune donnée bancaire stockée.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.md, paddingTop: 2 },
  section: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: S.textMuted,
    marginTop: R.space.xs,
  },
  cashNote: {
    flexDirection: 'row',
    gap: R.space.sm,
    alignItems: 'flex-start',
    backgroundColor: S.cashBg,
    borderRadius: S.radius.method,
    padding: R.space.lg,
  },
  cashText: { flex: 1, fontFamily: R.font.body, fontSize: 13, color: S.textPrim, lineHeight: 18 },
  reassure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: R.space.xs },
  reassureText: { fontFamily: R.font.body, fontSize: 11.5, color: S.textMuted },
});
