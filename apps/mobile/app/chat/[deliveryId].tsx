import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMessageStore } from '@/stores/message.store';
import { useAuthStore } from '@/stores/auth.store';
import { Message } from '@/types';
import { formatTime } from '@/utils/format';
import { fontFamily } from '@/theme';

const D = {
  canvas: '#F5F2EC',
  surface: '#FBFAF6',
  ink: '#16140F',
  muted: '#938E80',
  hair: '#E8E2D6',
  greenDeep: '#15803D',
  greenSoft: '#EAF5EE',
};

const FONT = {
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semiBold: fontFamily.semiBold,
  bold: fontFamily.bold,
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    deliveryId: string;
    name?: string;
    reference?: string;
  }>();
  const deliveryId = String(params.deliveryId);
  // Prénom uniquement (pas le nom de famille) : « Léon GOUBA » → « Léon ».
  const interlocutor = params.name
    ? String(params.name).trim().split(/\s+/)[0]
    : 'Conversation';
  const reference = params.reference ? String(params.reference) : null;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const messages = useMessageStore((s) => s.byDelivery[deliveryId]);
  const loading = useMessageStore((s) => s.loading[deliveryId]);
  const load = useMessageStore((s) => s.load);
  const send = useMessageStore((s) => s.send);
  const markRead = useMessageStore((s) => s.markRead);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // 1re récupération + reset du compteur de non-lus à l'ouverture du fil.
  useEffect(() => {
    load(deliveryId);
    markRead(deliveryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  // Tout nouveau message reçu pendant qu'on regarde le fil = lu.
  useEffect(() => {
    if (messages && messages.length) markRead(deliveryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length]);

  const data = messages ?? [];

  const onSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      await send(deliveryId, body);
    } catch {
      // En cas d'échec on restaure le texte pour que l'utilisateur réessaie.
      setText(body);
    } finally {
      setSending(false);
    }
  }, [text, sending, send, deliveryId]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const mine = item.senderId === currentUserId;
      return (
        <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
              {item.body}
            </Text>
            <Text style={[styles.time, mine && styles.timeMine]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [currentUserId],
  );

  const ListEmpty = useMemo(
    () =>
      loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={D.greenDeep} />
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={D.hair} />
          <Text style={styles.emptyText}>
            Démarrez la conversation avec {interlocutor}.
          </Text>
        </View>
      ),
    [loading, interlocutor],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backBtn}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={D.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {interlocutor}
          </Text>
          {reference && (
            <Text style={styles.headerSub} numberOfLines={1}>
              Course {reference}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.hairline} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            data.length === 0 && { flex: 1 },
          ]}
          ListEmptyComponent={ListEmpty}
          onContentSizeChange={() =>
            data.length > 0 && listRef.current?.scrollToEnd({ animated: false })
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Barre de saisie */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Votre message…"
            placeholderTextColor={D.muted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnOff]}
            onPress={onSend}
            disabled={!text.trim() || sending}
            accessibilityLabel="Envoyer"
            accessibilityRole="button"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.canvas },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { color: D.ink, fontFamily: FONT.bold, fontSize: 17 },
  headerSub: { color: D.muted, fontFamily: FONT.medium, fontSize: 12.5, marginTop: 1 },
  hairline: { height: 1, backgroundColor: D.hair },

  listContent: { padding: 16, gap: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyText: { color: D.muted, fontFamily: FONT.medium, fontSize: 14, textAlign: 'center' },

  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: D.greenDeep, borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.hair,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: D.ink, fontFamily: FONT.regular, fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  time: { color: D.muted, fontFamily: FONT.regular, fontSize: 10.5, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.75)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: D.hair,
    backgroundColor: D.canvas,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.hair,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: D.ink,
    fontFamily: FONT.regular,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
});
