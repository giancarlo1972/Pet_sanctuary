import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, MapPin, Calendar, Clock, Phone, Mail, Bell, TriangleAlert as AlertTriangle, Heart, Camera } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import PhotoUpload from '@/components/PhotoUpload';

interface ReportData {
  reportType: 'lost' | 'stray' | 'foster' | 'support' | 'inform' | 'emergency';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  petName: string;
  petType: 'dog' | 'cat' | 'other';
  breed: string;
  size: 'small' | 'medium' | 'large';
  color: string;
  age: string;
  gender: 'male' | 'female' | 'unknown';
  description: string;
  lastSeenDate: string;
  lastSeenTime: string;
  location: string;
  specificLocation: string;
  circumstances: string;
  behaviorNotes: string;
  medicalInfo: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  alternateContact: string;
  photos: string[];
  reward: string;
  notificationSettings: {
    sms: boolean;
    email: boolean;
    push: boolean;
    radius: number;
  };
}

export default function LostStrayReportScreen() {
  const { type, category } = useLocalSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [smartSearchEnabled, setSmartSearchEnabled] = useState(useLocalSearchParams().smart_search === 'true');
  const [similarReports, setSimilarReports] = useState<any[]>([]);
  const [showSimilarReports, setShowSimilarReports] = useState(false);
  const [formData, setFormData] = useState<ReportData>({
    reportType: (type as 'lost' | 'stray' | 'foster' | 'support' | 'inform' | 'emergency') || 'lost',
    urgency: type === 'emergency' ? 'emergency' : 'medium',
    petName: '',
    petType: (category as 'dog' | 'cat' | 'other') || 'dog',
    breed: '',
    size: 'medium',
    color: '',
    age: '',
    gender: 'unknown',
    description: '',
    lastSeenDate: new Date().toISOString().split('T')[0],
    lastSeenTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
    location: '',
    specificLocation: '',
    circumstances: '',
    behaviorNotes: '',
    medicalInfo: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    alternateContact: '',
    photos: [],
    reward: '',
    notificationSettings: {
      sms: true,
      email: true,
      push: true,
      radius: 5,
    },
  });

  const [submitting, setSubmitting] = useState(false);

  const urgencyLevels = [
    { id: 'low', name: 'Low', color: Colors.success, description: 'Not urgent', icon: '🟢' },
    { id: 'medium', name: 'Medium', color: Colors.warning, description: 'Moderately urgent', icon: '🟡' },
    { id: 'high', name: 'High', color: Colors.error, description: 'Very urgent', icon: '🔴' },
    { id: 'emergency', name: 'Emergency', color: '#FF0000', description: 'Immediate help needed', icon: '🆘' },
  ];

  const petTypes = [
    { id: 'dog', name: 'Dog', icon: '🐕' },
    { id: 'cat', name: 'Cat', icon: '🐱' },
    { id: 'other', name: 'Other', icon: '🐰' },
  ];

  const sizes = [
    { id: 'small', name: 'Small', description: 'Under 25 lbs' },
    { id: 'medium', name: 'Medium', description: '25-60 lbs' },
    { id: 'large', name: 'Large', description: 'Over 60 lbs' },
  ];

  const genders = [
    { id: 'male', name: 'Male', icon: '♂️' },
    { id: 'female', name: 'Female', icon: '♀️' },
    { id: 'unknown', name: 'Unknown', icon: '❓' },
  ];

  const steps = [
    { title: 'Urgency', subtitle: 'How critical is this?' },
    { title: 'Photos', subtitle: 'Add photos to help identify' },
    { title: 'Pet Info', subtitle: 'Basic pet information' },
    { title: 'Location', subtitle: 'Where was the pet seen?' },
    { title: 'Contact', subtitle: 'Your contact information' },
  ];

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.description || !formData.location || !formData.contactName || !formData.contactPhone) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (formData.photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo to help identify the pet.');
      return;
    }

    setSubmitting(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Report Submitted!',
        `Your ${formData.reportType} report has been submitted. We'll send notifications to nearby users and shelters.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.urgency;
      case 1: return formData.photos.length > 0;
      case 2: return formData.description && formData.color;
      case 3: return formData.location;
      case 4: return formData.contactName && formData.contactPhone;
      default: return false;
    }
  };

  const getReportTypeTitle = () => {
    switch (formData.reportType) {
      case 'lost': return 'Lost Pet Report';
      case 'stray': return 'Stray Pet Report';
      case 'foster': return 'Foster Request';
      case 'support': return 'Support Request';
      case 'inform': return 'Authority Report';
      case 'emergency': return 'Emergency Report';
      default: return 'Pet Report';
    }
  };

  const SelectionButton = ({ 
    item, 
    isSelected, 
    onSelect,
    variant = 'default'
  }: { 
    item: any; 
    isSelected: boolean; 
    onSelect: () => void;
    variant?: 'default' | 'compact';
  }) => (
    <TouchableOpacity
      style={[
        variant === 'compact' ? styles.compactButton : styles.selectionButton,
        isSelected && styles.selectionButtonActive,
        isSelected && item.color && { borderColor: item.color, backgroundColor: `${item.color}10` }
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {item.icon && <Text style={styles.buttonIcon}>{item.icon}</Text>}
      <Text style={[
        styles.buttonText,
        isSelected && styles.buttonTextActive
      ]}>
        {item.name}
      </Text>
      {item.description && variant !== 'compact' && (
        <Text style={[
          styles.buttonDescription,
          isSelected && styles.buttonDescriptionActive
        ]}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Urgency
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>How critical is this situation?</Text>
              <Text style={styles.stepSubtitle}>
                This helps us prioritize and send appropriate notifications
              </Text>
            </View>
            <View style={styles.optionsGrid}>
              {urgencyLevels.map((level) => (
                <SelectionButton
                  key={level.id}
                  item={level}
                  isSelected={formData.urgency === level.id}
                  onSelect={() => setFormData(prev => ({ ...prev, urgency: level.id as any }))}
                />
              ))}
            </View>
          </View>
        );

      case 1: // Photos
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Add photos of the pet</Text>
              <Text style={styles.stepSubtitle}>
                Clear photos help others identify the pet quickly
              </Text>
            </View>
            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
              maxPhotos={8}
              title=""
            />
          </View>
        );

      case 2: // Pet Info
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Tell us about the pet</Text>
              <Text style={styles.stepSubtitle}>
                Basic information to help identify the pet
              </Text>
            </View>

            {/* Smart Search Toggle */}
            {smartSearchEnabled && (
              <View style={styles.smartSearchSection}>
                <Text style={styles.smartSearchTitle}>🔍 Smart Database Search</Text>
                <Text style={styles.smartSearchDescription}>
                  As you enter details, we'll search for similar reports to help identify possible matches.
                </Text>
                <TouchableOpacity 
                  style={styles.searchDatabaseButton}
                  onPress={() => setShowSimilarReports(true)}
                >
                  <Text style={styles.searchDatabaseButtonText}>Search Similar Reports</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.formSection}>
              <Text style={styles.sectionLabel}>Pet Type</Text>
              <View style={styles.compactGrid}>
                {petTypes.map((type) => (
                  <SelectionButton
                    key={type.id}
                    item={type}
                    isSelected={formData.petType === type.id}
                    onSelect={() => setFormData(prev => ({ ...prev, petType: type.id as any }))}
                    variant="compact"
                  />
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionLabel}>Size</Text>
              <View style={styles.compactGrid}>
                {sizes.map((size) => (
                  <SelectionButton
                    key={size.id}
                    item={size}
                    isSelected={formData.size === size.id}
                    onSelect={() => setFormData(prev => ({ ...prev, size: size.id as any }))}
                    variant="compact"
                  />
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionLabel}>Gender</Text>
              <View style={styles.compactGrid}>
                {genders.map((gender) => (
                  <SelectionButton
                    key={gender.id}
                    item={gender}
                    isSelected={formData.gender === gender.id}
                    onSelect={() => setFormData(prev => ({ ...prev, gender: gender.id as any }))}
                    variant="compact"
                  />
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Pet Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.petName}
                  onChangeText={(petName) => setFormData(prev => ({ ...prev, petName }))}
                  placeholder="If known"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={(age) => setFormData(prev => ({ ...prev, age }))}
                  placeholder="If known"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Breed</Text>
                <TextInput
                  style={styles.input}
                  value={formData.breed}
                  onChangeText={(breed) => setFormData(prev => ({ ...prev, breed }))}
                  placeholder="If known"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Color *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.color}
                  onChangeText={(color) => setFormData(prev => ({ ...prev, color }))}
                  placeholder="Primary color"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(description) => setFormData(prev => ({ ...prev, description }))}
                placeholder="Describe the pet's appearance, behavior, and any distinguishing features..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 3: // Location
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Where was the pet last seen?</Text>
              <Text style={styles.stepSubtitle}>
                Accurate location helps nearby people look out for the pet
              </Text>
            </View>

            <View style={styles.dateTimeSection}>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <Text style={styles.inputLabel}>Date *</Text>
                  <View style={styles.dateTimeInput}>
                    <Calendar color={Colors.textSecondary} size={20} />
                    <TextInput
                      style={styles.dateTimeText}
                      value={formData.lastSeenDate}
                      onChangeText={(lastSeenDate) => setFormData(prev => ({ ...prev, lastSeenDate }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>
                
                <View style={styles.dateTimeField}>
                  <Text style={styles.inputLabel}>Time *</Text>
                  <View style={styles.dateTimeInput}>
                    <Clock color={Colors.textSecondary} size={20} />
                    <TextInput
                      style={styles.dateTimeText}
                      value={formData.lastSeenTime}
                      onChangeText={(lastSeenTime) => setFormData(prev => ({ ...prev, lastSeenTime }))}
                      placeholder="HH:MM"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Location *</Text>
              <View style={styles.locationInput}>
                <MapPin color={Colors.textSecondary} size={20} />
                <TextInput
                  style={styles.locationText}
                  value={formData.location}
                  onChangeText={(location) => setFormData(prev => ({ ...prev, location }))}
                  placeholder="Address, neighborhood, or general area"
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Specific Details</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.specificLocation}
                onChangeText={(specificLocation) => setFormData(prev => ({ ...prev, specificLocation }))}
                placeholder="Nearby landmarks, exact address, or specific location details..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 4: // Contact
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Contact Information</Text>
              <Text style={styles.stepSubtitle}>
                How can people reach you if they find the pet?
              </Text>
            </View>
            
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Your Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.contactName}
                onChangeText={(contactName) => setFormData(prev => ({ ...prev, contactName }))}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.contactInput}>
                <Phone color={Colors.textSecondary} size={20} />
                <TextInput
                  style={styles.contactText}
                  value={formData.contactPhone}
                  onChangeText={(contactPhone) => setFormData(prev => ({ ...prev, contactPhone }))}
                  placeholder="Your phone number"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.contactInput}>
                <Mail color={Colors.textSecondary} size={20} />
                <TextInput
                  style={styles.contactText}
                  value={formData.contactEmail}
                  onChangeText={(contactEmail) => setFormData(prev => ({ ...prev, contactEmail }))}
                  placeholder="Your email address (optional)"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.notificationSection}>
              <Text style={styles.sectionLabel}>Notification Preferences</Text>
              <View style={styles.notificationItem}>
                <View style={styles.notificationInfo}>
                  <Text style={styles.notificationLabel}>SMS Alerts</Text>
                  <Text style={styles.notificationDescription}>Get text messages for matches</Text>
                </View>
                <Switch
                  value={formData.notificationSettings.sms}
                  onValueChange={(sms) => setFormData(prev => ({
                    ...prev,
                    notificationSettings: { ...prev.notificationSettings, sms }
                  }))}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.radiusContainer}>
                <Text style={styles.radiusLabel}>Search Radius: {formData.notificationSettings.radius} miles</Text>
                <View style={styles.radiusButtons}>
                  {[1, 5, 10, 25].map(radius => (
                    <TouchableOpacity
                      key={radius}
                      style={[
                        styles.radiusButton,
                        formData.notificationSettings.radius === radius && styles.radiusButtonActive
                      ]}
                      onPress={() => setFormData(prev => ({
                        ...prev,
                        notificationSettings: { ...prev.notificationSettings, radius }
                      }))}
                    >
                      <Text
                        style={[
                          styles.radiusButtonText,
                          formData.notificationSettings.radius === radius && styles.radiusButtonTextActive
                        ]}
                      >
                        {radius}mi
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{getReportTypeTitle()}</Text>
          <Text style={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / steps.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backActionButton} onPress={handleBack}>
            <Text style={styles.backActionText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            currentStep === 0 && styles.nextButtonFull
          ]}
          onPress={handleNext}
          disabled={!canProceed() || submitting}
        >
          <Text style={styles.nextButtonText}>
            {submitting ? 'Submitting...' : currentStep === steps.length - 1 ? 'Submit Report' : 'Next'}
          </Text>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  title: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  stepIndicator: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepContent: {
    padding: 20,
  },
  stepHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsGrid: {
    gap: 16,
  },
  selectionButton: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  compactButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  buttonTextActive: {
    color: Colors.primary,
  },
  buttonDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  buttonDescriptionActive: {
    color: Colors.text,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 12,
  },
  compactGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateTimeSection: {
    marginBottom: 24,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeField: {
    flex: 1,
  },
  dateTimeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  dateTimeText: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  contactInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  contactText: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  notificationSection: {
    marginTop: 24,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  notificationDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  radiusContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  radiusLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 12,
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  radiusButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radiusButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  radiusButtonTextActive: {
    color: Colors.white,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: Colors.white,
    gap: 12,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  backActionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  backActionText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.border,
  },
  nextButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  smartSearchSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  smartSearchTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  smartSearchDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  searchDatabaseButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  searchDatabaseButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
});