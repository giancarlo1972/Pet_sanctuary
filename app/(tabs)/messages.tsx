import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MessageCircle, Clock, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockChats } from '@/constants/mockData';

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<'messages' | 'interactions'>('messages');
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderChatItem = ({ item }: { item: any }) => {
    const otherUser = item.participants.find((p: any) => p.role !== 'adopter');
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => router.push(`/chat?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.chatAvatar}>
          <Image 
            source={{ uri: otherUser?.avatar || item.pet?.photos[0] }} 
            style={styles.avatarImage}
          />
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherUser?.name}</Text>
            <Text style={styles.chatTime}>
              {formatTime(item.lastMessage.timestamp)}
            </Text>
          </View>
          
          {item.pet && (
            <Text style={styles.petName}>About {item.pet.name}</Text>
          )}
          
          <Text 
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.lastMessageUnread
            ]}
            numberOfLines={1}
          >
            {item.lastMessage.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MessageCircle color={Colors.textSecondary} size={64} />
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptyDescription}>
        Start a conversation with a shelter to adopt your perfect companion!
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => router.push('/search')}
      >
        <Text style={styles.exploreButtonText}>Explore Pets</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Chat & Interactions</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.newMessageButton}>
            <MessageCircle color={Colors.primary} size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'interactions' && styles.activeTab]}
          onPress={() => setActiveTab('interactions')}
        >
          <Text style={[styles.tabText, activeTab === 'interactions' && styles.activeTabText]}>
            Interactions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      {activeTab === 'messages' ? (
        <FlatList
          data={mockChats}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <View style={styles.interactionsContainer}>
          <View style={styles.interactionSection}>
            <Text style={styles.interactionTitle}>Recent Activity</Text>
            <View style={styles.interactionItem}>
              <View style={styles.interactionIcon}>
                <Heart color={Colors.error} size={20} />
              </View>
              <View style={styles.interactionContent}>
                <Text style={styles.interactionText}>Someone liked your pet Luna</Text>
                <Text style={styles.interactionTime}>2 hours ago</Text>
              </View>
            </View>
            <View style={styles.interactionItem}>
              <View style={styles.interactionIcon}>
                <MessageCircle color={Colors.primary} size={20} />
              </View>
              <View style={styles.interactionContent}>
                <Text style={styles.interactionText}>New message about Max</Text>
                <Text style={styles.interactionTime}>5 hours ago</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.interactionSection}>
            <Text style={styles.interactionTitle}>Adoption Updates</Text>
            <View style={styles.interactionItem}>
              <View style={styles.interactionIcon}>
                <Heart color={Colors.success} size={20} />
              </View>
              <View style={styles.interactionContent}>
                <Text style={styles.interactionText}>Bella found a new home!</Text>
                <Text style={styles.interactionTime}>1 day ago</Text>
              </View>
            </View>
          </View>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  newMessageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chatAvatar: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  chatTime: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  petName: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  lastMessageUnread: {
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  exploreButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  exploreButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  interactionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  interactionSection: {
    marginBottom: 24,
  },
  interactionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 12,
  },
  interactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  interactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  interactionContent: {
    flex: 1,
  },
  interactionText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  interactionTime: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});