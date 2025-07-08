import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Phone, Video, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockPets, mockUsers } from '@/constants/mockData';

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'adoption_inquiry';
}

export default function ChatScreen() {
  const { id, petId, shelterId } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      senderId: '2',
      content: `Hi! I'm interested in adopting ${petId ? mockPets.find(p => p.id === petId)?.name || 'this pet' : 'Luna'}. Could you tell me more about their daily routine?`,
      timestamp: '2024-01-28T10:30:00Z',
      type: 'text',
    },
    {
      id: '2',
      senderId: '1',
      content: `Hello! ${petId ? mockPets.find(p => p.id === petId)?.name || 'Luna' : 'Luna'} is wonderful. She loves morning walks and playing fetch. Would you like to schedule a meet and greet?`,
      timestamp: '2024-01-28T11:00:00Z',
      type: 'text',
    },
    {
      id: '3',
      senderId: '2',
      content: 'That sounds perfect! What times are available this week?',
      timestamp: '2024-01-28T11:15:00Z',
      type: 'text',
    },
  ]);

  const flatListRef = useRef<FlatList>(null);
  const currentUserId = '2'; // Mock current user ID

  const pet = petId ? mockPets.find(p => p.id === petId) : mockPets[0];
  const otherUser = mockUsers.find(u => u.id === shelterId) || mockUsers[0];

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: currentUserId,
        content: message.trim(),
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setMessages(prev => [...prev, newMessage]);
      setMessage('');

      // Simulate response after 2 seconds
      setTimeout(() => {
        const responses = [
          "That's great to hear! I'll check our schedule.",
          "Let me get back to you on that.",
          "Sounds good! I'll arrange that for you.",
          "Perfect! I'll send you more details shortly.",
        ];
        
        const responseMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          senderId: otherUser.id,
          content: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date().toISOString(),
          type: 'text',
        };

        setMessages(prev => [...prev, responseMessage]);
      }, 2000);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isCurrentUser = item.senderId === currentUserId;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
      ]}>
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText,
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isCurrentUser ? styles.currentUserTime : styles.otherUserTime,
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{otherUser.name}</Text>
            {pet && (
              <Text style={styles.headerSubtitle}>About {pet.name}</Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Phone color={Colors.primary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Video color={Colors.primary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MoreHorizontal color={Colors.primary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pet Info Banner */}
      {pet && (
        <TouchableOpacity 
          style={styles.petBanner}
          onPress={() => router.push(`/pet-details?id=${pet.id}`)}
        >
          <Image source={{ uri: pet.photos[0] }} style={styles.petBannerImage} />
          <View style={styles.petBannerInfo}>
            <Text style={styles.petBannerName}>{pet.name}</Text>
            <Text style={styles.petBannerBreed}>{pet.breed}</Text>
          </View>
          <Text style={styles.petBannerAction}>View Profile</Text>
        </TouchableOpacity>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              message.trim() ? styles.sendButtonActive : styles.sendButtonInactive,
            ]}
            onPress={sendMessage}
            disabled={!message.trim()}
          >
            <Send 
              color={message.trim() ? Colors.white : Colors.textSecondary} 
              size={20} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petBannerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  petBannerInfo: {
    flex: 1,
  },
  petBannerName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  petBannerBreed: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  petBannerAction: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  messagesContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 16,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currentUserBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  currentUserText: {
    color: Colors.white,
  },
  otherUserText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  currentUserTime: {
    color: Colors.white,
    opacity: 0.8,
  },
  otherUserTime: {
    color: Colors.textSecondary,
  },
  inputContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: Colors.surface,
  },
});