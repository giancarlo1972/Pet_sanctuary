import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (!error && data) setMessages(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !conversationId) return;
    setSending(true);
    const body = input.trim();
    setInput('');
    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
      }).select('id, sender_id, body, created_at').single();
      if (!error && data) {
        setMessages((prev) => [...prev, data]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Conversation</Text>
        <View style={styles.topBtn} />
      </View>
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.coral} /></View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
          <ScrollView ref={scrollRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = user && m.sender_id === user.id;
                return (
                  <View key={m.id} style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageThem]}>
                    <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{m.body}</Text>
                    <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeThem]}>{formatTime(m.created_at)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={styles.inputBar}>
            <TextInput style={styles.textInput} value={input} onChangeText={setInput} placeholder="Type a message..." placeholderTextColor={Colors.textTertiary} multiline maxLength={1000} />
            <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending} activeOpacity={0.85}>
              {sending ? <ActivityIndicator color={Colors.white} size="small" /> : <Send color={Colors.white} size={18} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesContainer: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 20 },
  emptyChat: { alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textTertiary },
  messageBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  messageMe: { alignSelf: 'flex-end', backgroundColor: Colors.coral },
  messageThem: { alignSelf: 'flex-start', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  messageText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, lineHeight: 20 },
  messageTextMe: { color: Colors.white },
  messageTextThem: { color: Colors.text },
  messageTime: { fontSize: 10, fontFamily: Fonts.regular, marginTop: 4, alignSelf: 'flex-end' },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  messageTimeThem: { color: Colors.textTertiary },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.screen, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});
