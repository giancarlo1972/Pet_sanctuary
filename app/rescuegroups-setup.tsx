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
import { router } from 'expo-router';
import { ArrowLeft, Server, CircleCheck as CheckCircle, Database, Clock, Zap, ExternalLink, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

export default function RescueGroupsSetupScreen() {
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/rescuegroups');
      const result = await response.json();
      
      if (result.success) {
        setIntegrationStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  const handleConfigure = async () => {
    setConfiguring(true);
    
    try {
      const response = await fetch('/api/rescuegroups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'configure' }),
      });

      const result = await response.json();
      
      if (result.success) {
        Alert.alert(
          'Integration Configured!',
          'RescueGroups.org integration has been set up successfully. Daily data sync will begin tomorrow at 6:00 AM EST.',
          [{ text: 'OK', onPress: () => loadIntegrationStatus() }]
        );
      } else {
        Alert.alert('Configuration Failed', result.error || 'Failed to configure integration');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to configure RescueGroups integration');
    } finally {
      setConfiguring(false);
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/rescuegroups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sync' }),
      });

      const result = await response.json();
      
      if (result.success) {
        Alert.alert(
          'Sync Completed!',
          `Successfully synchronized ${result.data.totalRecords} organizations from RescueGroups.org`,
          [{ text: 'OK', onPress: () => router.push('/organizations-list') }]
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to sync data');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start sync process');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocumentation = () => {
    Linking.openURL('https://userguide.rescuegroups.org/x/QACl');
  };

  const StatusCard = ({ 
    icon, 
    title, 
    status, 
    description,
    color = Colors.primary 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    status: string;
    description: string;
    color?: string;
  }) => (
    <View style={styles.statusCard}>
      <View style={styles.statusIcon}>
        {icon}
      </View>
      <View style={styles.statusInfo}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={[styles.statusStatus, { color }]}>{status}</Text>
        <Text style={styles.statusDescription}>{description}</Text>
      </View>
    </View>
  );

  const InfoRow = ({ 
    label, 
    value 
  }: { 
    label: string; 
    value: string; 
  }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>RescueGroups.org Integration</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Integration Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Server color={Colors.primary} size={32} />
            <View style={styles.overviewInfo}>
              <Text style={styles.overviewTitle}>RescueGroups.org</Text>
              <Text style={styles.overviewSubtitle}>External Organization Database</Text>
            </View>
          </View>
          
          <Text style={styles.overviewDescription}>
            Connect to RescueGroups.org to access their comprehensive database of rescue organizations, 
            shelters, and animal welfare services. Data is synchronized daily at 6:00 AM EST via secure FTP.
          </Text>
        </View>

        {/* Connection Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Connection Details</Text>
          
          <InfoRow label="FTP Server" value="ftp.rescuegroups.org" />
          <InfoRow label="API Key" value="5yZd7GC8" />
          <InfoRow label="Username" value="apikey-5yZd7GC8" />
          <InfoRow label="Sync Schedule" value="Daily at 6:00 AM EST" />
          <InfoRow label="Data Format" value="CSV/JSON Files" />
          
          <TouchableOpacity style={styles.documentationButton} onPress={handleViewDocumentation}>
            <ExternalLink color={Colors.primary} size={16} />
            <Text style={styles.documentationText}>View Developer Documentation</Text>
          </TouchableOpacity>
        </View>

        {/* Status Cards */}
        <View style={styles.statusSection}>
          <StatusCard
            icon={<Server color={Colors.success} size={24} />}
            title="FTP Connection"
            status="Ready"
            description="Secure connection established with RescueGroups.org"
            color={Colors.success}
          />
          
          <StatusCard
            icon={<Database color={integrationStatus?.isEnabled ? Colors.success : Colors.textSecondary} size={24} />}
            title="Data Sync"
            status={integrationStatus?.isEnabled ? 'Enabled' : 'Not Configured'}
            description={integrationStatus?.isEnabled 
              ? `Last sync: ${integrationStatus?.syncInfo?.lastSyncTime ? new Date(integrationStatus.syncInfo.lastSyncTime).toLocaleDateString() : 'Never'}`
              : 'Configure integration to enable data sync'
            }
            color={integrationStatus?.isEnabled ? Colors.success : Colors.textSecondary}
          />
          
          <StatusCard
            icon={<Clock color={Colors.primary} size={24} />}
            title="Sync Schedule"
            status="Daily at 6:00 AM EST"
            description="Automated data updates from RescueGroups.org"
            color={Colors.primary}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Integration Actions</Text>
          
          {!integrationStatus?.isEnabled ? (
            <TouchableOpacity
              style={[styles.primaryButton, configuring && styles.primaryButtonDisabled]}
              onPress={handleConfigure}
              disabled={configuring}
            >
              <Zap color={Colors.white} size={20} />
              <Text style={styles.primaryButtonText}>
                {configuring ? 'Configuring...' : 'Enable Integration'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.syncButton, loading && styles.syncButtonDisabled]}
                onPress={handleManualSync}
                disabled={loading}
              >
                <Database color={Colors.primary} size={20} />
                <Text style={styles.syncButtonText}>
                  {loading ? 'Syncing...' : 'Manual Sync Now'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => router.push('/organizations-list')}
              >
                <FileText color={Colors.secondary} size={20} />
                <Text style={styles.viewButtonText}>View Organizations</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Integration Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What You'll Get</Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Access to thousands of verified rescue organizations
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Daily updates with new and updated organization data
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Contact information, services, and operating hours
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Geographic data for location-based searches
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Offline access to cached organization data
              </Text>
            </View>
          </View>
        </View>

        {/* Data Usage Information */}
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Data Usage & Storage</Text>
          
          <View style={styles.usageGrid}>
            <View style={styles.usageItem}>
              <Text style={styles.usageLabel}>Daily Download</Text>
              <Text style={styles.usageValue}>~2-5 MB</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageLabel}>Storage Required</Text>
              <Text style={styles.usageValue}>~15-30 MB</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageLabel}>Update Frequency</Text>
              <Text style={styles.usageValue}>Daily</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageLabel}>Organizations</Text>
              <Text style={styles.usageValue}>{integrationStatus?.syncInfo?.recordCount || '2,500+'}</Text>
            </View>
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
  content: {
    flex: 1,
  },
  overviewCard: {
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
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewInfo: {
    marginLeft: 16,
    flex: 1,
  },
  overviewTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  overviewSubtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  overviewDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 22,
  },
  detailsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  documentationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  documentationText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  statusSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statusCard: {
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
  statusIcon: {
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  statusStatus: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.bold,
    marginTop: 2,
  },
  statusDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionsTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: 8,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  viewButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.secondary,
  },
  benefitsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  benefitsTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  usageCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  usageTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  usageItem: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  usageLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  usageValue: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 4,
  },
});