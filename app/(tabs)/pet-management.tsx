import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FileText, Heart, Upload, Search, TriangleAlert as AlertTriangle, ArrowRight, Shield, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

type ReportCategory = 'incident' | 'animals-at-risk' | 'pet-updates';

export default function ReportsHubScreen() {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [isAnimalsAtRisk, setIsAnimalsAtRisk] = useState<boolean | null>(null);
  const [updateType, setUpdateType] = useState<'update' | 'new' | null>(null);

  const reportCategories = [
    {
      id: 'incident',
      name: 'Incident Reports',
      icon: <FileText color={Colors.error} size={28} />,
      description: 'Report emergencies, accidents, and general incidents',
      color: Colors.error,
      count: 3
    },
    {
      id: 'animals-at-risk',
      name: 'Animals at Risk',
      icon: <AlertTriangle color={Colors.warning} size={28} />,
      description: 'Report pets or animals in immediate danger',
      color: Colors.warning,
      count: 7
    },
    {
      id: 'pet-updates',
      name: 'Pet Updates',
      icon: <Upload color={Colors.primary} size={28} />,
      description: 'Follow up on existing cases and reports',
      color: Colors.primary,
      count: 12
    }
  ];

  const quickActions = [
    {
      name: 'Search Database',
      icon: <Search color={Colors.primary} size={20} />,
      description: 'Find existing reports by characteristics',
      action: () => router.push('/reports-search')
    },
    {
      name: 'Emergency Contact',
      icon: <Shield color={Colors.error} size={20} />,
      description: 'Direct contact with authorities',
      action: () => Alert.alert('Emergency', 'Calling local emergency services...')
    },
    {
      name: 'Track Reports',
      icon: <MapPin color={Colors.success} size={20} />,
      description: 'Monitor status of your reports',
      action: () => router.push('/reports-tracking')
    }
  ];

  const handleCategorySelect = (categoryId: ReportCategory) => {
    setSelectedCategory(categoryId);
    
    if (categoryId === 'incident') {
      // Don't proceed immediately, show Animals at Risk question
      setIsAnimalsAtRisk(null);
      setUpdateType(null);
    } else if (categoryId === 'animals-at-risk') {
      setIsAnimalsAtRisk(null);
      setUpdateType(null);
      // Show update vs new question directly
    } else if (categoryId === 'pet-updates') {
      // Go directly to pet updates
      router.push('/upload-pet?type=update');
    }
  };

  const handleAnimalsAtRiskResponse = (isAtRisk: boolean) => {
    setIsAnimalsAtRisk(isAtRisk);
    
    if (isAtRisk) {
      // Show update vs new question
      setUpdateType(null);
    } else {
      // Go to general incident report
      router.push('/incident-report?type=general');
    }
  };

  const handleUpdateTypeResponse = (type: 'update' | 'new') => {
    setUpdateType(type);
    
    if (type === 'update') {
      router.push('/upload-pet?type=update&category=animals-at-risk');
    } else {
      router.push('/lost-stray-report?type=found&smart_search=true');
    }
  };

  const CategoryCard = ({ 
    category, 
    isSelected, 
    onSelect 
  }: { 
    category: any; 
    isSelected: boolean; 
    onSelect: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        isSelected && { ...styles.categoryCardActive, borderColor: category.color }
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIconContainer, { backgroundColor: `${category.color}15` }]}>
          {category.icon}
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryCount}>{category.count}</Text>
        </View>
      </View>
      
      <Text style={[styles.categoryName, isSelected && { color: category.color }]}>
        {category.name}
      </Text>
      <Text style={styles.categoryDescription}>{category.description}</Text>
      
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <ArrowRight color={category.color} size={20} />
        </View>
      )}
    </TouchableOpacity>
  );

  const QuestionCard = ({ 
    title, 
    options, 
    onSelect 
  }: { 
    title: string; 
    options: Array<{ label: string; value: any; color?: string }>; 
    onSelect: (value: any) => void; 
  }) => (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{title}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              option.color && { borderColor: option.color }
            ]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.optionText,
              option.color && { color: option.color }
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reports Hub</Text>
        <Text style={styles.subtitle}>Comprehensive reporting system for pet safety</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickAction}
                onPress={action.action}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  {action.icon}
                </View>
                <Text style={styles.quickActionName}>{action.name}</Text>
                <Text style={styles.quickActionDescription}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Report Categories */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Report Categories</Text>
          <View style={styles.categoriesGrid}>
            {reportCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                isSelected={selectedCategory === category.id}
                onSelect={() => handleCategorySelect(category.id as ReportCategory)}
              />
            ))}
          </View>
        </View>

        {/* Conditional Questions */}
        {selectedCategory === 'incident' && isAnimalsAtRisk === null && (
          <QuestionCard
            title="Is this related to animals at risk?"
            options={[
              { label: 'Yes, animals in danger', value: true, color: Colors.error },
              { label: 'No, general incident', value: false, color: Colors.textSecondary }
            ]}
            onSelect={handleAnimalsAtRiskResponse}
          />
        )}

        {(selectedCategory === 'animals-at-risk' || (selectedCategory === 'incident' && isAnimalsAtRisk === true)) && updateType === null && (
          <QuestionCard
            title="Is this an update or a new report?"
            options={[
              { label: 'Update existing case', value: 'update', color: Colors.primary },
              { label: 'New report', value: 'new', color: Colors.success }
            ]}
            onSelect={handleUpdateTypeResponse}
          />
        )}

        {/* Smart Suggestions */}
        {selectedCategory && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>Smart Suggestions</Text>
            <View style={styles.suggestionCard}>
              <View style={styles.suggestionIcon}>
                <Search color={Colors.primary} size={20} />
              </View>
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionTitle}>Database Search Available</Text>
                <Text style={styles.suggestionDescription}>
                  We can help you find similar reports based on location, animal characteristics, and timing.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Emergency Banner */}
        <View style={styles.emergencyBanner}>
          <View style={styles.emergencyContent}>
            <AlertTriangle color={Colors.white} size={24} />
            <View style={styles.emergencyText}>
              <Text style={styles.emergencyTitle}>Emergency Situation?</Text>
              <Text style={styles.emergencyDescription}>
                For immediate life-threatening emergencies, call 911 first
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.emergencyButton}
            onPress={() => router.push('/incident-report?type=emergency')}
          >
            <Text style={styles.emergencyButtonText}>Emergency Report</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  quickActionsSection: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionName: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  categoriesSection: {
    padding: 20,
  },
  categoriesGrid: {
    gap: 16,
  },
  categoryCard: {
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
  categoryCardActive: {
    backgroundColor: Colors.surface,
    elevation: 4,
    shadowOpacity: 0.15,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  categoryCount: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  categoryName: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  categoryDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  questionCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  questionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  suggestionsSection: {
    padding: 20,
    paddingTop: 0,
  },
  suggestionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  emergencyBanner: {
    margin: 20,
    backgroundColor: Colors.error,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  emergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyText: {
    flex: 1,
    marginLeft: 12,
  },
  emergencyTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.white,
    opacity: 0.9,
    lineHeight: 18,
  },
  emergencyButton: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emergencyButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.error,
  },
});