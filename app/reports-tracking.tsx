import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, MapPin, Calendar, Clock, MessageCircle, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Eye } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface ReportStatus {
  id: string;
  title: string;
  type: 'incident' | 'lost' | 'found' | 'emergency';
  status: 'submitted' | 'investigating' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  submittedDate: string;
  lastUpdated: string;
  caseNumber: string;
  assignedTo?: string;
  location: string;
  description: string;
  updates: Array<{
    id: string;
    timestamp: string;
    message: string;
    author: string;
    type: 'status_change' | 'note' | 'action_taken';
  }>;
  nextSteps?: string;
  estimatedResolution?: string;
}

export default function ReportsTrackingScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'resolved'>('all');

  // Mock user reports data
  const [userReports] = useState<ReportStatus[]>([
    {
      id: '1',
      title: 'Lost Golden Retriever - Luna',
      type: 'lost',
      status: 'investigating',
      priority: 'high',
      submittedDate: '2024-01-28T10:30:00Z',
      lastUpdated: '2024-01-28T14:45:00Z',
      caseNumber: 'LF-2024-0128-001',
      assignedTo: 'Animal Control Officer Sarah Martinez',
      location: 'Central Park, Manhattan, NY',
      description: 'Golden Retriever missing from Central Park area during morning walk',
      updates: [
        {
          id: '1',
          timestamp: '2024-01-28T14:45:00Z',
          message: 'Case assigned to field officer. Beginning search in Central Park area.',
          author: 'Animal Control',
          type: 'status_change'
        },
        {
          id: '2',
          timestamp: '2024-01-28T12:15:00Z',
          message: 'Alert sent to nearby shelters and veterinary clinics.',
          author: 'System',
          type: 'action_taken'
        },
        {
          id: '3',
          timestamp: '2024-01-28T10:30:00Z',
          message: 'Report submitted and verified. Case opened.',
          author: 'System',
          type: 'status_change'
        }
      ],
      nextSteps: 'Continue active search in Central Park area. Monitor shelter intake reports.',
      estimatedResolution: '24-48 hours'
    },
    {
      id: '2',
      title: 'Injured Cat on Highway',
      type: 'emergency',
      status: 'resolved',
      priority: 'emergency',
      submittedDate: '2024-01-27T16:20:00Z',
      lastUpdated: '2024-01-27T18:30:00Z',
      caseNumber: 'EM-2024-0127-003',
      assignedTo: 'Emergency Response Team',
      location: 'FDR Drive, Lower Manhattan',
      description: 'Injured cat spotted on highway median, immediate rescue needed',
      updates: [
        {
          id: '1',
          timestamp: '2024-01-27T18:30:00Z',
          message: 'Cat successfully rescued and transported to emergency veterinary clinic. Injuries treated, cat is stable.',
          author: 'Emergency Response Team',
          type: 'status_change'
        },
        {
          id: '2',
          timestamp: '2024-01-27T16:45:00Z',
          message: 'Emergency team dispatched to location.',
          author: 'Dispatch',
          type: 'action_taken'
        },
        {
          id: '3',
          timestamp: '2024-01-27T16:20:00Z',
          message: 'Emergency report received. High priority case opened.',
          author: 'System',
          type: 'status_change'
        }
      ]
    },
    {
      id: '3',
      title: 'Found Dog - Owner Located',
      type: 'found',
      status: 'resolved',
      priority: 'medium',
      submittedDate: '2024-01-26T09:15:00Z',
      lastUpdated: '2024-01-26T15:20:00Z',
      caseNumber: 'FD-2024-0126-002',
      location: 'Brooklyn Bridge Park',
      description: 'Small terrier mix found wandering in park',
      updates: [
        {
          id: '1',
          timestamp: '2024-01-26T15:20:00Z',
          message: 'Owner located through microchip scan. Dog reunited with family.',
          author: 'Shelter Staff',
          type: 'status_change'
        },
        {
          id: '2',
          timestamp: '2024-01-26T11:30:00Z',
          message: 'Dog transported to local shelter for care and scanning.',
          author: 'Animal Control',
          type: 'action_taken'
        }
      ]
    }
  ]);

  const filteredReports = userReports.filter(report => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'active') return ['submitted', 'investigating', 'in-progress'].includes(report.status);
    if (selectedFilter === 'resolved') return ['resolved', 'closed'].includes(report.status);
    return true;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call to refresh data
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return Colors.primary;
      case 'investigating': return Colors.warning;
      case 'in-progress': return Colors.secondary;
      case 'resolved': return Colors.success;
      case 'closed': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <Clock color={Colors.primary} size={16} />;
      case 'investigating': return <Eye color={Colors.warning} size={16} />;
      case 'in-progress': return <AlertTriangle color={Colors.secondary} size={16} />;
      case 'resolved': return <CheckCircle color={Colors.success} size={16} />;
      case 'closed': return <CheckCircle color={Colors.textSecondary} size={16} />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return Colors.error;
      case 'high': return Colors.warning;
      case 'medium': return Colors.primary;
      case 'low': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  const renderReportItem = ({ item }: { item: ReportStatus }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => router.push(`/report-details?id=${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportTitleContainer}>
          <Text style={styles.reportTitle}>{item.title}</Text>
          <Text style={styles.caseNumber}>Case: {item.caseNumber}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        {getStatusIcon(item.status)}
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status.replace('_', ' ').toUpperCase()}
        </Text>
      </View>

      <Text style={styles.reportDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.reportDetails}>
        <View style={styles.detailRow}>
          <MapPin color={Colors.textSecondary} size={14} />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Calendar color={Colors.textSecondary} size={14} />
          <Text style={styles.detailText}>Submitted: {formatDate(item.submittedDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Clock color={Colors.textSecondary} size={14} />
          <Text style={styles.detailText}>Updated: {formatDate(item.lastUpdated)}</Text>
        </View>
      </View>

      {item.assignedTo && (
        <View style={styles.assignedContainer}>
          <Text style={styles.assignedLabel}>Assigned to:</Text>
          <Text style={styles.assignedName}>{item.assignedTo}</Text>
        </View>
      )}

      {item.nextSteps && (
        <View style={styles.nextStepsContainer}>
          <Text style={styles.nextStepsLabel}>Next Steps:</Text>
          <Text style={styles.nextStepsText}>{item.nextSteps}</Text>
        </View>
      )}

      <View style={styles.updatesBadge}>
        <MessageCircle color={Colors.primary} size={16} />
        <Text style={styles.updatesText}>{item.updates.length} updates</Text>
      </View>
    </TouchableOpacity>
  );

  const FilterTab = ({ 
    label, 
    value, 
    count 
  }: { 
    label: string; 
    value: 'all' | 'active' | 'resolved'; 
    count: number; 
  }) => (
    <TouchableOpacity
      style={[
        styles.filterTab,
        selectedFilter === value && styles.filterTabActive
      ]}
      onPress={() => setSelectedFilter(value)}
    >
      <Text style={[
        styles.filterTabText,
        selectedFilter === value && styles.filterTabTextActive
      ]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const activeCount = userReports.filter(r => ['submitted', 'investigating', 'in-progress'].includes(r.status)).length;
  const resolvedCount = userReports.filter(r => ['resolved', 'closed'].includes(r.status)).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Track Your Reports</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab label="All" value="all" count={userReports.length} />
        <FilterTab label="Active" value="active" count={activeCount} />
        <FilterTab label="Resolved" value="resolved" count={resolvedCount} />
      </View>

      {/* Reports List */}
      <FlatList
        data={filteredReports}
        renderItem={renderReportItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />
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
  },
  headerRight: {
    width: 40,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  reportCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportTitleContainer: {
    flex: 1,
  },
  reportTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  caseNumber: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.bold,
  },
  reportDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  reportDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  assignedContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  assignedLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  assignedName: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  nextStepsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  nextStepsLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  nextStepsText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 18,
  },
  updatesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  updatesText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
});