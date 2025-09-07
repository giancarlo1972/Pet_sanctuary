import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Server, CheckCircle, AlertCircle, RefreshCw, Database, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import ApiConfiguration from '@/components/ApiConfiguration';
import syncScheduler from '@/lib/api/sync-scheduler';

export default function ApiConfigurationScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync-status');
      const result = await response.json();
      
      if (result.success) {
        setSyncStatus(result.data);
        setLastSyncTime(result.data.lastSyncTime);
        setIsConnected(result.data.status !== 'never');
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleConfigSave = async (config: any) => {
    setLoading(true);
    
    try {
      // Test the API connection
      const testResponse = await fetch('/api/external-organizations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
          'X-Base-URL': config.baseUrl,
        },
      });

      if (testResponse.ok) {
        setIsConnected(true);
        Alert.alert('Success!', 'API connection configured successfully');
        
        // Initialize the sync scheduler
        if (autoSyncEnabled) {
          syncScheduler.setSyncInterval(config.syncInterval);
          await syncScheduler.initialize();
        }
      } else {
        Alert.alert('Connection Failed', 'Failed to connect to the API. Please check your configuration.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test API connection');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/external-organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sync' }),
      });

      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Sync Started', 'Data synchronization has been initiated');
        setLastSyncTime(new Date().toISOString());
        await loadSyncStatus();
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to start synchronization');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start sync process');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrganizations = () => {
    router.push('/organizations-list');
  };

  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };

  const ConnectionStatus = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <View style={styles.statusIndicator}>
          {isConnected ? (
            <CheckCircle color={Colors.success} size={24} />
          ) : (
            <AlertCircle color={Colors.error} size={24} />
          )}
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {isConnected 
              ? 'External organization API is connected and ready'
              : 'Configure API settings to connect'
            }
          </Text>
        </View>
      </View>

      {isConnected && (
        <View style={styles.statusDetails}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Sync:</Text>
            <Text style={styles.statusValue}>{formatSyncTime(lastSyncTime)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Records:</Text>
            <Text style={styles.statusValue}>{syncStatus?.recordCount || 0}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[
              styles.statusValue,
              { color: syncStatus?.status === 'success' ? Colors.success : Colors.warning }
            ]}>
              {syncStatus?.status || 'Unknown'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const QuickActions = () => (
    <View style={styles.actionsCard}>
      <Text style={styles.actionsTitle}>Quick Actions</Text>
      
      <TouchableOpacity
        style={[styles.actionButton, !isConnected && styles.actionButtonDisabled]}
        onPress={handleManualSync}
        disabled={!isConnected || loading}
      >
        <RefreshCw color={isConnected ? Colors.primary : Colors.textSecondary} size={20} />
        <Text style={[
          styles.actionButtonText,
          !isConnected && styles.actionButtonTextDisabled
        ]}>
          {loading ? 'Syncing...' : 'Manual Sync'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, !isConnected && styles.actionButtonDisabled]}
        onPress={handleViewOrganizations}
        disabled={!isConnected}
      >
        <Database color={isConnected ? Colors.primary : Colors.textSecondary} size={20} />
        <Text style={[
          styles.actionButtonText,
          !isConnected && styles.actionButtonTextDisabled
        ]}>
          View Organizations
        </Text>
      </TouchableOpacity>

      <View style={styles.autoSyncContainer}>
        <View style={styles.autoSyncInfo}>
          <Text style={styles.autoSyncLabel}>Auto Sync</Text>
          <Text style={styles.autoSyncDescription}>
            Automatically sync data every 15 minutes
          </Text>
        </View>
        <Switch
          value={autoSyncEnabled && isConnected}
          onValueChange={setAutoSyncEnabled}
          disabled={!isConnected}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.white}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>External Organization API</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <ConnectionStatus />

        {/* Quick Actions */}
        <QuickActions />

        {/* API Configuration */}
        <View style={styles.configCard}>
          <View style={styles.configHeader}>
            <Server color={Colors.primary} size={24} />
            <Text style={styles.configTitle}>API Configuration</Text>
          </View>
          
          <ApiConfiguration onSave={handleConfigSave} />
        </View>

        {/* Integration Guide */}
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <Zap color={Colors.primary} size={24} />
            <Text style={styles.guideTitle}>Integration Benefits</Text>
          </View>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Access to comprehensive organization database
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Real-time sync of organization data and services
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Automatic updates and notifications
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Enhanced search and filtering capabilities
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle color={Colors.success} size={16} />
              <Text style={styles.benefitText}>
                Offline caching for reliable access
              </Text>
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
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  statusSubtitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  statusValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  actionButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  autoSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  autoSyncInfo: {
    flex: 1,
  },
  autoSyncLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  autoSyncDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  configCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
    gap: 12,
  },
  configTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  guideCard: {
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
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  guideTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
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
});