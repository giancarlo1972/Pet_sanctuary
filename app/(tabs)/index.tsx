import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Heart, MapPin, Filter, Plus, Search, Camera, TriangleAlert as AlertTriangle, Scan, Server, Database } from 'lucide-react-native';
import { Colors, Gradients } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockPets } from '@/constants/mockData';
import Logo from '@/components/Logo';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (petId: string) => {
    setFavorites(prev =>
      prev.includes(petId)
        ? prev.filter(id => id !== petId)
        : [...prev, petId]
    );
  };

  const SmartAction = ({ 
    icon, 
    title, 
    subtitle,
    onPress,
    color = Colors.primary,
    variant = 'default'
  }: { 
    icon: React.ReactNode; 
    title: string; 
    subtitle: string;
    onPress: () => void;
    color?: string;
    variant?: 'default' | 'emergency';
  }) => (
    <TouchableOpacity 
      style={[
        styles.smartAction,
        variant === 'emergency' && styles.emergencyAction
      ]} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      <View style={[styles.smartActionIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={styles.smartActionContent}>
        <Text style={styles.smartActionTitle}>{title}</Text>
        <Text style={styles.smartActionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  const QuickAccess = ({ 
    icon, 
    title, 
    onPress,
    color = Colors.primary 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity style={styles.quickAccess} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickAccessIcon, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <Text style={styles.quickAccessText}>{title}</Text>
    </TouchableOpacity>
  );

  const renderFeaturedPet = (pet: any) => (
    <TouchableOpacity
      key={pet.id}
      style={styles.featuredCard}
      onPress={() => router.push(`/pet-details?id=${pet.id}`)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: pet.photos[0] }} style={styles.featuredImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.featuredGradient}
      >
        <View style={styles.featuredInfo}>
          <Text style={styles.featuredName}>{pet.name}</Text>
          <Text style={styles.featuredBreed}>{pet.breed}</Text>
          <View style={styles.featuredLocation}>
            <MapPin color={Colors.white} size={16} />
            <Text style={styles.featuredLocationText}>{pet.location.address}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Logo variant="horizontal" size={40} />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter color={Colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Featured Pets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Sanctuary Pets</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredContainer}
          >
            {mockPets.slice(0, 3).map(renderFeaturedPet)}
          </ScrollView>
        </View>

        {/* Nearby Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Activity</Text>
          <Text style={styles.sectionDescription}>
            Recent reports and pets in your area
          </Text>
          <View style={styles.activityContainer}>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Heart color={Colors.error} size={16} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>New rescue reported 2 miles away</Text>
                <Text style={styles.activityTime}>15 minutes ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <MapPin color={Colors.success} size={16} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>Pet found safe in Central Park</Text>
                <Text style={styles.activityTime}>1 hour ago</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Smart Favorites */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <Text style={styles.sectionDescription}>
            Clinics, shelters, admins, rescuers, and pets you've saved
          </Text>
          <View style={styles.quickAccessGrid}>
            <QuickAccess
              icon={<Heart color={Colors.error} size={20} />}
              title="Saved Pets"
              onPress={() => router.push('/favorites')}
              color={Colors.error}
            />
            <QuickAccess
              icon={<MapPin color={Colors.success} size={20} />}
              title="Locations"
              onPress={() => router.push('/location-management')}
              color={Colors.success}
            />
            <QuickAccess
              icon={<Camera color={Colors.warning} size={20} />}
              title="Gallery"
              onPress={() => router.push('/media-gallery')}
              color={Colors.warning}
            />
            <QuickAccess
              icon={<Search color={Colors.primary} size={20} />}
              title="Nearby"
              onPress={() => router.push('/search')}
              color={Colors.primary}
            />
            <QuickAccess
              icon={<Server color={Colors.secondary} size={20} />}
              title="RescueGroups"
              onPress={() => router.push('/rescuegroups-setup')}
              color={Colors.secondary}
            />
            <QuickAccess
              icon={<Database color={Colors.accent} size={20} />}
              title="Organizations"
              onPress={() => router.push('/organizations-list')}
              color={Colors.accent}
            />
          </View>
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 4,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  smartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  smartActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  smartActionContent: {
    flex: 1,
  },
  smartActionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  smartActionSubtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  quickAccess: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickAccessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickAccessText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  featuredContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  featuredCard: {
    width: width * 0.7,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  featuredInfo: {
    gap: 4,
  },
  featuredName: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  featuredBreed: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.9,
  },
  featuredLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  featuredLocationText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.8,
  },
  activityContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  activityTime: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});