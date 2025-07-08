import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

type PetCategory = 'dog' | 'cat' | 'other';
type ActionType = 'adoption' | 'foster' | 'support' | 'inform';

export default function PetManagementScreen() {
  const [selectedCategory, setSelectedCategory] = useState<PetCategory | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  const categories = [
    { id: 'dog', name: 'Dog', icon: '🐕', description: 'Canine companions' },
    { id: 'cat', name: 'Cat', icon: '🐱', description: 'Feline friends' },
    { id: 'other', name: 'Other', icon: '🐰', description: 'Birds, rabbits, etc.' },
  ];

  const actions = [
    { 
      id: 'adoption', 
      name: 'Ready for Adoption', 
      icon: '❤️', 
      description: 'Pet is ready for a permanent home',
      color: Colors.success 
    },
    { 
      id: 'foster', 
      name: 'Needs Foster Care', 
      icon: '🏠', 
      description: 'Pet needs temporary care',
      color: Colors.secondary 
    },
    { 
      id: 'support', 
      name: 'Needs Support', 
      icon: '💝', 
      description: 'Pet needs medical or financial help',
      color: Colors.warning 
    },
    { 
      id: 'inform', 
      name: 'Report to Authorities', 
      icon: '🚨', 
      description: 'Contact animal control services',
      color: Colors.accent 
    },
  ];

  const handleSubmit = () => {
    if (!selectedCategory || !selectedAction) return;

    if (selectedAction === 'adoption') {
      router.push('/add-pet');
    } else {
      router.push(`/lost-stray-report?type=${selectedAction}&category=${selectedCategory}`);
    }
  };

  const SelectionCard = ({ 
    item, 
    isSelected, 
    onSelect 
  }: { 
    item: any; 
    isSelected: boolean; 
    onSelect: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.selectionCard,
        isSelected && styles.selectionCardActive,
        isSelected && item.color && { borderColor: item.color, backgroundColor: `${item.color}10` }
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardIcon}>{item.icon}</Text>
        <View style={styles.cardText}>
          <Text style={[
            styles.cardTitle,
            isSelected && styles.cardTitleActive
          ]}>
            {item.name}
          </Text>
          <Text style={[
            styles.cardDescription,
            isSelected && styles.cardDescriptionActive
          ]}>
            {item.description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Add New Pet</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Pet Category */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepTitle}>What type of animal?</Text>
          </View>
          <View style={styles.optionsContainer}>
            {categories.map((category) => (
              <SelectionCard
                key={category.id}
                item={category}
                isSelected={selectedCategory === category.id}
                onSelect={() => setSelectedCategory(category.id as PetCategory)}
              />
            ))}
          </View>
        </View>

        {/* Step 2: Action Type */}
        {selectedCategory && (
          <View style={styles.step}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepTitle}>What does this pet need?</Text>
            </View>
            <View style={styles.optionsContainer}>
              {actions.map((action) => (
                <SelectionCard
                  key={action.id}
                  item={action}
                  isSelected={selectedAction === action.id}
                  onSelect={() => setSelectedAction(action.id as ActionType)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Continue Button */}
        {selectedCategory && selectedAction && (
          <View style={styles.continueSection}>
            <TouchableOpacity style={styles.continueButton} onPress={handleSubmit}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
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
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  step: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 16,
  },
  stepTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  optionsContainer: {
    gap: 12,
  },
  selectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  cardTitleActive: {
    color: Colors.primary,
  },
  cardDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cardDescriptionActive: {
    color: Colors.text,
  },
  continueSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  continueButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
});