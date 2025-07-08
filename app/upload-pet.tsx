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
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Upload, MapPin, Calendar, Clock, Phone, Mail } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import PhotoUpload from '@/components/PhotoUpload';

interface PetReportData {
  petType: 'dog' | 'cat' | 'other';
  status: 'lost' | 'found' | 'stray' | 'rescued' | 'update';
  petName: string;
  description: string;
  distinguishingFeatures: string;
  behaviorNotes: string;
  medicalInfo: string;
  lastSeenDate: string;
  lastSeenTime: string;
  location: string;
  specificLocation: string;
  circumstances: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  alternateContact: string;
  photos: string[];
  reward: string;
}

interface ExistingPetReport {
  id: string;
  petName: string;
  petType: 'dog' | 'cat' | 'other';
  status: 'lost' | 'found' | 'stray' | 'rescued';
  lastUpdate: string;
  location: string;
  photos: string[];
  description: string;
}

export default function UploadPetScreen() {
  const { type, category } = useLocalSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showExistingReports, setShowExistingReports] = useState(type === 'update');
  const [selectedExistingReport, setSelectedExistingReport] = useState<string | null>(null);
  const [formData, setFormData] = useState<PetReportData>({
    petType: (category as 'dog' | 'cat' | 'other') || 'dog',
    status: type === 'update' ? 'update' : 'found',
    petName: '',
    description: '',
    distinguishingFeatures: '',
    behaviorNotes: '',
    medicalInfo: '',
    lastSeenDate: new Date().toISOString().split('T')[0],
    lastSeenTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
    location: '',
    specificLocation: '',
    circumstances: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    alternateContact: '',
    photos: [],
    reward: '',
  });

  const [uploading, setUploading] = useState(false);

  // Mock existing pet reports
  const [existingReports] = useState<ExistingPetReport[]>([
    {
      id: '1',
      petName: 'Luna',
      petType: 'dog',
      status: 'lost',
      lastUpdate: '2024-01-28T10:00:00Z',
      location: 'Central Park, NY',
      photos: ['https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=400'],
      description: 'Golden retriever, very friendly'
    },
    {
      id: '2',
      petName: 'Max',
      petType: 'cat',
      status: 'found',
      lastUpdate: '2024-01-27T15:30:00Z',
      location: 'Brooklyn, NY',
      photos: ['https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=400'],
      description: 'Gray tabby cat with white paws'
    },
  ]);

  const steps = [
    { title: 'Photos', subtitle: 'Add photos to help identify' },
    { title: 'Pet Info', subtitle: 'Basic pet information' },
    { title: 'Location', subtitle: 'Where was the pet seen?' },
    { title: 'Contact', subtitle: 'Your contact information' },
  ];

  const handleSelectExistingReport = (reportId: string) => {
    const report = existingReports.find(r => r.id === reportId);
    if (report) {
      setSelectedExistingReport(reportId);
      setFormData(prev => ({
        ...prev,
        petName: report.petName,
        petType: report.petType,
        description: report.description,
        location: report.location,
        photos: report.photos,
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.location || !formData.contactName || !formData.contactPhone) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (formData.photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo to help identify the pet.');
      return;
    }

    setUploading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const actionText = selectedExistingReport ? 'update' : 'pet report';
      const successMessage = selectedExistingReport 
        ? `Pet report for ${formData.petName} has been updated successfully.`
        : 'Your pet report has been submitted successfully. We\'ll notify you of any matches.';
      
      Alert.alert(
        'Report Submitted!',
        successMessage,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setUploading(false);
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
      case 0: return formData.photos.length > 0;
      case 1: return formData.description;
      case 2: return formData.location;
      case 3: return formData.contactName && formData.contactPhone;
      default: return false;
    }
  };

  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lost': return Colors.error;
      case 'found': return Colors.success;
      case 'stray': return Colors.warning;
      case 'rescued': return Colors.primary;
      default: return Colors.textSecondary;
    }
  };

  const renderExistingReportItem = ({ item }: { item: ExistingPetReport }) => (
    <TouchableOpacity
      style={[
        styles.existingReportItem,
        selectedExistingReport === item.id && styles.existingReportItemSelected
      ]}
      onPress={() => handleSelectExistingReport(item.id)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.photos[0] }} style={styles.reportItemImage} />
      <View style={styles.reportItemInfo}>
        <View style={styles.reportItemHeader}>
          <Text style={styles.reportItemName}>{item.petName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.reportItemDescription} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.reportItemLocation}>{item.location}</Text>
        <Text style={styles.reportItemTime}>Last updated: {formatLastUpdate(item.lastUpdate)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Photos
        return (
          <View style={styles.stepContent}>
            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
              maxPhotos={8}
              title="Pet Photos"
            />
          </View>
        );

      case 1: // Pet Info
        return (
          <View style={styles.stepContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pet Name</Text>
              <TextInput
                style={styles.input}
                value={formData.petName}
                onChangeText={(petName) => setFormData(prev => ({ ...prev, petName }))}
                placeholder="Enter pet's name (if known)"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Behavior Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.behaviorNotes}
                onChangeText={(behaviorNotes) => setFormData(prev => ({ ...prev, behaviorNotes }))}
                placeholder="Friendly, scared, aggressive, playful, etc."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 2: // Location
        return (
          <View style={styles.stepContent}>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <Text style={styles.inputLabel}>Date Last Seen *</Text>
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
                <Text style={styles.inputLabel}>Time Last Seen *</Text>
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

            <View style={styles.inputGroup}>
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

            <View style={styles.inputGroup}>
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

      case 3: // Contact
        return (
          <View style={styles.stepContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.contactName}
                onChangeText={(contactName) => setFormData(prev => ({ ...prev, contactName }))}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
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

            <View style={styles.inputGroup}>
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
          <Text style={styles.title}>Report Updates</Text>
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Existing Reports Selection */}
          {type === 'update' && currentStep === 0 && (
            <View style={styles.existingSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Update Existing Pet Report</Text>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setShowExistingReports(!showExistingReports)}
                >
                  <Text style={styles.toggleButtonText}>
                    {showExistingReports ? 'Create New' : 'Select Existing'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showExistingReports && (
                <View style={styles.existingReportsContainer}>
                  <Text style={styles.existingReportsDescription}>
                    Choose an existing pet report to update with new information
                  </Text>
                  <FlatList
                    data={existingReports}
                    renderItem={renderExistingReportItem}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    style={styles.existingReportsList}
                  />
                  
                  {selectedExistingReport && (
                    <View style={styles.selectedReportNotice}>
                      <Text style={styles.selectedReportText}>
                        ✓ Selected report will be updated with new information below
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

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
          disabled={!canProceed() || uploading}
        >
          <Text style={styles.nextButtonText}>
            {uploading ? 'Submitting...' : currentStep === steps.length - 1 ? 'Submit Report' : 'Next'}
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
  existingSection: {
    padding: 20,
    backgroundColor: Colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  toggleButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  existingReportsContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  existingReportsDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  existingReportsList: {
    maxHeight: 300,
  },
  existingReportItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  existingReportItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  reportItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  reportItemInfo: {
    flex: 1,
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportItemName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.semibold,
    color: Colors.white,
    textTransform: 'capitalize',
  },
  reportItemDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    marginBottom: 4,
  },
  reportItemLocation: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  reportItemTime: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectedReportNotice: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  selectedReportText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
    textAlign: 'center',
  },
  stepContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: FontSizes.md,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
});