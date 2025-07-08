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
import { ArrowLeft, Send, MapPin, Calendar, Clock, Phone, Mail, Camera, User, FileText, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import PhotoUpload from '@/components/PhotoUpload';

interface IncidentReportData {
  // Reporter Information
  reporterName: string;
  reporterContact: 'chat' | 'video' | 'phone' | 'email';
  reporterPhone: string;
  reporterEmail: string;
  submissionDate: string;
  submissionTime: string;

  // Incident Details
  incidentDate: string;
  incidentTime: string;
  incidentLocation: {
    address: string;
    gpsCoordinates: string;
    nearestIntersection: string;
  };
  incidentCategory: 'animal_injury' | 'lost_pet' | 'stray_animal' | 'abuse_neglect' | 'traffic_accident' | 'emergency' | 'other';
  urgency: 'immediate' | 'unknown';

  // Parties Involved
  partiesInvolved: Array<{
    type: 'person' | 'vehicle' | 'business' | 'authority';
    name: string;
    role: string;
    contact?: string;
    vehicleInfo?: {
      make: string;
      model: string;
      color: string;
      licensePlate: string;
    };
  }>;

  // Case Status
  caseNumber: string;
  currentStatus: 'reported' | 'investigating' | 'resolved' | 'closed';
  assignedAuthority: string;
  lastUpdate: string;
  nextSteps: string;

  // Supporting Documentation
  photos: string[];
  videos: string[];
  documents: string[];
  witnessStatements: string[];
  description: string;
  additionalNotes: string;
}

export default function IncidentReportScreen() {
  const { type, category } = useLocalSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<IncidentReportData>({
    // Reporter Information
    reporterName: '',
    reporterContact: 'chat',
    reporterPhone: '',
    reporterEmail: '',
    submissionDate: new Date().toISOString().split('T')[0],
    submissionTime: new Date().toTimeString().split(' ')[0].slice(0, 5),

    // Incident Details
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
    incidentLocation: {
      address: '',
      gpsCoordinates: '',
      nearestIntersection: '',
    },
    incidentCategory: (category as any) || 'emergency',
    urgency: type === 'emergency' ? 'immediate' : 'unknown',

    // Parties Involved
    partiesInvolved: [],

    // Case Status
    caseNumber: `INC-${Date.now()}`,
    currentStatus: 'reported',
    assignedAuthority: '',
    lastUpdate: new Date().toISOString(),
    nextSteps: '',

    // Supporting Documentation
    photos: [],
    videos: [],
    documents: [],
    witnessStatements: [],
    description: '',
    additionalNotes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const steps = [
    { title: 'Reporter Info', subtitle: 'Your contact information' },
    { title: 'Incident Details', subtitle: 'What happened and when' },
    { title: 'Location', subtitle: 'Where did this occur' },
    { title: 'Parties Involved', subtitle: 'People, vehicles, businesses' },
    { title: 'Documentation', subtitle: 'Photos, videos, statements' },
    { title: 'Review', subtitle: 'Confirm all information' },
  ];

  const incidentCategories = [
    { id: 'animal_injury', name: 'Animal Injury', icon: '🩹', color: Colors.error },
    { id: 'lost_pet', name: 'Lost Pet', icon: '🔍', color: Colors.warning },
    { id: 'stray_animal', name: 'Stray Animal', icon: '🐕', color: Colors.secondary },
    { id: 'abuse_neglect', name: 'Abuse/Neglect', icon: '⚠️', color: Colors.error },
    { id: 'traffic_accident', name: 'Traffic Accident', icon: '🚗', color: Colors.error },
    { id: 'emergency', name: 'Emergency', icon: '🆘', color: '#FF0000' },
    { id: 'other', name: 'Other', icon: '📝', color: Colors.textSecondary },
  ];

  const contactMethods = [
    { id: 'chat', name: 'App Chat', icon: '💬' },
    { id: 'video', name: 'Video Call', icon: '📹' },
    { id: 'phone', name: 'Phone Call', icon: '📞' },
    { id: 'email', name: 'Email', icon: '📧' },
  ];

  const urgencyLevels = [
    { 
      id: 'immediate', 
      name: 'IMMEDIATE', 
      description: 'Active emergency requiring instant response',
      color: Colors.error,
      icon: '🚨'
    },
    { 
      id: 'unknown', 
      name: 'UNKNOWN', 
      description: 'Situation where urgency cannot be determined',
      color: Colors.warning,
      icon: '❓'
    },
  ];

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.reporterName || !formData.description || !formData.incidentLocation.address) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Incident Report Submitted!',
        `Your incident report has been submitted with case number: ${formData.caseNumber}\n\nAuthorities have been notified and will respond according to the urgency level.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit incident report. Please try again.');
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
      case 0: return formData.reporterName && (formData.reporterPhone || formData.reporterEmail);
      case 1: return formData.incidentCategory && formData.urgency;
      case 2: return formData.incidentLocation.address;
      case 3: return true; // Optional step
      case 4: return formData.description;
      case 5: return true; // Review step
      default: return false;
    }
  };

  const addPartyInvolved = () => {
    setFormData(prev => ({
      ...prev,
      partiesInvolved: [
        ...prev.partiesInvolved,
        {
          type: 'person',
          name: '',
          role: '',
          contact: '',
        }
      ]
    }));
  };

  const updatePartyInvolved = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      partiesInvolved: prev.partiesInvolved.map((party, i) => 
        i === index ? { ...party, [field]: value } : party
      )
    }));
  };

  const removePartyInvolved = (index: number) => {
    setFormData(prev => ({
      ...prev,
      partiesInvolved: prev.partiesInvolved.filter((_, i) => i !== index)
    }));
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
      case 0: // Reporter Information
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Reporter Information</Text>
              <Text style={styles.stepSubtitle}>
                Your contact details for follow-up communication
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.reporterName}
                onChangeText={(reporterName) => setFormData(prev => ({ ...prev, reporterName }))}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Preferred Contact Method *</Text>
              <View style={styles.compactGrid}>
                {contactMethods.map((method) => (
                  <SelectionButton
                    key={method.id}
                    item={method}
                    isSelected={formData.reporterContact === method.id}
                    onSelect={() => setFormData(prev => ({ ...prev, reporterContact: method.id as any }))}
                    variant="compact"
                  />
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.reporterPhone}
                  onChangeText={(reporterPhone) => setFormData(prev => ({ ...prev, reporterPhone }))}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={formData.reporterEmail}
                  onChangeText={(reporterEmail) => setFormData(prev => ({ ...prev, reporterEmail }))}
                  placeholder="email@example.com"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.autoFilledSection}>
              <Text style={styles.autoFilledLabel}>Report Submission</Text>
              <Text style={styles.autoFilledText}>
                Date: {formData.submissionDate} at {formData.submissionTime}
              </Text>
            </View>
          </View>
        );

      case 1: // Incident Details
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Incident Details</Text>
              <Text style={styles.stepSubtitle}>
                What happened and when did it occur?
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Incident Category *</Text>
              <View style={styles.optionsGrid}>
                {incidentCategories.map((category) => (
                  <SelectionButton
                    key={category.id}
                    item={category}
                    isSelected={formData.incidentCategory === category.id}
                    onSelect={() => setFormData(prev => ({ ...prev, incidentCategory: category.id as any }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Urgency Classification *</Text>
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

            <View style={styles.dateTimeSection}>
              <Text style={styles.inputLabel}>Incident Date & Time *</Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <View style={styles.dateTimeInput}>
                    <Calendar color={Colors.textSecondary} size={20} />
                    <TextInput
                      style={styles.dateTimeText}
                      value={formData.incidentDate}
                      onChangeText={(incidentDate) => setFormData(prev => ({ ...prev, incidentDate }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>
                
                <View style={styles.dateTimeField}>
                  <View style={styles.dateTimeInput}>
                    <Clock color={Colors.textSecondary} size={20} />
                    <TextInput
                      style={styles.dateTimeText}
                      value={formData.incidentTime}
                      onChangeText={(incidentTime) => setFormData(prev => ({ ...prev, incidentTime }))}
                      placeholder="HH:MM"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        );

      case 2: // Location
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Incident Location</Text>
              <Text style={styles.stepSubtitle}>
                Provide as much location detail as possible
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Street Address *</Text>
              <View style={styles.locationInput}>
                <MapPin color={Colors.textSecondary} size={20} />
                <TextInput
                  style={styles.locationText}
                  value={formData.incidentLocation.address}
                  onChangeText={(address) => setFormData(prev => ({ 
                    ...prev, 
                    incidentLocation: { ...prev.incidentLocation, address }
                  }))}
                  placeholder="123 Main Street, City, State"
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>GPS Coordinates</Text>
              <TextInput
                style={styles.input}
                value={formData.incidentLocation.gpsCoordinates}
                onChangeText={(gpsCoordinates) => setFormData(prev => ({ 
                  ...prev, 
                  incidentLocation: { ...prev.incidentLocation, gpsCoordinates }
                }))}
                placeholder="40.7128, -74.0060"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Nearest Intersection</Text>
              <TextInput
                style={styles.input}
                value={formData.incidentLocation.nearestIntersection}
                onChangeText={(nearestIntersection) => setFormData(prev => ({ 
                  ...prev, 
                  incidentLocation: { ...prev.incidentLocation, nearestIntersection }
                }))}
                placeholder="Main St & Oak Ave"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>
        );

      case 3: // Parties Involved
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Parties Involved</Text>
              <Text style={styles.stepSubtitle}>
                List all individuals, vehicles, or organizations involved
              </Text>
            </View>

            {formData.partiesInvolved.map((party, index) => (
              <View key={index} style={styles.partyCard}>
                <View style={styles.partyHeader}>
                  <Text style={styles.partyTitle}>Party {index + 1}</Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePartyInvolved(index)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={party.name}
                      onChangeText={(value) => updatePartyInvolved(index, 'name', value)}
                      placeholder="Full name or business name"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={styles.inputLabel}>Role</Text>
                    <TextInput
                      style={styles.input}
                      value={party.role}
                      onChangeText={(value) => updatePartyInvolved(index, 'role', value)}
                      placeholder="Owner, witness, etc."
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Contact Information</Text>
                  <TextInput
                    style={styles.input}
                    value={party.contact || ''}
                    onChangeText={(value) => updatePartyInvolved(index, 'contact', value)}
                    placeholder="Phone number or email"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addPartyInvolved}>
              <Text style={styles.addButtonText}>+ Add Party</Text>
            </TouchableOpacity>
          </View>
        );

      case 4: // Documentation
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Supporting Documentation</Text>
              <Text style={styles.stepSubtitle}>
                Add photos, videos, and detailed description
              </Text>
            </View>

            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
              maxPhotos={10}
              title="Photos & Evidence"
            />

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Detailed Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(description) => setFormData(prev => ({ ...prev, description }))}
                placeholder="Provide a detailed description of what happened, including timeline of events, actions taken, and any relevant circumstances..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.additionalNotes}
                onChangeText={(additionalNotes) => setFormData(prev => ({ ...prev, additionalNotes }))}
                placeholder="Any additional information that might be relevant..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 5: // Review
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Review & Submit</Text>
              <Text style={styles.stepSubtitle}>
                Please review all information before submitting
              </Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Case Information</Text>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Case Number:</Text>
                <Text style={styles.reviewValue}>{formData.caseNumber}</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Status:</Text>
                <Text style={styles.reviewValue}>Reported</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Urgency:</Text>
                <Text style={[styles.reviewValue, { color: formData.urgency === 'immediate' ? Colors.error : Colors.warning }]}>
                  {formData.urgency.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Reporter</Text>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Name:</Text>
                <Text style={styles.reviewValue}>{formData.reporterName}</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Contact:</Text>
                <Text style={styles.reviewValue}>{formData.reporterPhone || formData.reporterEmail}</Text>
              </View>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Incident</Text>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Category:</Text>
                <Text style={styles.reviewValue}>
                  {incidentCategories.find(c => c.id === formData.incidentCategory)?.name}
                </Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Date/Time:</Text>
                <Text style={styles.reviewValue}>
                  {formData.incidentDate} at {formData.incidentTime}
                </Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Location:</Text>
                <Text style={styles.reviewValue}>{formData.incidentLocation.address}</Text>
              </View>
            </View>

            <View style={styles.disclaimerBox}>
              <AlertTriangle color={Colors.warning} size={20} />
              <Text style={styles.disclaimerText}>
                By submitting this report, you confirm that all information provided is accurate to the best of your knowledge. 
                False reports may result in legal consequences.
              </Text>
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
          <Text style={styles.title}>Incident Report</Text>
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
  formSection: {
    marginBottom: 24,
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
    height: 120,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  inputHalf: {
    flex: 1,
  },
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionsGrid: {
    gap: 12,
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
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    minWidth: 80,
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
  autoFilledSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  autoFilledLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  autoFilledText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  partyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  partyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  partyTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  removeButton: {
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  reviewSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    flex: 1,
  },
  reviewValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
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