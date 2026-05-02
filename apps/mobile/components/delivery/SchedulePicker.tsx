import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useSettingsStore } from '@/stores/settings.store';

interface SchedulePickerProps {
  /** ISO datetime ou undefined */
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  /**
   * Notifie le parent de l'etat du toggle "Programmer". Permet au parent de
   * detecter le cas "toggle on mais date invalide" et de bloquer la soumission.
   */
  onEnabledChange?: (enabled: boolean) => void;
}

/**
 * Composant léger pour programmer une livraison : toggle + inputs date/heure.
 * Pas de DateTimePicker natif pour éviter une dépendance supplémentaire;
 * inputs texte HH/MM/JJ/MM/AAAA avec validation côté client.
 */
export function SchedulePicker({
  value,
  onChange,
  onEnabledChange,
}: SchedulePickerProps) {
  // Delai min pilote par l'admin (settings.operations.scheduledMinDelayMinutes)
  const minDelayMinutes = useSettingsStore(
    (s) => s.settings.operations.scheduledMinDelayMinutes,
  );

  const initialDate = useMemo(() => {
    if (value) return new Date(value);
    // Par defaut: minDelay + 5 min de marge (suffisant pour passer la
    // validation et donner une marge au cron qui scan toutes les 60s)
    const d = new Date();
    d.setMinutes(d.getMinutes() + minDelayMinutes + 5, 0, 0);
    return d;
  }, [value, minDelayMinutes]);

  const [enabled, setEnabled] = useState(!!value);
  const [day, setDay] = useState(String(initialDate.getDate()).padStart(2, '0'));
  const [month, setMonth] = useState(
    String(initialDate.getMonth() + 1).padStart(2, '0'),
  );
  const [year, setYear] = useState(String(initialDate.getFullYear()));
  const [hour, setHour] = useState(String(initialDate.getHours()).padStart(2, '0'));
  const [minute, setMinute] = useState(
    String(initialDate.getMinutes()).padStart(2, '0'),
  );
  const [error, setError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const minuteRef = useRef<TextInput>(null);

  const applyIfValid = (
    d = day,
    mo = month,
    y = year,
    h = hour,
    mi = minute,
    overrideEnabled?: boolean,
  ) => {
    const isOn = overrideEnabled ?? enabled;
    if (!isOn) {
      onChange(undefined);
      setError(null);
      return;
    }
    const dN = parseInt(d, 10);
    const moN = parseInt(mo, 10);
    const yN = parseInt(y, 10);
    const hN = parseInt(h, 10);
    const miN = parseInt(mi, 10);
    // Helper: invalide la valeur ET pose un message d'erreur, pour que
    // le client sache pourquoi le bouton "Confirmer" ne se fie pas a sa saisie.
    const reject = (msg: string) => {
      setError(msg);
      onChange(undefined);
    };
    if (!dN || !moN || !yN || isNaN(hN) || isNaN(miN)) {
      onChange(undefined);
      return;
    }
    if (dN < 1 || dN > 31) return reject('Jour invalide');
    if (moN < 1 || moN > 12) return reject('Mois invalide');
    if (hN < 0 || hN > 23) return reject('Heure invalide');
    if (miN < 0 || miN > 59) return reject('Minutes invalides');
    const dt = new Date(yN, moN - 1, dN, hN, miN);
    if (dt.getTime() < Date.now() + minDelayMinutes * 60 * 1000) {
      return reject(
        `La date doit etre dans plus de ${minDelayMinutes} min apres maintenant`,
      );
    }
    setError(null);
    onChange(dt.toISOString());
  };

  const handleToggle = (v: boolean) => {
    setEnabled(v);
    onEnabledChange?.(v);
    if (!v) {
      onChange(undefined);
      setError(null);
    } else {
      // override enabled=true car setState n'est pas encore applique dans cette closure
      applyIfValid(day, month, year, hour, minute, true);
    }
  };

  // Heure actuelle affichee en temps reel pour aider l'utilisateur a choisir
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowStr = useMemo(
    () =>
      now.toLocaleString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [now],
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Programmer la livraison</Text>
            <Text style={styles.hint}>
              {enabled
                ? 'La course sera diffusee aux livreurs au moment choisi'
                : 'Par defaut, recherche immediate'}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {enabled ? (
        <View style={styles.fields}>
          <View style={styles.nowBanner}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.nowText}>Maintenant : {nowStr}</Text>
          </View>
          <Text style={styles.fieldLabel}>Date</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateBox}
              placeholder="JJ"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={day}
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setDay(v);
                if (v.length === 2) monthRef.current?.focus();
                applyIfValid(v);
              }}
            />
            <Text style={styles.sep}>/</Text>
            <TextInput
              ref={monthRef}
              style={styles.dateBox}
              placeholder="MM"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={month}
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setMonth(v);
                if (v.length === 2) yearRef.current?.focus();
                applyIfValid(undefined, v);
              }}
            />
            <Text style={styles.sep}>/</Text>
            <TextInput
              ref={yearRef}
              style={[styles.dateBox, { flex: 1.4 }]}
              placeholder="AAAA"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={4}
              value={year}
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setYear(v);
                applyIfValid(undefined, undefined, v);
              }}
            />
          </View>

          <Text style={styles.fieldLabel}>Heure</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateBox}
              placeholder="HH"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={hour}
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setHour(v);
                if (v.length === 2) minuteRef.current?.focus();
                applyIfValid(undefined, undefined, undefined, v);
              }}
            />
            <Text style={styles.sep}>:</Text>
            <TextInput
              ref={minuteRef}
              style={styles.dateBox}
              placeholder="MM"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={minute}
              onChangeText={(t) => {
                const v = t.replace(/\D/g, '');
                setMinute(v);
                applyIfValid(undefined, undefined, undefined, undefined, v);
              }}
            />
          </View>

          {/* Raccourcis rapides */}
          <View style={styles.quickRow}>
            {[
              { label: 'Dans 1h', mins: 60 },
              { label: 'Dans 2h', mins: 120 },
              { label: 'Ce soir 18h', hour: 18 },
              { label: 'Demain 9h', hour: 9, tomorrow: true },
            ].map((q) => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickBtn}
                onPress={() => {
                  const d = new Date();
                  if ('mins' in q && q.mins) {
                    d.setMinutes(d.getMinutes() + q.mins);
                  } else if ('hour' in q && q.hour != null) {
                    if ('tomorrow' in q && q.tomorrow) d.setDate(d.getDate() + 1);
                    d.setHours(q.hour, 0, 0, 0);
                    if (d.getTime() < Date.now() + minDelayMinutes * 60 * 1000) {
                      d.setDate(d.getDate() + 1);
                    }
                  }
                  setDay(String(d.getDate()).padStart(2, '0'));
                  setMonth(String(d.getMonth() + 1).padStart(2, '0'));
                  setYear(String(d.getFullYear()));
                  setHour(String(d.getHours()).padStart(2, '0'));
                  setMinute(String(d.getMinutes()).padStart(2, '0'));
                  setError(null);
                  onChange(d.toISOString());
                }}
              >
                <Text style={styles.quickLabel}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fields: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateBox: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sep: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  quickBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  quickLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  nowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    alignSelf: 'flex-start',
  },
  nowText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
