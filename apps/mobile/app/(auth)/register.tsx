import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TextInputProps,
  Image,
  ActivityIndicator,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole, VehicleType } from '@/types';
import { uploadImage } from '@/services/upload.service';
import { useRegisterLayout } from '@/hooks/useRegisterLayout';
import { InscriptionCard, InscriptionBar } from '@/components/auth/InscriptionCard';
import {
  RC,
  RF,
  PressScale,
  Animated,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from '@/components/auth/registerAtoms';

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
  { type: 'client', icon: 'inventory-2', title: 'Client', desc: 'Je fais livrer mes colis.' },
  { type: 'driver', icon: 'two-wheeler', title: 'Livreur', desc: 'Je livre et je gagne ma course.' },
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

// ============================================================================
//  VALIDATION — règles INCHANGÉES (reprises telles quelles, par champ).
// ============================================================================
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
    s.value = reduceMotion ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, { damping: 9, stiffness: 150 });
  }, [selected, reduceMotion]);
  const st = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + s.value * 0.14 }, { rotate: `${s.value * -8}deg` }],
  }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useRegisterLayout();
  const { logout } = useAuthStore();

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
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const [phone, setPhone] = useState('');
  const otpChannel = 'sms' as const;

  // Driver only
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [plateFocused, setPlateFocused] = useState(false);
  const [front, setFront] = useState<Doc>({ status: 'empty' });
  const [back, setBack] = useState<Doc>({ status: 'empty' });
  const [submitting, setSubmitting] = useState(false);

  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  // Si l'utilisateur édite une étape via le badge « ✎ », on mémorise où revenir.
  const [editReturn, setEditReturn] = useState<Step | null>(null);

  // Ordre des étapes selon le rôle -> compteur dynamique (Client 5, Livreur 7).
  const order = useMemo<Step[]>(() => {
    const base: Step[] = ['role', 'name', 'dob', 'phone', 'referral'];
    return selectedRole === 'driver' ? [...base, 'vehicle', 'kyc'] : base;
  }, [selectedRole]);
  const stepIdx = Math.max(0, order.indexOf(step));
  const stepTotal = order.length;

  // ---------- Validation par étape (mêmes règles/messages qu'avant) ----------
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

  // ---------- Transition glissée (reanimated contrôlé) ----------
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

  // ---------- Navigation (INCHANGÉE) ----------
  const handleBack = () => {
    setError('');
    if (stepIdx > 0) return goTo(order[stepIdx - 1], -1);
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

    if (editReturn) {
      setEditReturn(null);
      // Si le rôle a changé et que l'étape d'origine n'existe plus dans le
      // parcours (ex. kyc alors qu'on est repassé client), on revient à la
      // dernière étape valide du nouvel ordre plutôt qu'à une étape orpheline.
      const backTo = order.includes(editReturn) ? editReturn : order[order.length - 1];
      return goTo(backTo, -1);
    }

    if (step === 'referral' && selectedRole === 'client') {
      await sendOtpAndProceed();
      return;
    }
    if (step === 'kyc') {
      await handleKycSubmit();
      return;
    }
    const next = order[stepIdx + 1];
    if (next) goTo(next, 1);
  };

  // Le badge « ✎ » de la carte ramène à l'étape 1 (rôle), puis « Suivant »
  // rejoue jusqu'à l'étape courante (remplace l'ancien « Modifier »).
  const handleEditRole = () => {
    if (step === 'role') return;
    setEditReturn(step);
    goTo('role', -1);
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
      await sendOtpAndProceed({ cnibPhotoUrl: front.url, cnibPhotoBackUrl: back.url });
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
        result.error ?? "Impossible d'envoyer le code de vérification. Vérifiez vos informations.",
      );
      return;
    }
    router.push('/(auth)/otp');
  };

  // ---------- Libellés CTA (INCHANGÉS : labels porteurs de sens conservés) ----------
  const isCreateStep = (step === 'referral' && selectedRole === 'client') || step === 'kyc';
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

  // Le référencement (driver) est la seule étape réellement « sautable » -> le
  // bouton passe en style fantôme quand le champ est vide (le libellé reste
  // « Suivant » ; pour le client cette étape CRÉE le compte, on n'y touche pas).
  const ctaGhost = step === 'referral' && selectedRole === 'driver' && referralCode.trim() === '';

  // Carte : masquer TITULAIRE en palier serré dès l'étape 3 (nom acquis).
  const stepPos = order.indexOf(step);
  const hideTitulaire = layout.palier === 'serre' && stepPos >= 2;
  const useBar = layout.isLandscape;

  const rawPhone = phone.replace(/\D/g, '').slice(0, 8);

  // Segments de progression : 19 pt (5 étapes) / 13 pt (7 étapes).
  const segW = stepTotal <= 5 ? 19 : 13;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ---------- En-tête : retour + segments + n sur N ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {stepIdx > 0 ? (
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8} accessibilityLabel="Retour">
            <MaterialIcons name="chevron-left" size={24} color="#5F7066" />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.segments}>
          {order.map((_, i) => (
            <View
              key={i}
              style={[styles.segment, { width: segW, backgroundColor: i <= stepIdx ? '#1B9A50' : '#DDD7C8' }]}
            />
          ))}
        </View>
        <Text style={styles.stepCount}>
          {stepIdx + 1} sur {stepTotal}
        </Text>
      </View>

      {/* ---------- Carte (fixe) / barre compacte en paysage ---------- */}
      <View style={[styles.cardZone, { paddingHorizontal: layout.gutter }]}>
        {useBar ? (
          <InscriptionBar role={selectedRole} firstName={firstName} lastName={lastName} />
        ) : (
          <View style={{ alignSelf: 'center' }}>
            <InscriptionCard
              role={selectedRole}
              firstName={firstName}
              lastName={lastName}
              day={day}
              month={month}
              year={year}
              phone={rawPhone}
              vehicleType={vehicleType}
              vehiclePlate={vehiclePlate}
              onEditRole={handleEditRole}
              layout={layout}
              hideTitulaire={hideTitulaire}
            />
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Zone de saisie — élastique. ScrollView filet de sécurité (ne défile
            que si le contenu dépasse sur un très petit écran). */}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: layout.gutter }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[slideStyle, { width: '100%', maxWidth: 420, alignSelf: 'center' }]}>
            {/* Titre d'étape */}
            {step === 'role' ? (
              <Text style={styles.title} accessibilityRole="header">
                Vous êtes ?
              </Text>
            ) : step === 'vehicle' ? (
              <>
                <Text style={styles.title} accessibilityRole="header">
                  Votre véhicule
                </Text>
                <Text style={styles.subtitle}>Avec quoi effectuez-vous vos livraisons ?</Text>
              </>
            ) : step === 'kyc' ? (
              <>
                <Text style={styles.title} accessibilityRole="header">
                  Justificatifs d'identité
                </Text>
                <Text style={styles.subtitle}>
                  Notre équipe vérifie ces documents avant d'activer votre compte (24-48h).
                </Text>
              </>
            ) : null}

            {/* ---------- RÔLE ---------- */}
            {step === 'role' && (
              <View accessibilityRole="radiogroup">
                {ROLES.map((role) => {
                  const sel = selectedRole === role.type;
                  return (
                    <PressScale
                      key={role.type}
                      reduceMotion={reduceMotion}
                      onPress={() => setSelectedRole(role.type)}
                      style={[styles.roleCard, sel && styles.roleCardSel]}
                    >
                      <View
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel }}
                        accessibilityLabel={`${role.title}. ${role.desc}`}
                        style={styles.roleRow}
                      >
                        <View style={[styles.roleIcon, sel && styles.roleIconSel]}>
                          <SpringIcon selected={sel} reduceMotion={reduceMotion}>
                            <MaterialIcons name={role.icon} size={26} color={sel ? '#15833F' : '#7B8880'} />
                          </SpringIcon>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roleTitle}>{role.title}</Text>
                          <Text style={styles.roleDesc}>{role.desc}</Text>
                        </View>
                        <View style={[styles.radio, sel && styles.radioSel]} />
                      </View>
                    </PressScale>
                  );
                })}
                <Text style={styles.note}>
                  Ce choix restera visible sur votre carte. Vous pourrez le changer en tapant dessus.
                </Text>
              </View>
            )}

            {/* ---------- NOM ---------- */}
            {step === 'name' && (
              <View>
                <UnderlineField
                  label="Prénom"
                  required
                  placeholder="Aminata"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
                <UnderlineField
                  inputRef={lastNameRef}
                  label="Nom"
                  required
                  placeholder="Ouedraogo"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
              </View>
            )}

            {/* ---------- DATE ---------- */}
            {step === 'dob' && (
              <View>
                <View style={styles.dobRow}>
                  <TextInput
                    ref={dayRef}
                    style={[styles.dobBox, styles.dobDM, day ? styles.dobActive : null]}
                    placeholder="JJ"
                    placeholderTextColor="#C3BDAE"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={day}
                    autoFocus
                    maxFontSizeMultiplier={1.3}
                    onChangeText={(t) => {
                      const v = t.replace(/\D/g, '');
                      setDay(v);
                      if (v.length === 2) monthRef.current?.focus();
                    }}
                  />
                  <Text style={styles.dobSep}>/</Text>
                  <TextInput
                    ref={monthRef}
                    style={[styles.dobBox, styles.dobDM, month ? styles.dobActive : null]}
                    placeholder="MM"
                    placeholderTextColor="#C3BDAE"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={month}
                    maxFontSizeMultiplier={1.3}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace' && month.length === 0) dayRef.current?.focus();
                    }}
                    onChangeText={(t) => {
                      const v = t.replace(/\D/g, '');
                      setMonth(v);
                      if (v.length === 2) yearRef.current?.focus();
                    }}
                  />
                  <Text style={styles.dobSep}>/</Text>
                  <TextInput
                    ref={yearRef}
                    style={[styles.dobBox, styles.dobY, year ? styles.dobActive : null]}
                    placeholder="AAAA"
                    placeholderTextColor="#C3BDAE"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={year}
                    maxFontSizeMultiplier={1.3}
                    returnKeyType="done"
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace' && year.length === 0) monthRef.current?.focus();
                    }}
                    onSubmitEditing={handleNext}
                    onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
                  />
                </View>
                <Text style={styles.help}>Le curseur passe tout seul d'une case à l'autre.</Text>
              </View>
            )}

            {/* ---------- TÉLÉPHONE ---------- */}
            {step === 'phone' && (
              <View>
                <UnderlineField
                  label="Téléphone"
                  required
                  prefix="+226"
                  placeholder="70 24 18 50"
                  keyboardType="number-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                  mono
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
                <Text style={styles.help}>
                  {rawPhone.length >= 8
                    ? 'Un code vous sera envoyé par SMS.'
                    : `Encore ${8 - rawPhone.length} chiffres. Un code vous sera envoyé par SMS.`}
                </Text>
              </View>
            )}

            {/* ---------- PARRAINAGE ---------- */}
            {step === 'referral' && (
              <View>
                <UnderlineField
                  label="Code de parrainage"
                  optional
                  placeholder="AMINA22"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  mono
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
                <Text style={styles.help}>Si un livreur ou un ami vous a recommandé Toolé.</Text>
              </View>
            )}

            {/* ---------- VÉHICULE (livreur) ---------- */}
            {step === 'vehicle' && (
              <View>
                {plateFocused ? (
                  // État saisie : rangée de 4 chips
                  <View style={styles.chipRow}>
                    {VEHICLES.map((v) => {
                      const sel = vehicleType === v.type;
                      return (
                        <Pressable
                          key={v.type}
                          onPress={() => setVehicleType(v.type)}
                          style={[styles.chip, sel && styles.chipSel]}
                        >
                          <MaterialIcons name={v.icon} size={19} color={sel ? '#15833F' : '#3A443D'} />
                          <Text style={[styles.chipLabel, sel && { color: '#15833F' }]}>{v.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  // État navigation : grille 2×2
                  <View style={styles.vehicleGrid}>
                    {VEHICLES.map((v) => {
                      const sel = vehicleType === v.type;
                      return (
                        <PressScale
                          key={v.type}
                          reduceMotion={reduceMotion}
                          onPress={() => setVehicleType(v.type)}
                          style={[styles.vehicleTile, { width: (layout.cardW - 12) / 2 }, sel && styles.vehicleTileSel]}
                        >
                          <SpringIcon selected={sel} reduceMotion={reduceMotion}>
                            <MaterialIcons name={v.icon} size={26} color={sel ? '#15833F' : '#3A443D'} />
                          </SpringIcon>
                          <Text style={[styles.vehicleLabel, sel && { color: '#15833F' }]}>{v.label}</Text>
                        </PressScale>
                      );
                    })}
                  </View>
                )}
                {plateFocused ? (
                  <UnderlineField
                    label="Plaque d'immatriculation"
                    optional
                    placeholder="11 BF 1234"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    mono
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                    autoFocus
                    onFocus={() => setPlateFocused(true)}
                    onBlur={() => setPlateFocused(false)}
                    returnKeyType="done"
                  />
                ) : (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.boxLabel}>Plaque d'immatriculation (optionnel)</Text>
                    <TextInput
                      style={styles.boxInput}
                      placeholder="Ex : 11 BF 1234"
                      placeholderTextColor={RC.muted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={vehiclePlate}
                      onChangeText={setVehiclePlate}
                      onFocus={() => setPlateFocused(true)}
                      maxFontSizeMultiplier={1.6}
                    />
                    <Text style={styles.help}>
                      Laissez vide si vous avez plusieurs véhicules ou n'avez pas encore la plaque.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ---------- KYC (livreur) ---------- */}
            {step === 'kyc' && (
              <View>
                <Text style={styles.sectionLabel}>PIÈCE D'IDENTITÉ (CNIB, PASSEPORT, PERMIS)</Text>
                <View style={styles.docRow}>
                  <DocZone doc={front} label="Recto" onPress={() => pickPhoto('front')} />
                  <DocZone doc={back} label="Verso" onPress={() => pickPhoto('back')} />
                </View>
                {hasUploadError && (
                  <View style={styles.errorRow}>
                    <MaterialIcons name="error" size={16} color={RC.error} />
                    <Text style={styles.errorTextRed}>
                      Une des photos n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.
                    </Text>
                  </View>
                )}
                <View style={styles.privacyCard}>
                  <MaterialIcons name="verified-user" size={18} color="#15833F" />
                  <Text style={styles.privacyText}>
                    Vos documents sont chiffrés et utilisés uniquement pour vérifier votre identité,
                    conformément à notre politique de confidentialité.
                  </Text>
                </View>
              </View>
            )}

            {error ? (
              <View style={styles.bannerError}>
                <MaterialIcons name="error" size={16} color={RC.error} />
                <Text style={styles.errorTextRed}>{error}</Text>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        {/* ---------- Bouton ancré au-dessus du clavier ---------- */}
        <SafeAreaView edges={['bottom']} style={[styles.footer, { paddingHorizontal: layout.gutter }]}>
          <Cta
            label={ctaLabel}
            disabled={ctaDisabled}
            loading={submitting}
            ghost={ctaGhost}
            onPress={handleNext}
            reduceMotion={reduceMotion}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
//  Sous-composants de présentation
// ============================================================================

/** Champ « ligne soulignée » (pas de boîte). */
function UnderlineField({
  label,
  required,
  optional,
  hint,
  prefix,
  mono,
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  prefix?: string;
  mono?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.uField}>
      <Text style={styles.uLabel} maxFontSizeMultiplier={1.6}>
        {label}
        {required ? <Text style={{ color: '#1B9A50' }}> *</Text> : null}
        {optional ? <Text style={styles.uOptional}> · optionnel</Text> : null}
      </Text>
      <View style={styles.uRow}>
        {prefix ? (
          <Text style={[styles.uValue, styles.uMono, styles.uPrefix]} maxFontSizeMultiplier={1.3}>
            {prefix}{' '}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor="#C9C3B4"
          selectionColor="#1B9A50"
          maxFontSizeMultiplier={1.3}
          style={[styles.uValue, mono && styles.uMono, { flex: 1 }]}
        />
      </View>
      <View style={[styles.uUnderline, focused && styles.uUnderlineOn]} />
      {hint ? <Text style={styles.help}>{hint}</Text> : null}
    </View>
  );
}

/** Zone de capture d'une pièce (vide / uploading / done / error). */
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
          {isUploading && (
            <View style={styles.docOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          {isDone && (
            <>
              <Text style={styles.docLabelDone}>{label}</Text>
              <View style={styles.docCheck}>
                <MaterialIcons name="check-circle" size={22} color="#1B9A50" />
              </View>
            </>
          )}
          {isError && (
            <View style={[styles.docCheck, { backgroundColor: 'transparent' }]}>
              <MaterialIcons name="error" size={22} color={RC.error} />
            </View>
          )}
        </>
      ) : (
        <>
          <MaterialIcons name="photo-camera" size={26} color="#15833F" />
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
  ghost,
  reduceMotion,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  ghost?: boolean;
  reduceMotion?: boolean;
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled || loading} reduceMotion={reduceMotion}>
      <View style={[styles.cta, ghost && styles.ctaGhost, (disabled || loading) && !ghost && styles.ctaDisabled]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={[styles.ctaText, ghost && styles.ctaGhostText, disabled && !ghost && styles.ctaTextDisabled]}
            maxFontSizeMultiplier={2}
          >
            {label}
          </Text>
        )}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF8F0' },

  // en-tête
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EFEADF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  segment: { height: 4, borderRadius: 3 },
  stepCount: { fontFamily: RF.uiSemi, fontSize: 12, color: '#7B8880' },

  cardZone: { paddingTop: 6, paddingBottom: 14 },

  scroll: { paddingTop: 8, paddingBottom: 20, flexGrow: 1 },

  title: { fontFamily: RF.display, fontSize: 23, letterSpacing: -0.58, color: '#121A15' },
  subtitle: { fontFamily: RF.ui, fontSize: 13.5, color: '#8A8477', marginTop: 6, lineHeight: 19 },

  // rôle
  roleCard: {
    backgroundColor: '#F2EFE7',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E6E0D2',
    padding: 16,
    marginTop: 14,
  },
  roleCardSel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1B9A50' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E8E3D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSel: { backgroundColor: '#E7F5EC' },
  roleTitle: { fontFamily: RF.uiBold, fontSize: 15.5, color: '#142019' },
  roleDesc: { fontFamily: RF.ui, fontSize: 12.5, color: '#8A8477', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D5CEBE' },
  radioSel: { borderWidth: 7, borderColor: '#1B9A50' },
  note: { fontFamily: RF.ui, fontSize: 12.5, color: '#8A8477', marginTop: 14, lineHeight: 18 },

  // champ souligné
  uField: { marginBottom: 14 },
  uLabel: { fontFamily: RF.uiBold, fontSize: 12.5, color: '#5F6A63' },
  uOptional: { fontFamily: RF.uiMed, color: '#A39D90' },
  uRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  uValue: { fontFamily: RF.uiBold, fontSize: 21, letterSpacing: -0.3, color: '#142019', paddingVertical: 2 },
  uMono: { fontFamily: RF.mono, fontSize: 22 },
  uPrefix: { color: '#A39D90' },
  uUnderline: { height: 2, backgroundColor: '#E1DBCC', marginTop: 6, borderRadius: 1 },
  uUnderlineOn: { backgroundColor: '#1B9A50' },

  help: { fontFamily: RF.ui, fontSize: 12.5, color: '#8A8477', marginTop: 10, lineHeight: 18 },

  // date
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dobBox: {
    height: 62,
    borderRadius: 14,
    backgroundColor: '#F2EFE7',
    borderWidth: 1.5,
    borderColor: '#E1DBCC',
    fontFamily: RF.mono,
    fontSize: 22,
    fontWeight: '700',
    color: '#142019',
    textAlign: 'center',
  },
  dobDM: { width: 62 },
  dobY: { width: 88 },
  dobActive: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1B9A50' },
  dobSep: { color: '#C3BDAE', fontFamily: RF.uiSemi, fontSize: 20 },

  // véhicule — grille
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vehicleTile: {
    height: 88,
    backgroundColor: '#FDFCF8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E6E0D2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vehicleTileSel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1B9A50' },
  vehicleLabel: { fontFamily: RF.uiSemi, fontSize: 14, color: '#3A443D' },
  // véhicule — chips (état saisie)
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FDFCF8',
    borderWidth: 1.5,
    borderColor: '#E6E0D2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  chipSel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1B9A50' },
  chipLabel: { fontFamily: RF.uiSemi, fontSize: 10, color: '#3A443D' },

  // champ en boîte (plaque, état navigation)
  boxLabel: { fontFamily: RF.uiSemi, fontSize: 13, color: '#5F6A63', marginBottom: 8 },
  boxInput: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E6E0D2',
    paddingHorizontal: 14,
    fontFamily: RF.uiMed,
    fontSize: 15.5,
    color: RC.ink,
  },

  // KYC
  sectionLabel: { fontFamily: RF.uiBold, fontSize: 11, letterSpacing: 1, color: '#8B9690', marginBottom: 12 },
  docRow: { flexDirection: 'row', gap: 12 },
  docZone: {
    flex: 1,
    height: 120,
    borderRadius: 16,
    borderWidth: 1.7,
    borderStyle: 'dashed',
    borderColor: '#A5CFB6',
    backgroundColor: '#EAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  docZoneDone: { borderStyle: 'solid', borderWidth: 2, borderColor: '#1B9A50' },
  docZoneError: { borderStyle: 'solid', borderWidth: 2, borderColor: RC.error },
  docLabel: { fontFamily: RF.uiBold, fontSize: 14, color: '#15833F' },
  docLabelDone: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    fontFamily: RF.uiBold,
    fontSize: 11,
    color: '#3A443D',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  docThumb: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  docOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCheck: { position: 'absolute', bottom: 6, right: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  errorTextRed: { flex: 1, color: RC.error, fontFamily: RF.uiMed, fontSize: 13, lineHeight: 18 },
  privacyCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: '#EAF5EE',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  privacyText: { flex: 1, color: '#3F5346', fontFamily: RF.ui, fontSize: 12.5, lineHeight: 18 },

  bannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },

  // footer / bouton
  footer: { paddingTop: 10, paddingBottom: 8, backgroundColor: '#FBF8F0' },
  cta: {
    backgroundColor: '#1B9A50',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#E4DCCF' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#D9D3C4' },
  ctaText: { color: '#fff', fontFamily: RF.uiBold, fontSize: 16.5 },
  ctaGhostText: { color: '#4D5A52' },
  ctaTextDisabled: { color: '#6E7A72' },
});
