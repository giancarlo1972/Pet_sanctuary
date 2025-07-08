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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import PhotoUpload from '@/components/PhotoUpload';

interface PetFormData {
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  age: string;
  gender: 'male' | 'female';
  size: 'small' | 'medium' | 'large';
  color: string;
  description: string;
  photos: string[];
  personality: string[];
  healthStatus: {
    vaccinated: boolean;
    spayed: boolean;
    microchipped: boolean;
  };
  goodWith: {
    kids: boolean;
    dogs: boolean;
    cats: boolean;
  };
}

export default function AddPetScreen() {
  const [formData, setFormData] = useState<PetFormData>({
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    gender: 'male',
    size: 'medium',
    color: '',
    description: '',
    photos: [],
    personality: [],
    healthStatus: {
      vaccinated: false,
      spayed: false,
      microchipped: false,
    },
    goodWith: {
      kids: false,
      dogs: false,
      cats: false,
    },
  });

  const [personalityInput, setPersonalityInput] = useState('');
  const [saving, setSaving] = useState(false);

  const species = [
    { id: 'dog', name: 'Dog', icon: '🐕' },
    { id: 'cat', name: 'Cat', icon: '🐱' },
    { id: 'other', name: 'Other', icon: '🐰' },
  ];

  const sizes = [
    { id: 'small', name: 'Small' },
    { id: 'medium', name: 'Medium' },
    { id: 'large', name: 'Large' },
  ];

  const genders = [
    { id: 'male', name: 'Male' },
    { id: 'female', name: 'Female' },
  ];

  const handleSave = async () => {
    if (!formData.name || !formData.breed || !formData.age) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (formData.photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo of the pet.');
      return;
    }

    setSaving(true);

    try {
      // Here you would typically upload photos to your storage service
      // and save the pet data to your database
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Success!',
        `${formData.name} has been added to the sanctuary.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save pet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addPersonalityTrait = () => {
    if (personalityInput.trim() && !formData.personality.includes(personalityInput.trim())) {
      setFormData(prev => ({
        ...prev,
        personality: [...prev.personality, personalityInput.trim()]
      }));
      setPersonalityInput('');
    }
  };

  const removePersonalityTrait = (trait: string) => {
    setFormData(prev => ({
      ...prev,
      personality: prev.personality.filter(t => t !== trait)
    }));
  };

  const InputField = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder,
    multiline = false,
    required = false 
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    multiline?: boolean;
    required?: boolean;
  }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );

  const SelectionGroup = ({ 
    label, 
    options, 
    selectedValue, 
    onSelect,
    required = false 
  }: {
    label: string;
    options: Array<{ id: string; name: string; icon?: string }>;
    selectedValue: string;
    onSelect: (value: string) => void;
    required?: boolean;
  }) => (
    <View style={styles.selectionContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <View style={styles.selectionRow}>
        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.selectionButton,
              selectedValue === option.id && styles.selectionButtonActive
            ]}
            onPress={() => onSelect(option.id)}
          >
            {option.icon && <Text style={styles.selectionIcon}>{option.icon}</Text>}
            <Text
              style={[
                styles.selectionText,
                selectedValue === option.id && styles.selectionTextActive
              ]}
            >
              {option.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const CheckboxGroup = ({ 
    label, 
    options, 
    values, 
    onToggle 
  }: {
    label: string;
    options: Array<{ key: string; label: string }>;
    values: Record<string, boolean>;
    onToggle: (key: string) => void;
  }) => (
    <View style={styles.checkboxContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      {options.map(option => (
        <TouchableOpacity
          key={option.key}
          style={styles.checkboxRow}
          onPress={() => onToggle(option.key)}
        >
          <View style={[styles.checkbox, values[option.key] && styles.checkboxActive]}>
            {values[option.key] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Add New Pet</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Save color={Colors.white} size={20} />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
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
          {/* Photo Upload */}
          <PhotoUpload
            photos={formData.photos}
            onPhotosChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
            maxPhotos={5}
            title="Pet Photos"
          />

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <InputField
              label="Pet Name"
              value={formData.name}
              onChangeText={(name) => setFormData(prev => ({ ...prev, name }))}
              placeholder="Enter pet's name"
              required
            />

            <SelectionGroup
              label="Species"
              options={species}
              selectedValue={formData.species}
              onSelect={(species) => setFormData(prev => ({ ...prev, species: species as any }))}
              required
            />

            <InputField
              label="Breed"
              value={formData.breed}
              onChangeText={(breed) => setFormData(prev => ({ ...prev, breed }))}
              placeholder="Enter breed"
              required
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <InputField
                  label="Age (years)"
                  value={formData.age}
                  onChangeText={(age) => setFormData(prev => ({ ...prev, age }))}
                  placeholder="Age"
                  required
                />
              </View>
              <View style={styles.halfWidth}>
                <InputField
                  label="Color"
                  value={formData.color}
                  onChangeText={(color) => setFormData(prev => ({ ...prev, color }))}
                  placeholder="Color"
                />
              </View>
            </View>

            <SelectionGroup
              label="Gender"
              options={genders}
              selectedValue={formData.gender}
              onSelect={(gender) => setFormData(prev => ({ ...prev, gender: gender as any }))}
              required
            />

            <SelectionGroup
              label="Size"
              options={sizes}
              selectedValue={formData.size}
              onSelect={(size) => setFormData(prev => ({ ...prev, size: size as any }))}
              required
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <InputField
              label="About this pet"
              value={formData.description}
              onChangeText={(description) => setFormData(prev => ({ ...prev, description }))}
              placeholder="Tell potential adopters about this pet's personality, habits, and what makes them special..."
              multiline
            />
          </View>

          {/* Personality Traits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personality Traits</Text>
            <View style={styles.personalityInput}>
              <TextInput
                style={styles.personalityTextInput}
                value={personalityInput}
                onChangeText={setPersonalityInput}
                placeholder="Add a personality trait"
                placeholderTextColor={Colors.textSecondary}
                onSubmitEditing={addPersonalityTrait}
              />
              <TouchableOpacity style={styles.addTraitButton} onPress={addPersonalityTrait}>
                <Text style={styles.addTraitButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.traitsContainer}>
              {formData.personality.map((trait, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.trait}
                  onPress={() => removePersonalityTrait(trait)}
                >
                  <Text style={styles.traitText}>{trait}</Text>
                  <Text style={styles.traitRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Health Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Status</Text>
            <CheckboxGroup
              label=""
              options={[
                { key: 'vaccinated', label: 'Vaccinated' },
                { key: 'spayed', label: 'Spayed/Neutered' },
                { key: 'microchipped', label: 'Microchipped' },
              ]}
              values={formData.healthStatus}
              onToggle={(key) => setFormData(prev => ({
                ...prev,
                healthStatus: { ...prev.healthStatus, [key]: !prev.healthStatus[key as keyof typeof prev.healthStatus] }
              }))}
            />
          </View>

          {/* Good With */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Good With</Text>
            <CheckboxGroup
              label=""
              options={[
                { key: 'kids', label: 'Children' },
                { key: 'dogs', label: 'Other Dogs' },
                { key: 'cats', label: 'Cats' },
              ]}
              values={formData.goodWith}
              onToggle={(key) => setFormData(prev => ({
                ...prev,
                goodWith: { ...prev.goodWith, [key]: !prev.goodWith[key as keyof typeof prev.goodWith] }
              }))}
            />
          </View>
        </ScrollView>
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
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  selectionContainer: {
    marginBottom: 16,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 8,
  },
  selectionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectionIcon: {
    fontSize: 20,
  },
  selectionText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  selectionTextActive: {
    color: Colors.white,
  },
  personalityInput: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  personalityTextInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addTraitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  addTraitButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trait: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  traitText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  traitRemove: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: FontSizes.sm,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  checkboxLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
});