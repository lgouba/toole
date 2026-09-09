import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { UserRole } from '@/types';
import { uploadImage } from '@/services/upload.service';
import {
  RC,
  RF,
  RegHero,
  PressScale,
  Field,
  Animated,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from '@/components/auth/registerAtoms';

type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';
// Étapes granulaires : une question par écran. vehicle/kyc = livreur uniquement.
type Step = 'role' | 'name' | 'dob' | 'phone' | 'referral' | 'vehicle' | 'kyc';
type DocStatus = 'empty' | 'uploading' | 'done' | 'error';
interface Doc {
  uri?: string;
  url?: string;
  status: DocStatus;
}

const ROLES: {
  type: UserRole;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  desc: string;
}[] = [
  {
    type: 'client',
    icon: 'inventory-2',
    title: 'Client',
    desc: "J'envoie des colis partout en ville en quelques minutes.",
  },
  {
    type: 'driver',
    icon: 'two-wheeler',
    title: 'Livreur',
    desc: "Je livre des colis. Fixez vos horaires et gagnez de l'argent.",
  },
];

const VEHICLES: {
  type: VehicleType;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}[] = [
  { type: 'moto', icon: 'two-wheeler', label: 'Moto' },
  { type: 'velo', icon: 'pedal-bike', label: 'Vélo' },
  { type: 'tricycle', icon: 'electric-rickshaw', label: 'Tricycle' },
  { type: 'voiture', icon: 'directions-car', label: 'Voiture' },
];

const CURRENT_YEAR = new Date().getFullYear();

// Règles de validation INCHANGÉES (reprises telles quelles, appliquées par champ).
function validateDate(d: string, m: string, y: string): string | null {
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!day || !month || !year) return 'Date incomplète';
  if (day < 1 || day > 31) return 'Jour invalide';
  if (month < 1 || month > 12) return 'Mois invalide';
  if (year < 1920 || year > CURRENT_YEAR - 16) return 'Vous devez avoir au moins 16 ans';
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return 'Date invalide';
  }
  return null;
}

/** Icône qui « spring » quand sa carte est sélectionnée. */
function SpringIcon({
  selected,
  reduceMotion,
  children,
}: {
  selected: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const s = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    s.value = reduceMotion
      ? selected
        ? 1
        : 0
      : withSpring(selected ? 1 : 0, { damping: 9, stiffness: 150 });
  }, [selected, reduceMotion]);
  const st = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + s.value * 0.14 }, { rotate: `${s.value * -8}deg` }],
  }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Identity
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const [phone, setPhone] = useState('');
  const otpChannel = 'sms' as const;

  // Driver only
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [front, setFront] = useState<Doc>({ status: 'empty' });
  const [back, setBack] = useState<Doc>({ status: 'empty' });
  const [submitting, setSubmitting] = useState(false);

  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  // Si l'utilisateur édite une étape via « Modifier », on mémorise où revenir.
  const [editReturn, setEditReturn] = useState<Step | null>(null);

  // Ordre des étapes selon le rôle -> compteur dynamique (Client 5, Livreur 7).
  const order = useMemo<Step[]>(() => {
    const base: Step[] = ['role', 'name', 'dob', 'phone', 'referral'];
    return selectedRole === 'driver' ? [...base, 'vehicle', 'kyc'] : base;
  }, [selectedRole]);
  const stepIdx = Math.max(0, order.indexOf(step));
  const stepTotal = order.length;

  // ---------- Validation PAR ÉTAPE (mêmes règles/messages qu'avant) ----------
  const nameError = (): string | null => {
    if (firstName.trim().length < 2) return 'Entrez votre prénom (2 caractères min)';
    if (lastName.trim().length < 2) return 'Entrez votre nom (2 caractères min)';
    return null;
  };
  const phoneError = (): string | null => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 8 && !(cleaned.length === 11 && cleaned.startsWith('226'))) {
      return 'Entrez un numéro de téléphone à 8 chiffres';
    }
    return null;
  };
  // Garde finale du payload : identique à l'ancien validateIdentityFields.
  const validateIdentityFields = (): string | null =>
    nameError() ?? validateDate(day, month, year) ?? phoneError();

  const stepValid = (s: Step): boolean => {
    switch (s) {
      case 'role':
        return !!selectedRole;
      case 'name':
        return nameError() === null;
      case 'dob':
        return validateDate(day, month, year) === null;
      case 'phone':
        return phoneError() === null;
      case 'referral':
        return true; // optionnel
      case 'vehicle':
        return !!vehicleType;
      case 'kyc':
        return front.status === 'done' && back.status === 'done';
    }
  };
  const stepErrorMessage = (s: Step): string | null => {
    switch (s) {
      case 'name':
        return nameError();
      case 'dob':
        return validateDate(day, month, year);
      case 'phone':
        return phoneError();
      default:
        return null;
    }
  };

  const docsReady = front.status === 'done' && back.status === 'done';
  const hasUploadError = front.status === 'error' || back.status === 'error';

  // ---------- Transition glissée (reanimated contrôlé, pas de `entering`) ----------
  const dir = useRef<1 | -1>(1);
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      tx.value = 0;
      op.value = 1;
      return;
    }
    tx.value = dir.current * 40;
    op.value = 0;
    tx.value = withTiming(0, { duration: 250 });
    op.value = withTiming(1, { duration: 250 });
    // annonce du changement d'étape au lecteur d'écran
    AccessibilityInfo.announceForAccessibility?.(`Étape ${stepIdx + 1} sur ${stepTotal}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: op.value,
  }));

  const goTo = (s: Step, direction: 1 | -1) => {
    dir.current = direction;
    setError('');
    setStep(s);
  };

  // ---------- Navigation ----------
  const handleBack = () => {
    setError('');
    if (stepIdx > 0) return goTo(order[stepIdx - 1], -1);
    // depuis le choix de profil : on quitte l'inscription
    logout();
    router.replace('/(auth)/login');
  };

  const handleNext = async () => {
    const err = stepErrorMessage(step);
    if (!stepValid(step)) {
      if (err) setError(err);
      return;
    }
    setError('');

    // Retour depuis « Modifier » : on revient à l'étape d'origine.
    if (editReturn) {
      const back = editReturn;
      setEditReturn(null);
      return goTo(back, -1);
    }

    // Déclencheurs de création de compte (un seul appel réseau, à la fin) :
    if (step === 'referral' && selectedRole === 'client') {
      await sendOtpAndProceed();
      return;
    }
    if (step === 'kyc') {
      await handleKycSubmit();
      return;
    }
    // Sinon on avance dans l'ordre.
    const next = order[stepIdx + 1];
    if (next) goTo(next, 1);
  };

  const handleModify = (s: Step) => {
    setEditReturn(step);
    goTo(s, -1);
  };

  const pickPhoto = async (which: 'front' | 'back') => {
    setError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Permission appareil photo refusée. Activez-la dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    const setDoc = which === 'front' ? setFront : setBack;
    setDoc({ uri, status: 'uploading' });
    try {
      const up = await uploadImage(uri, 'kyc');
      if (up?.url) setDoc({ uri, url: up.url, status: 'done' });
      else setDoc({ uri, status: 'error' });
    } catch {
      setDoc({ uri, status: 'error' });
    }
  };

  const handleKycSubmit = async () => {
    setError('');
    if (!docsReady) {
      if (front.status !== 'done') await pickPhoto('front');
      if (back.status !== 'done') await pickPhoto('back');
      return;
    }
    setSubmitting(true);
    try {
      await sendOtpAndProceed({
        cnibPhotoUrl: front.url,
        cnibPhotoBackUrl: back.url,
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          "Impossible d'envoyer le code de vérification. Réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Envoi (INCHANGÉ) : un seul appel, payload identique ----------
  const sendOtpAndProceed = async (
    kycExtras: { cnibPhotoUrl?: string; cnibPhotoBackUrl?: string } = {},
  ): Promise<void> => {
    if (!selectedRole) return;
    setError('');
    // Garde finale : si un champ identité était invalide, on y renvoie.
    const idErr = validateIdentityFields();
    if (idErr) {
      setError(idErr);
      return;
    }
    const dob = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const cleanedPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanedPhone.length === 8 ? `226${cleanedPhone}` : cleanedPhone;
    const otpIdentifier = fullPhone;

    useAuthStore.getState().setPendingRegistration({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dob,
      userType: selectedRole,
      phone: fullPhone,
      vehicleType: vehicleType ?? undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      referralCode: referralCode.trim() || undefined,
      cnibPhotoUrl: kycExtras.cnibPhotoUrl,
      cnibPhotoBackUrl: kycExtras.cnibPhotoBackUrl,
      otpIdentifier,
    });

    const result = await useAuthStore.getState().sendOtp(otpIdentifier, otpChannel, 'register');
    if (!result.success) {
      useAuthStore.getState().setPendingRegistration(null);
      setError(
        result.error ??
          "Impossible d'envoyer le code de vérification. Vérifiez vos informations.",
      );
      return;
    }
    router.push('/(auth)/otp');
  };

  // ---------- Textes ----------
  const QUESTION: Partial<Record<Step, { q: string; help?: string }>> = {
    name: { q: 'Votre prénom et votre nom' },
    dob: { q: 'Votre date de naissance', help: 'Format : JJ / MM / AAAA' },
    phone: { q: 'Votre téléphone' },
    referral: { q: 'Votre code de parrainage' },
    vehicle: { q: 'Votre véhicule', help: 'Avec quoi effectuez-vous vos livraisons ?' },
    kyc: {
      q: "Justificatifs d'identité",
      help: "Notre équipe vérifie ces documents avant d'activer votre compte (24-48h).",
    },
  };

  const isCreateStep =
    (step === 'referral' && selectedRole === 'client') || step === 'kyc';
  const ctaLabel = submitting
    ? 'Création…'
    : step === 'kyc'
      ? hasUploadError
        ? "Réessayer l'envoi"
        : 'Créer mon compte'
      : isCreateStep
        ? 'Créer mon compte'
        : 'Suivant';
  const ctaDisabled =
    step === 'kyc'
      ? (!docsReady && !hasUploadError) || submitting
      : !stepValid(step) || submitting;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <RegHero
        mode={step === 'role' ? 'profile' : 'step'}
        stepIndex={stepIdx + 1}
        stepTotal={stepTotal}
        title={step === 'role' ? `Bienvenue sur ${appName}` : undefined}
        subtitle={step === 'role' ? 'Choisissez votre profil pour commencer.' : undefined}
        onBack={handleBack}
        showBack={stepIdx > 0}
        reduceMotion={reduceMotion}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <Animated.View style={slideStyle}>
              {/* Question d'étape (hors profil) */}
              {step !== 'role' && QUESTION[step] ? (
                <View style={styles.qBlock}>
                  <Text style={styles.question} accessibilityRole="header">
                    {QUESTION[step]!.q}
                  </Text>
                  {QUESTION[step]!.help ? (
                    <Text style={styles.qHelp}>{QUESTION[step]!.help}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* ---------- PROFIL ---------- */}
              {step === 'role' && (
                <View
                  accessibilityRole="radiogroup"
                  style={styles.roleWrap}
                >
                  {ROLES.map((role) => {
                    const sel = selectedRole === role.type;
                    return (
                      <PressScale
                        key={role.type}
                        reduceMotion={reduceMotion}
                        onPress={() => setSelectedRole(role.type)}
                        style={[styles.roleCard, sel && styles.cardSelected]}
                      >
                        <View
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel }}
                          accessibilityLabel={`${role.title}. ${role.desc}`}
                          style={styles.roleRow}
                        >
                          <View style={[styles.roleIcon, sel && styles.roleIconSel]}>
                            <SpringIcon selected={sel} reduceMotion={reduceMotion}>
                              <MaterialIcons
                                name={role.icon}
                                size={26}
                                color={sel ? '#fff' : RC.gDark}
                              />
                            </SpringIcon>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roleTitle}>{role.title}</Text>
                            <Text style={styles.roleDesc}>{role.desc}</Text>
                          </View>
                          <View style={[styles.radio, sel && styles.radioSel]}>
                            {sel && <View style={styles.radioDot} />}
                          </View>
                        </View>
                      </PressScale>
                    );
                  })}
                  <Text style={styles.note}>
                    Vous pourrez modifier ces choix plus tard dans votre profil.
                  </Text>
                </View>
              )}

              {/* ---------- NOM ---------- */}
              {step === 'name' && (
                <>
                  <Field
                    big
                    label="Prénom"
                    required
                    placeholder="Aminata"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoFocus
                    returnKeyType="next"
                    containerStyle={styles.fieldGap}
                  />
                  <Field
                    big
                    label="Nom"
                    required
                    placeholder="Ouedraogo"
                    value={lastName}
                    onChangeText={setLastName}
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
                    containerStyle={styles.fieldGap}
                  />
                </>
              )}

              {/* ---------- DATE ---------- */}
              {step === 'dob' && (
                <View style={styles.fieldGap}>
                  <View style={styles.dobRow}>
                    <TextInput
                      style={[styles.dobInput, styles.dobBoxBig]}
                      placeholder="JJ"
                      placeholderTextColor={RC.muted}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={day}
                      autoFocus
                      onChangeText={(t) => {
                        const v = t.replace(/\D/g, '');
                        setDay(v);
                        if (v.length === 2) monthRef.current?.focus();
                      }}
                    />
                    <Text style={styles.dobSep}>/</Text>
                    <TextInput
                      ref={monthRef}
                      style={[styles.dobInput, styles.dobBoxBig]}
                      placeholder="MM"
                      placeholderTextColor={RC.muted}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={month}
                      onChangeText={(t) => {
                        const v = t.replace(/\D/g, '');
                        setMonth(v);
                        if (v.length === 2) yearRef.current?.focus();
                      }}
                    />
                    <Text style={styles.dobSep}>/</Text>
                    <TextInput
                      ref={yearRef}
                      style={[styles.dobInput, styles.dobYearBig]}
                      placeholder="AAAA"
                      placeholderTextColor={RC.muted}
                      keyboardType="number-pad"
                      maxLength={4}
                      value={year}
                      onSubmitEditing={handleNext}
                      onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
                    />
                  </View>
                </View>
              )}

              {/* ---------- TÉLÉPHONE ---------- */}
              {step === 'phone' && (
                <Field
                  big
                  label="Téléphone"
                  required
                  placeholder="70 12 34 56"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                  containerStyle={styles.fieldGap}
                />
              )}

              {/* ---------- PARRAINAGE ---------- */}
              {step === 'referral' && (
                <Field
                  big
                  label="Code de parrainage (optionnel)"
                  placeholder="Ex : AMINA22"
                  autoCapitalize="characters"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                  containerStyle={styles.fieldGap}
                />
              )}

              {/* ---------- VÉHICULE (livreur) ---------- */}
              {step === 'vehicle' && (
                <>
                  <View style={styles.vehicleGrid}>
                    {VEHICLES.map((v) => {
                      const sel = vehicleType === v.type;
                      return (
                        <PressScale
                          key={v.type}
                          reduceMotion={reduceMotion}
                          onPress={() => setVehicleType(v.type)}
                          style={[styles.vehicleCard, sel && styles.cardSelected]}
                        >
                          <SpringIcon selected={sel} reduceMotion={reduceMotion}>
                            <MaterialIcons
                              name={v.icon}
                              size={34}
                              color={sel ? RC.gDark : RC.ink}
                            />
                          </SpringIcon>
                          <Text style={[styles.vehicleLabel, sel && { color: RC.gDark }]}>
                            {v.label}
                          </Text>
                          {sel && (
                            <View style={styles.vehicleCheck}>
                              <MaterialIcons name="check" size={13} color="#fff" />
                            </View>
                          )}
                        </PressScale>
                      );
                    })}
                  </View>
                  <Field
                    label="Plaque d'immatriculation (optionnel)"
                    placeholder="Ex : 11 BF 1234"
                    autoCapitalize="characters"
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                    hint="Laissez vide si vous avez plusieurs véhicules ou n'avez pas encore la plaque."
                    containerStyle={styles.fieldGap}
                  />
                </>
              )}

              {/* ---------- KYC (livreur) ---------- */}
              {step === 'kyc' && (
                <>
                  <Text style={styles.sectionLabel}>
                    PIÈCE D'IDENTITÉ (CNIB, PASSEPORT, PERMIS)
                  </Text>
                  <View style={styles.docRow}>
                    <DocZone doc={front} label="Recto" onPress={() => pickPhoto('front')} />
                    <DocZone doc={back} label="Verso" onPress={() => pickPhoto('back')} />
                  </View>
                  {hasUploadError && (
                    <View style={styles.errorRow}>
                      <MaterialIcons name="error" size={16} color={RC.error} />
                      <Text style={styles.errorTextRed}>
                        Une des photos n'a pas pu être envoyée. Vérifiez votre connexion et
                        réessayez.
                      </Text>
                    </View>
                  )}
                  <View style={styles.privacyCard}>
                    <MaterialIcons name="verified-user" size={20} color={RC.gDark} />
                    <Text style={styles.privacyText}>
                      Vos documents sont chiffrés et utilisés uniquement pour vérifier votre
                      identité, conformément à notre politique de confidentialité.
                    </Text>
                  </View>
                </>
              )}

              {/* ---------- RÉCAPITULATIF (étapes identité) ---------- */}
              {step !== 'role' && step !== 'vehicle' && step !== 'kyc' ? (
                <Recap
                  order={order}
                  step={step}
                  selectedRole={selectedRole}
                  values={{
                    name: `${firstName} ${lastName}`.trim(),
                    dob: day && month && year ? `${day}/${month}/${year}` : '',
                    phone,
                    referral: referralCode,
                  }}
                  onModify={handleModify}
                />
              ) : null}

              {error ? (
                <View style={styles.bannerError}>
                  <MaterialIcons name="error" size={16} color={RC.error} />
                  <Text style={styles.errorTextRed}>{error}</Text>
                </View>
              ) : null}
            </Animated.View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {/* ---------- Footer ancré ---------- */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {step === 'referral' ? (
            <Pressable
              onPress={handleNext}
              hitSlop={8}
              style={styles.skipRow}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>Passer</Text>
            </Pressable>
          ) : null}
          <Cta
            label={ctaLabel}
            disabled={ctaDisabled}
            loading={submitting}
            onPress={handleNext}
            reduceMotion={reduceMotion}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Récapitulatif « Votre inscription » : profil + 4 étapes, lignes faites / à venir. */
function Recap({
  order,
  step,
  selectedRole,
  values,
  onModify,
}: {
  order: Step[];
  step: Step;
  selectedRole: UserRole | null;
  values: { name: string; dob: string; phone: string; referral: string };
  onModify: (s: Step) => void;
}) {
  const lines: { key: Step; label: string; value: string; optional?: boolean }[] = [
    { key: 'role', label: 'Profil', value: selectedRole === 'driver' ? 'Livreur' : selectedRole === 'client' ? 'Client' : '' },
    { key: 'name', label: 'Prénom et nom', value: values.name },
    { key: 'dob', label: 'Date de naissance', value: values.dob },
    { key: 'phone', label: 'Téléphone', value: values.phone },
    { key: 'referral', label: 'Code de parrainage', value: values.referral, optional: true },
  ];
  const curIdx = order.indexOf(step);
  return (
    <View style={styles.recap}>
      <Text style={styles.recapTitle}>Votre inscription</Text>
      {lines.map((l) => {
        const done = order.indexOf(l.key) < curIdx; // étape déjà validée
        return (
          <View key={l.key} style={styles.recapRow}>
            <View style={[styles.recapBullet, done && styles.recapBulletDone]}>
              {done ? <MaterialIcons name="check" size={12} color="#fff" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              {done ? (
                <Text style={styles.recapValue} numberOfLines={1}>
                  {l.value || '—'}
                </Text>
              ) : (
                <Text style={styles.recapPending}>
                  {l.label}
                  {l.optional ? ' · optionnel' : ''}
                </Text>
              )}
            </View>
            {done ? (
              <Pressable onPress={() => onModify(l.key)} hitSlop={8}>
                <Text style={styles.recapEdit}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Zone d'upload d'une pièce (vide / uploading / done / error). */
function DocZone({ doc, label, onPress }: { doc: Doc; label: string; onPress: () => void }) {
  const isError = doc.status === 'error';
  const isDone = doc.status === 'done';
  const isUploading = doc.status === 'uploading';
  return (
    <Pressable
      style={[styles.docZone, isDone && styles.docZoneDone, isError && styles.docZoneError]}
      onPress={onPress}
      disabled={isUploading}
    >
      {doc.uri ? (
        <>
          <Image source={{ uri: doc.uri }} style={styles.docThumb} />
          <View style={styles.docCamBtn}>
            <MaterialIcons name="photo-camera" size={16} color="#fff" />
          </View>
          {isUploading && (
            <View style={styles.docOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          {isDone && (
            <View style={[styles.docBadge, { backgroundColor: RC.gDark }]}>
              <MaterialIcons name="check" size={13} color="#fff" />
            </View>
          )}
          {isError && (
            <View style={[styles.docBadge, { backgroundColor: RC.error }]}>
              <MaterialIcons name="priority-high" size={13} color="#fff" />
            </View>
          )}
        </>
      ) : (
        <>
          <MaterialIcons name="photo-camera" size={26} color={RC.gDark} />
          <Text style={styles.docLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Cta({
  label,
  onPress,
  disabled,
  loading,
  reduceMotion,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  reduceMotion?: boolean;
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled || loading} reduceMotion={reduceMotion}>
      <View style={[styles.cta, (disabled || loading) && styles.ctaDisabled]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>{label}</Text>
        )}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: RC.bg },
  scroll: { padding: 22, paddingBottom: 28, flexGrow: 1, justifyContent: 'center' },

  // question d'étape
  qBlock: { marginBottom: 22 },
  question: { fontFamily: RF.display, fontSize: 32, lineHeight: 35, color: RC.ink, letterSpacing: -0.6 },
  qHelp: { fontFamily: RF.ui, fontSize: 14.5, color: RC.muted, marginTop: 8, lineHeight: 21 },

  // --- cartes profil ---
  roleWrap: { justifyContent: 'center' },
  roleCard: {
    backgroundColor: RC.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: RC.hair,
    padding: 16,
    marginBottom: 14,
  },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardSelected: {
    borderColor: RC.gDark,
    backgroundColor: RC.tender,
    shadowColor: RC.gMid,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  roleIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: RC.tender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSel: { backgroundColor: RC.gDark },
  roleTitle: { fontFamily: RF.uiBold, fontSize: 19, color: RC.ink },
  roleDesc: { fontFamily: RF.ui, fontSize: 14, color: RC.muted, marginTop: 3, lineHeight: 19 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D6CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: { borderColor: RC.gDark, backgroundColor: RC.gDark },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff' },
  note: { fontFamily: RF.ui, fontSize: 12.5, color: RC.muted, marginTop: 6, textAlign: 'center' },

  // --- champs ---
  fieldGap: { marginBottom: 16 },
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dobInput: {
    backgroundColor: RC.surface,
    borderWidth: 1.5,
    borderColor: RC.hair,
    borderRadius: 16,
    fontFamily: RF.num,
    color: RC.ink,
    textAlign: 'center',
  },
  dobBoxBig: { width: 84, height: 68, fontSize: 26 },
  dobYearBig: { flex: 1, height: 68, fontSize: 26 },
  dobSep: { color: '#C4BCAE', fontFamily: RF.uiSemi, fontSize: 22 },

  // --- véhicule ---
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  vehicleCard: {
    width: '47%',
    height: 104,
    backgroundColor: RC.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: RC.hair,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  vehicleLabel: { fontFamily: RF.uiSemi, fontSize: 14.5, color: RC.ink },
  vehicleCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: RC.gDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- KYC ---
  sectionLabel: {
    fontFamily: RF.uiBold,
    fontSize: 11.5,
    letterSpacing: 1,
    color: RC.muted,
    marginBottom: 12,
  },
  docRow: { flexDirection: 'row', gap: 12 },
  docZone: {
    flex: 1,
    aspectRatio: 1.45,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A6DBB8',
    backgroundColor: '#F1FAF4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  docZoneDone: { borderStyle: 'solid', borderColor: RC.gDark },
  docZoneError: { borderStyle: 'solid', borderColor: RC.error },
  docLabel: { fontFamily: RF.uiSemi, fontSize: 13.5, color: RC.gDark },
  docThumb: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  docCamBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  errorTextRed: { flex: 1, color: RC.error, fontFamily: RF.uiMed, fontSize: 13, lineHeight: 18 },
  privacyCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: RC.tender,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  privacyText: { flex: 1, color: '#14532d', fontFamily: RF.ui, fontSize: 12.5, lineHeight: 18 },

  // --- récap ---
  recap: {
    backgroundColor: '#F4EEE4',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  recapTitle: { fontFamily: RF.uiBold, fontSize: 13, color: RC.muted, letterSpacing: 0.4, marginBottom: 12, textTransform: 'uppercase' },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  recapBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapBulletDone: { backgroundColor: RC.gDark, borderColor: RC.gDark },
  recapValue: { fontFamily: RF.uiMed, fontSize: 14.5, color: RC.ink },
  recapPending: { fontFamily: RF.ui, fontSize: 14.5, color: '#9AA49C' },
  recapEdit: { fontFamily: RF.uiSemi, fontSize: 13, color: RC.gDark },

  bannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },

  // --- footer ---
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFE8DC',
    backgroundColor: RC.bg,
  },
  skipRow: { alignSelf: 'center', paddingVertical: 8, marginBottom: 2 },
  skipText: { fontFamily: RF.uiSemi, fontSize: 14, color: RC.muted },
  cta: {
    backgroundColor: RC.gDark,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#E4DCCF' },
  ctaText: { color: '#fff', fontFamily: RF.uiBold, fontSize: 16.5 },
  ctaTextDisabled: { color: '#6E7A72' },
});
