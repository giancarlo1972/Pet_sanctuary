import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface InlineBannerProps {
  message: string;
  kind: 'error' | 'success' | 'info';
  onDismiss?: () => void;
}

export function InlineBanner({ message, kind, onDismiss }: InlineBannerProps) {
  const config = {
    error: { bg: Colors.criticalBg, color: Colors.critical, Icon: AlertCircle },
    success: { bg: Colors.tealBg, color: Colors.tealDark, Icon: CheckCircle },
    info: { bg: Colors.standardBg, color: Colors.accentDark, Icon: Info },
  }[kind];

  const Icon = config.Icon;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <Icon color={config.color} size={18} />
      <Text style={[styles.message, { color: config.color }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
          <X color={config.color} size={16} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default InlineBanner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  message: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
  },
  closeBtn: {
    padding: 4,
  },
});
