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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { UserRole } from '@/types';
import { uploadImage } from '@/services/upload.service';
import {
  RC,
  RF,
  RegHero,
  Cascade,
  PressScale,
  Field,
  Animated,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from '@/components/auth/registerAtoms';

type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';
type Step = 'role' | 'identity' | 'vehicle' | 'kyc';
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

// Libellés d'étape volontairement en deux sous-flux (compte 1/2-2/2, dossier
// livreur 3/4-4/4), conformément aux maquettes.
const STEP_META: Record<Step, { idx: number; total: number }> = {
  role: { idx: 1, total: 2 },
  identity: { idx: 2, total: 2 },
  vehicle: { idx: 3, total: 4 },
  kyc: { idx: 4, total: 4 },
};

const CURRENT_YEAR = new Date().getFullYear();

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

/** Icône qui « spring » (scale + légère rotation) quand sa carte est sélectionnée. */
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

  // Driver KYC : photos pièce d'identité (recto + verso), upload par photo.
  const [front, setFront] = useState<Doc>({ status: 'empty' });
  const [back, setBack] = useState<Doc>({ status: 'empty' });
  const [submitting, setSubmitting] = useState(false);

  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  const meta = STEP_META[step];

  const handleBack = () => {
    setError('');
    if (step === 'identity') return setStep('role');
    if (step === 'vehicle') return setStep('identity');
    if (step === 'kyc') return setStep('vehicle');
    logout();
    router.replace('/(auth)/login');
  };

  const handleRoleNext = () => {
    if (!selectedRole) return;
    setStep('identity');
  };

  const validateIdentityFields = (): string | null => {
    if (firstName.trim().length < 2) return 'Entrez votre prénom (2 caractères min)';
    if (lastName.trim().length < 2) return 'Entrez votre nom (2 caractères min)';
    const dateErr = validateDate(day, month, year);
    if (dateErr) return dateErr;
    const cleanedPhone = phone.replace(/\D/g, '');
    if (
      cleanedPhone.length !== 8 &&
      !(cleanedPhone.length === 11 && cleanedPhone.startsWith('226'))
    ) {
      return 'Entrez un numéro de téléphone à 8 chiffres';
    }
    return null;
  };

  const handleIdentityNext = async () => {
    setError('');
    const err = validateIdentityFields();
    if (err) return setError(err);
    if (selectedRole === 'driver') return setStep('vehicle');
    await sendOtpAndProceed();
  };

  const handleVehicleConfirm = () => {
    if (!vehicleType) return;
    setStep('kyc');
  };

  // Prend une photo PUIS l'envoie immédiatement (statut uploading -> done/error).
  // Permet l'état par-photo de la maquette et le réessai ciblé.
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

  const docsReady = front.status === 'done' && back.status === 'done';
  const hasUploadError = front.status === 'error' || back.status === 'error';

  const handleKycSubmit = async () => {
    setError('');
    if (!docsReady) {
      // Réessaie uniquement les photos en échec / manquantes.
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

  const sendOtpAndProceed = async (
    kycExtras: { cnibPhotoUrl?: string; cnibPhotoBackUrl?: string } = {},
  ): Promise<void> => {
    if (!selectedRole) return;
    setError('');
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

  // ----- titre / sous-titre par étape -----
  const heroText: Record<Step, { title: string; sub: string }> = {
    role: {
      title: `Bienvenue sur ${appName}`,
      sub: 'Choisissez votre profil pour commencer.',
    },
    identity: {
      title: 'Vos informations',
      sub: 'Ces informations seront visibles par les autres utilisateurs.',
    },
    vehicle: {
      title: 'Votre véhicule',
      sub: 'Avec quoi effectuez-vous vos livraisons ?',
    },
    kyc: {
      title: "Justificatifs d'identité",
      sub: 'Notre équipe a besoin de vérifier ces documents avant d\'activer votre compte (24-48h).',
    },
  };

  const identityComplete = !!validateIdentityFields() === false;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <RegHero
        stepIndex={meta.idx}
        stepTotal={meta.total}
        title={heroText[step].title}
        subtitle={heroText[step].sub}
        onBack={handleBack}
        reduceMotion={reduceMotion}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View key={step}>
              {/* ---------- ÉTAPE 1 · profil ---------- */}
              {step === 'role' && (
                <>
                  {ROLES.map((role, i) => {
                    const sel = selectedRole === role.type;
                    return (
                      <Cascade key={role.type} index={i} reduceMotion={reduceMotion}>
                        <PressScale
                          reduceMotion={reduceMotion}
                          onPress={() => setSelectedRole(role.type)}
                          style={[styles.roleCard, sel && styles.cardSelected]}
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
                        </PressScale>
                      </Cascade>
                    );
                  })}
                  <Cascade index={ROLES.length} reduceMotion={reduceMotion}>
                    <Text style={styles.note}>
                      Vous pourrez modifier ces choix plus tard dans votre profil.
                    </Text>
                  </Cascade>
                </>
              )}

              {/* ---------- ÉTAPE 2 · informations ---------- */}
              {step === 'identity' && (
                <>
                  <Cascade index={0} reduceMotion={reduceMotion}>
                    <Field
                      label="Prénom"
                      required
                      placeholder="Aminata"
                      value={firstName}
                      onChangeText={setFirstName}
                      containerStyle={styles.fieldGap}
                    />
                  </Cascade>
                  <Cascade index={1} reduceMotion={reduceMotion}>
                    <Field
                      label="Nom"
                      required
                      placeholder="Ouedraogo"
                      value={lastName}
                      onChangeText={setLastName}
                      containerStyle={styles.fieldGap}
                    />
                  </Cascade>
                  <Cascade index={2} reduceMotion={reduceMotion}>
                    <View style={styles.fieldGap}>
                      <Text style={styles.dobLabel}>
                        Date de naissance <Text style={{ color: RC.gDark }}>*</Text>
                      </Text>
                      <View style={styles.dobRow}>
                        <TextInput
                          style={[styles.dobInput, styles.dobBox]}
                          placeholder="JJ"
                          placeholderTextColor={RC.muted}
                          keyboardType="number-pad"
                          maxLength={2}
                          value={day}
                          onChangeText={(t) => {
                            const v = t.replace(/\D/g, '');
                            setDay(v);
                            if (v.length === 2) monthRef.current?.focus();
                          }}
                        />
                        <Text style={styles.dobSep}>/</Text>
                        <TextInput
                          ref={monthRef}
                          style={[styles.dobInput, styles.dobBox]}
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
                          style={[styles.dobInput, styles.dobYear]}
                          placeholder="AAAA"
                          placeholderTextColor={RC.muted}
                          keyboardType="number-pad"
                          maxLength={4}
                          value={year}
                          onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
                        />
                      </View>
                      <Text style={styles.hint}>Format : JJ / MM / AAAA</Text>
                    </View>
                  </Cascade>
                  <Cascade index={3} reduceMotion={reduceMotion}>
                    <Field
                      label="Téléphone"
                      required
                      placeholder="70 12 34 56"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      containerStyle={styles.fieldGap}
                    />
                  </Cascade>
                  <Cascade index={4} reduceMotion={reduceMotion}>
                    <Field
                      label="Code de parrainage (optionnel)"
                      placeholder="Ex : AMINA22"
                      autoCapitalize="characters"
                      value={referralCode}
                      onChangeText={setReferralCode}
                      containerStyle={styles.fieldGap}
                    />
                  </Cascade>
                </>
              )}

              {/* ---------- ÉTAPE 3 · véhicule ---------- */}
              {step === 'vehicle' && (
                <>
                  <Cascade index={0} reduceMotion={reduceMotion}>
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
                  </Cascade>
                  <Cascade index={1} reduceMotion={reduceMotion}>
                    <Field
                      label="Plaque d'immatriculation (optionnel)"
                      placeholder="Ex : 11 BF 1234"
                      autoCapitalize="characters"
                      value={vehiclePlate}
                      onChangeText={setVehiclePlate}
                      hint="Laissez vide si vous avez plusieurs véhicules ou n'avez pas encore la plaque."
                      containerStyle={styles.fieldGap}
                    />
                  </Cascade>
                  <Cascade index={2} reduceMotion={reduceMotion}>
                    <View style={styles.infoCard}>
                      <MaterialIcons name="info" size={20} color={RC.gDark} />
                      <Text style={styles.infoText}>
                        Votre compte sera validé par notre équipe avant que vous puissiez
                        recevoir des courses.
                      </Text>
                    </View>
                  </Cascade>
                </>
              )}

              {/* ---------- ÉTAPE 4 · justificatifs ---------- */}
              {step === 'kyc' && (
                <>
                  <Cascade index={0} reduceMotion={reduceMotion}>
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
                          Une des photos n'a pas pu être envoyée. Vérifiez votre connexion
                          et réessayez.
                        </Text>
                      </View>
                    )}
                  </Cascade>
                  <Cascade index={1} reduceMotion={reduceMotion}>
                    <View style={styles.privacyCard}>
                      <MaterialIcons name="verified-user" size={20} color={RC.gDark} />
                      <Text style={styles.privacyText}>
                        Vos documents sont chiffrés et utilisés uniquement pour vérifier
                        votre identité, conformément à notre politique de confidentialité.
                      </Text>
                    </View>
                  </Cascade>
                </>
              )}

              {error ? (
                <View style={styles.bannerError}>
                  <MaterialIcons name="error" size={16} color={RC.error} />
                  <Text style={styles.errorTextRed}>{error}</Text>
                </View>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {/* ---------- Footer CTA ---------- */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {step === 'role' && (
            <Cta label="Continuer" disabled={!selectedRole} onPress={handleRoleNext} reduceMotion={reduceMotion} />
          )}
          {step === 'identity' && (
            <Cta
              label={selectedRole === 'driver' ? 'Continuer' : 'Créer mon compte'}
              disabled={!identityComplete}
              onPress={handleIdentityNext}
              reduceMotion={reduceMotion}
            />
          )}
          {step === 'vehicle' && (
            <Cta label="Continuer" disabled={!vehicleType} onPress={handleVehicleConfirm} reduceMotion={reduceMotion} />
          )}
          {step === 'kyc' && (
            <Cta
              label={hasUploadError ? "Réessayer l'envoi" : 'Soumettre mes documents'}
              disabled={(!docsReady && !hasUploadError) || submitting}
              loading={submitting}
              onPress={handleKycSubmit}
              reduceMotion={reduceMotion}
            />
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
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
          <Text style={styles.ctaText}>{label}</Text>
        )}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: RC.bg },
  scroll: { padding: 22, paddingBottom: 28 },

  // --- cartes profil ---
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: RC.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: RC.hair,
    padding: 16,
    marginBottom: 14,
  },
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
  roleTitle: { fontFamily: RF.uiBold, fontSize: 16, color: RC.ink },
  roleDesc: { fontFamily: RF.ui, fontSize: 12.5, color: RC.muted, marginTop: 3, lineHeight: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: RC.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: { borderColor: RC.gDark },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: RC.gDark },
  note: { fontFamily: RF.ui, fontSize: 12.5, color: RC.muted, marginTop: 4, textAlign: 'center' },

  // --- champs ---
  fieldGap: { marginBottom: 16 },
  dobLabel: { color: RC.ink, fontFamily: RF.uiSemi, fontSize: 13.5, marginBottom: 7 },
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dobInput: {
    backgroundColor: RC.surface,
    borderWidth: 1.5,
    borderColor: RC.hair,
    borderRadius: 14,
    paddingVertical: 13,
    fontFamily: RF.num,
    fontSize: 17,
    color: RC.ink,
    textAlign: 'center',
  },
  dobBox: { width: 60 },
  dobYear: { flex: 1 },
  dobSep: { color: RC.muted, fontFamily: RF.uiSemi, fontSize: 18 },
  hint: { color: RC.muted, fontFamily: RF.ui, fontSize: 12, marginTop: 6 },

  // --- véhicule ---
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  vehicleCard: {
    width: '47%',
    flexGrow: 1,
    aspectRatio: 1.5,
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

  infoCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: RC.tender,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  infoText: { flex: 1, color: '#14532d', fontFamily: RF.uiMed, fontSize: 13, lineHeight: 18 },

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
    borderTopColor: RC.hair,
    backgroundColor: RC.bg,
  },
  cta: {
    backgroundColor: RC.gDark,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#B9D8C4' },
  ctaText: { color: '#fff', fontFamily: RF.uiBold, fontSize: 16 },
});
