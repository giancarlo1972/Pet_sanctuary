import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  config: ConfirmConfig | null;
  onClose: () => void;
}

export function ConfirmDialog({ config, onClose }: ConfirmDialogProps) {
  if (!config) return null;

  const handleConfirm = async () => {
    await config.onConfirm();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{config.message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{config.cancelText || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, config.destructive && styles.destructiveBtn]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmText, config.destructive && styles.destructiveText]}>
                {config.confirmText || 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ConfirmDialog;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.coral,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  destructiveBtn: {
    backgroundColor: Colors.criticalBg,
  },
  destructiveText: {
    color: Colors.critical,
  },
});
