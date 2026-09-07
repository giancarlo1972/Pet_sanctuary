import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

export function Card({
  children,
  identity,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  identity?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.base, identity && styles.identity, !padded && styles.noPad, style]}>
      {children}
    </View>
  );
}

/** Header / status tiles inside a Card — 1px #E8EAF0 on the tinted fill. */
export function InnerTile({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.inner, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#D9DCE6',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#26265E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    gap: 8,
  },
  identity: {
    borderColor: '#26265E',
  },
  noPad: { padding: 0, gap: 0 },
  inner: {
    borderWidth: 1,
    borderColor: '#E8EAF0',
    borderRadius: 12,
  },
});
