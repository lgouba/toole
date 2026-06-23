import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from './tokens';

interface DriverQuickBarProps {
  onRoute: () => void;
  onCall: () => void;
  onMessage: () => void;
  /** Compteur de messages non lus → pastille sur « Message ». */
  unread?: number;
  style?: ViewStyle;
}

/**
 * Barre d'actions flottante (carte blanche, ombre) qui chevauche le bas du
 * hood : Itinéraire (vert plein, ouvre la navigation native) · Appeler · Message.
 */
export function DriverQuickBar({
  onRoute,
  onCall,
  onMessage,
  unread = 0,
  style,
}: DriverQuickBarProps) {
  return (
    <View style={[styles.quick, style]}>
      <TouchableOpacity
        style={[styles.q, styles.qMaps]}
        onPress={onRoute}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={20} color="#fff" />
        <Text style={[styles.qLabel, styles.qLabelOn]}>Itinéraire</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.q} onPress={onCall} activeOpacity={0.85}>
        <Ionicons name="call" size={20} color={C.gDark} />
        <Text style={styles.qLabel}>Appeler</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.q} onPress={onMessage} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={20} color={C.gDark} />
        <Text style={styles.qLabel}>Message</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  quick: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 11,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  q: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  qMaps: { backgroundColor: C.gDark },
  qLabel: { fontFamily: F.uiBold, fontSize: 12, color: C.gDark },
  qLabelOn: { color: '#fff' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontFamily: F.uiBold, fontSize: 10.5 },
});
