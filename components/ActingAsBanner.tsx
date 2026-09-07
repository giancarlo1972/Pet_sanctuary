import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/context/AuthContext';
import { actingLabel } from '@/lib/acting-as';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

export default function ActingAsBanner() {
  const { isActing, actingAs, clearActingAs } = useAuth();
  if (!isActing || !actingAs) return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.txt} numberOfLines={1}>Acting as {actingLabel(actingAs)} · </Text>
      <TouchableOpacity onPress={() => clearActingAs()} hitSlop={8}>
        <Text style={styles.exit}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.navy,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  txt: { color: '#C8CCE0', fontFamily: Fonts.semibold, fontSize: 12 },
  exit: { color: Colors.white, fontFamily: Fonts.extrabold, fontSize: 12, textDecorationLine: 'underline' },
});
