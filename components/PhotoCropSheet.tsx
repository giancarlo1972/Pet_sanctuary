import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  useWindowDimensions, PanResponder,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { coverScale, cropImage, frameToCrop } from '@/lib/crop-photo';
import type { Focal } from '@/lib/coalesce';

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (result: { blob: Blob; focal: Focal }) => void;
  onPickDifferent?: () => void;
};

export default function PhotoCropSheet({ visible, uri, onCancel, onConfirm, onPickDifferent }: Props) {
  const { width: winW } = useWindowDimensions();
  const frameW = Math.min(winW - 48, 560);
  const frameH = Math.round(frameW * 3 / 4);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [busy, setBusy] = useState(false);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const [tick, setTick] = useState(0);
  const drag = useRef({ x: 0, y: 0, tx: 0, ty: 0, active: false });

  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => {
      setNat({ w, h });
      const s = coverScale(w, h, frameW, frameH);
      scaleRef.current = s;
      txRef.current = 0;
      tyRef.current = 0;
      setTick((n) => n + 1);
    }, () => {});
  }, [uri, frameW, frameH]);

  const clampPan = (tx: number, ty: number, scale: number) => {
    const maxX = Math.max(0, (nat.w * scale - frameW) / 2);
    const maxY = Math.max(0, (nat.h * scale - frameH) / 2);
    return {
      tx: Math.min(maxX, Math.max(-maxX, tx)),
      ty: Math.min(maxY, Math.max(-maxY, ty)),
    };
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, g) => {
      drag.current = { x: g.moveX, y: g.moveY, tx: txRef.current, ty: tyRef.current, active: true };
    },
    onPanResponderMove: (_, g) => {
      const n = clampPan(drag.current.tx + g.dx, drag.current.ty + g.dy, scaleRef.current);
      txRef.current = n.tx;
      tyRef.current = n.ty;
      setTick((t) => t + 1);
    },
    onPanResponderRelease: () => { drag.current.active = false; },
  })).current;

  const zoom = (dir: number) => {
    const min = coverScale(nat.w, nat.h, frameW, frameH);
    const next = Math.min(min * 4, Math.max(min, scaleRef.current * (dir > 0 ? 1.15 : 1 / 1.15)));
    scaleRef.current = next;
    const n = clampPan(txRef.current, tyRef.current, next);
    txRef.current = n.tx;
    tyRef.current = n.ty;
    setTick((t) => t + 1);
  };

  const confirm = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const { crop, focal } = frameToCrop(nat.w, nat.h, frameW, frameH, scaleRef.current, txRef.current, tyRef.current);
      const blob = await cropImage(uri, crop);
      onConfirm({ blob, focal });
    } catch (e) {
      console.error('[crop]', e);
    }
    setBusy(false);
  };

  if (!visible) return null;
  void tick;
  const scale = scaleRef.current;
  const imgW = nat.w * scale;
  const imgH = nat.h * scale;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Frame the photo</Text>
          <Text style={s.sub}>Pinch or zoom, then drag inside the 4:3 frame. Overview and My Pets use this crop.</Text>
          <View
            style={[s.frame, { width: frameW, height: frameH }]}
            {...pan.panHandlers}
            // @ts-expect-error web wheel
            onWheel={(e: any) => {
              e?.preventDefault?.();
              zoom(e.deltaY < 0 ? 1 : -1);
            }}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{
                  position: 'absolute',
                  width: imgW,
                  height: imgH,
                  left: (frameW - imgW) / 2 + txRef.current,
                  top: (frameH - imgH) / 2 + tyRef.current,
                }}
                resizeMode="stretch"
              />
            ) : null}
            <View pointerEvents="none" style={s.rule} />
          </View>
          <View style={s.zoomRow}>
            <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(-1)} activeOpacity={0.85}><Text style={s.zoomTxt}>−</Text></TouchableOpacity>
            <Text style={s.hint}>Drag to reposition</Text>
            <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(1)} activeOpacity={0.85}><Text style={s.zoomTxt}>+</Text></TouchableOpacity>
          </View>
          {onPickDifferent ? (
            <TouchableOpacity onPress={onPickDifferent} activeOpacity={0.85}>
              <Text style={s.link}>Choose a different photo</Text>
            </TouchableOpacity>
          ) : null}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancel} onPress={onCancel} activeOpacity={0.85}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[s.use, busy && { opacity: 0.6 }]} onPress={confirm} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.useTxt}>Use photo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 12, alignItems: 'center' },
  title: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.navy, alignSelf: 'flex-start' },
  sub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, alignSelf: 'flex-start', lineHeight: 18 },
  frame: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: Colors.navy },
  rule: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  zoomBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  zoomTxt: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy },
  hint: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  link: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.coral },
  actions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  cancel: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  use: { flex: 1, borderRadius: 12, backgroundColor: Colors.coral, paddingVertical: 12, alignItems: 'center' },
  useTxt: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.white },
});
