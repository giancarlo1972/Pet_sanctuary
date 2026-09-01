import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  PawPrint,
  MapPin,
  FileText,
  MessageCircle,
  CircleDot,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';

interface ConversationRow {
  id: string;
  subject_type: string;
  subject_id: string | null;
  last_message_at: string | null;
  last_read_at: string | null;
  last_body: string | null;
  last_sender_id: string | null;
  pet_name: string | null;
  pet_photo: string | null;
  report_pet_name: string | null;
  report_photo: string | null;
  report_location: string | null;
  unread: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRelative(ts: string): string {
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function subjectIcon(type: string): React.ReactNode {
  switch (type) {
    case 'report': return <MapPin color={Colors.coral} size={18} />;
    case 'pet': return <PawPrint color={Colors.teal} size={18} />;
    case 'application': return <FileText color={Colors.navy} size={18} />;
    default: return <MessageCircle color={Colors.textSecondary} size={18} />;
  }
}

function subjectTitle(row: ConversationRow): string {
  switch (row.subject_type) {
    case 'report': return row.report_pet_name || 'Report';
    case 'pet': return row.pet_name || 'Pet';
    case 'application': return row.pet_name ? `${row.pet_name} — Adoption` : 'Application';
    default: return 'Direct Message';
  }
}

function subjectSubtitle(row: ConversationRow): string {
  switch (row.subject_type) {
    case 'report': return row.report_location || '';
    case 'pet': return 'Pet inquiry';
    case 'application': return 'Adoption application';
    default: return '';
  }
}

function subjectRoute(row: ConversationRow): string {
  if (row.subject_id) {
    if (row.subject_type === 'report') return `/report-details?id=${row.subject_id}`;
    if (row.subject_type === 'pet') return `/pet-details?id=${row.subject_id}`;
    if (row.subject_type === 'application') return `/application?id=${row.subject_id}`;
  }
  return '';
}

export default function InboxScreen() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get conversations where user is a participant
    const { data: convs, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, conversations(id, subject_type, subject_id, last_message_at)')
      .eq('user_id', user.id)
      .order('last_read_at', { ascending: false });

    if (error || !convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const rows: ConversationRow[] = [];

    for (const c of convs) {
      const conv = c.conversations as any;
      if (!conv) continue;

      // Get last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, sender_id, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let petName: string | null = null;
      let petPhoto: string | null = null;
      let reportPetName: string | null = null;
      let reportPhoto: string | null = null;
      let reportLocation: string | null = null;

      if (conv.subject_id) {
        if (conv.subject_type === 'pet') {
          const { data: pet } = await supabase
            .from('pets')
            .select('name, photo_url')
            .eq('id', conv.subject_id)
            .maybeSingle();
          if (pet) { petName = pet.name; petPhoto = pet.photo_url; }
        } else if (conv.subject_type === 'report') {
          const { data: report } = await supabase
            .from('reports')
            .select('pet_name, location_address, photo_urls')
            .eq('id', conv.subject_id)
            .maybeSingle();
          if (report) {
            reportPetName = report.pet_name;
            reportLocation = report.location_address;
            reportPhoto = report.photo_urls?.[0] || null;
          }
        } else if (conv.subject_type === 'application') {
          const { data: app } = await supabase
            .from('adoption_applications')
            .select('pet_id, pets(name, photo_url)')
            .eq('id', conv.subject_id)
            .maybeSingle();
          if (app) {
            petName = (app as any).pets?.name || null;
            petPhoto = (app as any).pets?.photo_url || null;
          }
        }
      }

      const lastReadAt = c.last_read_at;
      const lastMsgTime = lastMsg?.created_at || conv.last_message_at;
      const unread = !lastReadAt || (lastMsgTime ? new Date(lastMsgTime) > new Date(lastReadAt) : false);

      rows.push({
        id: conv.id,
        subject_type: conv.subject_type,
        subject_id: conv.subject_id,
        last_message_at: lastMsgTime,
        last_read_at: lastReadAt,
        last_body: lastMsg?.body || null,
        last_sender_id: lastMsg?.sender_id || null,
        pet_name: petName,
        pet_photo: petPhoto,
        report_pet_name: reportPetName,
        report_photo: reportPhoto,
        report_location: reportLocation,
        unread,
      });
    }

    rows.sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

    setConversations(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: refresh when new messages arrive
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('inbox-updates')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadConversations()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  const openConversation = (row: ConversationRow) => {
    router.push(`/chat?conversationId=${row.id}` as any);
  };

  const renderItem = ({ item }: { item: ConversationRow }) => {
    const photo = item.pet_photo || item.report_photo;
    const title = subjectTitle(item);
    const subtitle = subjectSubtitle(item);
    const route = subjectRoute(item);

    return (
      <TouchableOpacity style={styles.convCard} onPress={() => openConversation(item)} activeOpacity={0.85}>
        <View style={styles.convThumb}>
          {photo ? (
            <SignedImage path={photo} style={styles.convPhoto} />
          ) : (
            <View style={styles.convIconWrap}>
              {subjectIcon(item.subject_type)}
            </View>
          )}
        </View>
        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <Text style={styles.convTitle} numberOfLines={1}>{title}</Text>
            {item.last_message_at && (
              <Text style={styles.convTime}>{formatRelative(item.last_message_at)}</Text>
            )}
          </View>
          {subtitle ? <Text style={styles.convSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          <Text
            style={[styles.convPreview, item.unread && styles.convPreviewUnread]}
            numberOfLines={1}
          >
            {item.last_body || 'No messages yet'}
          </Text>
        </View>
        {item.unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Inbox" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Inbox" showBack />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Please sign in to view your messages.</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Inbox" showBack />
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MessageCircle color={Colors.textTertiary} size={48} />
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptySubtext}>
              Tap "Message" on any report, pet, or application to start a conversation.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  list: { padding: 16, paddingBottom: 80 },

  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  convThumb: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  convPhoto: { width: 48, height: 48, borderRadius: 24 },
  convIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },

  convBody: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convTitle: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },
  convTime: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginLeft: 8 },
  convSubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  convPreview: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4 },
  convPreviewUnread: { fontFamily: Fonts.semibold, color: Colors.text },

  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.coral },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyText: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.textSecondary, marginTop: 16 },
  emptySubtext: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  signInBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 16 },
  signInBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
});
