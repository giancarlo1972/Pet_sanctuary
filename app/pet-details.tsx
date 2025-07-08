import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Share, MapPin, Calendar, Shield, MessageCircle, Phone } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { mockPets } from '@/constants/mockData';

const { width } = Dimensions.get('window');

export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  const pet = mockPets.find(p => p.id === id);

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Pet not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleAdopt = () => {
    Alert.alert(
      'Start Adoption Process',
      `Would you like to start the adoption process for ${pet.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Start Process', 
          onPress: () => router.push(`/chat?petId=${pet.id}&shelterId=${pet.shelter.id}`)
        },
      ]
    );
  };

  const handleMessage = () => {
    router.push(`/chat?petId=${pet.id}&shelterId=${pet.shelter.id}`);
  };

  const InfoCard = ({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) => (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        {icon}
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Heart 
              color={isFavorite ? Colors.error : Colors.text} 
              size={24}
              fill={isFavorite ? Colors.error : 'none'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Share color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(index);
            }}
          >
            {pet.photos.map((photo, index) => (
              <Image key={index} source={{ uri: photo }} style={styles.petImage} />
            ))}
          </ScrollView>
          
          {/* Image Indicators */}
          <View style={styles.imageIndicators}>
            {pet.photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentImageIndex === index ? styles.activeIndicator : styles.inactiveIndicator,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Pet Info */}
        <View style={styles.petInfo}>
          <View style={styles.petHeader}>
            <View style={styles.petTitleContainer}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petBreed}>{pet.breed}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{pet.status}</Text>
            </View>
          </View>

          <View style={styles.locationContainer}>
            <MapPin color={Colors.textSecondary} size={16} />
            <Text style={styles.locationText}>{pet.location.address}</Text>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfoContainer}>
            <InfoCard
              icon={<Calendar color={Colors.primary} size={20} />}
              title="Age"
              value={`${pet.age} years old`}
            />
            <InfoCard
              icon={<Shield color={Colors.primary} size={20} />}
              title="Gender"
              value={pet.gender}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About {pet.name}</Text>
            <Text style={styles.description}>{pet.description}</Text>
          </View>

          {/* Personality Traits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personality</Text>
            <View style={styles.traitsContainer}>
              {pet.personality.map((trait, index) => (
                <View key={index} style={styles.trait}>
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Health Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Status</Text>
            <View style={styles.healthContainer}>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Vaccinated</Text>
                <Text style={[styles.healthValue, pet.healthStatus.vaccinated && styles.healthPositive]}>
                  {pet.healthStatus.vaccinated ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Spayed/Neutered</Text>
                <Text style={[styles.healthValue, pet.healthStatus.spayed && styles.healthPositive]}>
                  {pet.healthStatus.spayed ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Microchipped</Text>
                <Text style={[styles.healthValue, pet.healthStatus.microchipped && styles.healthPositive]}>
                  {pet.healthStatus.microchipped ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          </View>

          {/* Good With */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Good With</Text>
            <View style={styles.goodWithContainer}>
              <View style={styles.goodWithItem}>
                <Text style={styles.goodWithLabel}>Kids</Text>
                <Text style={[styles.goodWithValue, pet.goodWith.kids && styles.goodWithPositive]}>
                  {pet.goodWith.kids ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.goodWithItem}>
                <Text style={styles.goodWithLabel}>Dogs</Text>
                <Text style={[styles.goodWithValue, pet.goodWith.dogs && styles.goodWithPositive]}>
                  {pet.goodWith.dogs ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.goodWithItem}>
                <Text style={styles.goodWithLabel}>Cats</Text>
                <Text style={[styles.goodWithValue, pet.goodWith.cats && styles.goodWithPositive]}>
                  {pet.goodWith.cats ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          </View>

          {/* Shelter Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shelter Information</Text>
            <View style={styles.shelterContainer}>
              <Image source={{ uri: pet.shelter.avatar }} style={styles.shelterAvatar} />
              <View style={styles.shelterInfo}>
                <Text style={styles.shelterName}>{pet.shelter.name}</Text>
                <Text style={styles.shelterLocation}>{pet.location.address}</Text>
              </View>
              <TouchableOpacity style={styles.callButton}>
                <Phone color={Colors.primary} size={20} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
          <MessageCircle color={Colors.primary} size={20} />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adoptButton} onPress={handleAdopt}>
          <Text style={styles.adoptButtonText}>Adopt {pet.name}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  petImage: {
    width,
    height: 300,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeIndicator: {
    backgroundColor: Colors.white,
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  petInfo: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  petTitleContainer: {
    flex: 1,
  },
  petName: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  petBreed: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
    textTransform: 'capitalize',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  locationText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  quickInfoContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginTop: 2,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  description: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 24,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trait: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  traitText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  healthContainer: {
    gap: 12,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  healthLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  healthValue: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  healthPositive: {
    color: Colors.success,
  },
  goodWithContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  goodWithItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  goodWithLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  goodWithValue: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  goodWithPositive: {
    color: Colors.success,
  },
  shelterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  shelterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  shelterInfo: {
    flex: 1,
  },
  shelterName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  shelterLocation: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 12,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
    flex: 1,
  },
  messageButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  adoptButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flex: 2,
    alignItems: 'center',
  },
  adoptButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
});