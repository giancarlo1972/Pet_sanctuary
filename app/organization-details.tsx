import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Phone, Mail, Globe, Star, Clock, Building2, Users, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface OrganizationDetails {
  id: string;
  name: string;
  description: string;
  type: 'shelter' | 'rescue' | 'clinic' | 'authority';
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  location: {
    address: {
      full: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  operationalHours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  services: string[];
  animalCapacity: number;
  staffCount?: number;
  metadata: Record<string, any>;
  rating?: number;
  lastUpdated: string;
  syncedAt: string;
}

export default function OrganizationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrganizationDetails(id as string);
    }
  }, [id]);

  const loadOrganizationDetails = async (orgId: string) => {
    try {
      const response = await fetch(`/api/external-organizations?id=${orgId}`);
      const result = await response.json();

      if (result.success) {
        setOrganization(result.data);
      } else {
        Alert.alert('Error', 'Failed to load organization details');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to API');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleContact = (type: 'phone' | 'email' | 'website') => {
    if (!organization) return;

    switch (type) {
      case 'phone':
        if (organization.contactInfo.phone) {
          Linking.openURL(`tel:${organization.contactInfo.phone}`);
        }
        break;
      case 'email':
        if (organization.contactInfo.email) {
          Linking.openURL(`mailto:${organization.contactInfo.email}`);
        }
        break;
      case 'website':
        if (organization.contactInfo.website) {
          Linking.openURL(organization.contactInfo.website);
        }
        break;
    }
  };

  const handleDirections = () => {
    if (!organization) return;
    
    const { latitude, longitude } = organization.location.coordinates;
    const address = encodeURIComponent(organization.location.address.full);
    
    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://app?daddr=${latitude},${longitude}`);
    } else {
      Linking.openURL(`geo:${latitude},${longitude}?q=${address}`);
    }
  };

  const formatOperatingHours = (hours: Record<string, string>) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    return dayKeys.map((key, index) => ({
      day: days[index],
      hours: hours[key] || 'Closed',
    }));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shelter': return '🏠';
      case 'rescue': return '🚑';
      case 'clinic': return '🏥';
      case 'authority': return '🏛️';
      default: return '🏢';
    }
  };

  const InfoCard = ({ 
    icon, 
    title, 
    value,
    onPress 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    value: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.infoCard, !onPress && styles.infoCardStatic]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={styles.infoCardIcon}>
        {icon}
      </View>
      <View style={styles.infoCardContent}>
        <Text style={styles.infoCardTitle}>{title}</Text>
        <Text style={styles.infoCardValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Loading...</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading organization details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!organization) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Organization</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Organization not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{organization.name}</Text>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <Heart
            color={isFavorite ? Colors.error : Colors.textSecondary}
            size={24}
            fill={isFavorite ? Colors.error : 'none'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Organization Info */}
        <View style={styles.organizationCard}>
          <View style={styles.organizationHeader}>
            <View style={styles.typeIndicator}>
              <Text style={styles.typeIcon}>{getTypeIcon(organization.type)}</Text>
            </View>
            <View style={styles.organizationInfo}>
              <Text style={styles.organizationName}>{organization.name}</Text>
              <Text style={styles.organizationType}>
                {organization.type.charAt(0).toUpperCase() + organization.type.slice(1)}
              </Text>
              {organization.rating && (
                <View style={styles.ratingRow}>
                  <Star color={Colors.warning} size={16} fill={Colors.warning} />
                  <Text style={styles.ratingText}>{organization.rating.toFixed(1)} / 5.0</Text>
                </View>
              )}
            </View>
          </View>
          
          <Text style={styles.organizationDescription}>
            {organization.description}
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactGrid}>
            <InfoCard
              icon={<Phone color={Colors.primary} size={20} />}
              title="Phone"
              value={organization.contactInfo.phone || 'Not available'}
              onPress={organization.contactInfo.phone ? () => handleContact('phone') : undefined}
            />
            <InfoCard
              icon={<Mail color={Colors.primary} size={20} />}
              title="Email"
              value={organization.contactInfo.email || 'Not available'}
              onPress={organization.contactInfo.email ? () => handleContact('email') : undefined}
            />
            {organization.contactInfo.website && (
              <InfoCard
                icon={<Globe color={Colors.primary} size={20} />}
                title="Website"
                value="Visit Website"
                onPress={() => handleContact('website')}
              />
            )}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <TouchableOpacity style={styles.locationCard} onPress={handleDirections}>
            <MapPin color={Colors.primary} size={24} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationAddress}>{organization.location.address.full}</Text>
              <Text style={styles.locationCoords}>
                {organization.location.coordinates.latitude.toFixed(6)}, {organization.location.coordinates.longitude.toFixed(6)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services Offered</Text>
          <View style={styles.servicesGrid}>
            {organization.services.map((service, index) => (
              <View key={index} style={styles.serviceCard}>
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Organization Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Details</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Building2 color={Colors.primary} size={24} />
              <Text style={styles.statValue}>{organization.animalCapacity}</Text>
              <Text style={styles.statLabel}>Animal Capacity</Text>
            </View>
            {organization.staffCount && (
              <View style={styles.statCard}>
                <Users color={Colors.primary} size={24} />
                <Text style={styles.statValue}>{organization.staffCount}</Text>
                <Text style={styles.statLabel}>Staff Members</Text>
              </View>
            )}
          </View>
        </View>

        {/* Operating Hours */}
        {Object.keys(organization.operationalHours).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operating Hours</Text>
            <View style={styles.hoursCard}>
              {formatOperatingHours(organization.operationalHours).map((day, index) => (
                <View key={index} style={styles.hoursRow}>
                  <Text style={styles.dayText}>{day.day}</Text>
                  <Text style={styles.hoursText}>{day.hours}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata */}
        {Object.keys(organization.metadata).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            <View style={styles.metadataCard}>
              {Object.entries(organization.metadata).map(([key, value]) => (
                <View key={key} style={styles.metadataRow}>
                  <Text style={styles.metadataKey}>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:
                  </Text>
                  <Text style={styles.metadataValue}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Last Updated */}
        <View style={styles.updateInfo}>
          <Clock color={Colors.textSecondary} size={16} />
          <Text style={styles.updateText}>
            Last updated: {new Date(organization.lastUpdated).toLocaleDateString()}
          </Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
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
  title: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.semibold,
    color: Colors.error,
  },
  organizationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  organizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeIcon: {
    fontSize: 32,
  },
  organizationInfo: {
    flex: 1,
  },
  organizationName: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  organizationType: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.warning,
  },
  organizationDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 22,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  contactGrid: {
    gap: 12,
  },
  infoCard: {
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
  infoCardStatic: {
    opacity: 0.8,
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  infoCardValue: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginTop: 2,
  },
  locationCard: {
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
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationAddress: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  locationCoords: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serviceText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  hoursCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  hoursText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  metadataCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metadataKey: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    flex: 1,
  },
  metadataValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  updateText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
});