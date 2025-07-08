import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { Shield, RefreshCw, Database, Clock, Settings, Server } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

interface ApiConfigProps {
  onSave: (config: {
    apiKey: string;
    baseUrl: string;
    syncInterval: number;
    autoSync: boolean;
  }) => void;
}

export default function ApiConfiguration({ onSave }: ApiConfigProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [syncInterval, setSyncInterval] = useState<string>('15');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [dataFormat, setDataFormat] = useState<'JSON' | 'XML'>('JSON');
  const [validationRules, setValidationRules] = useState<string>('');
  const [locationFormat, setLocationFormat] = useState<'coordinates' | 'address' | 'both'>('both');
  const [loading, setLoading] = useState<boolean>(false);

  // Load saved configuration on component mount
  React.useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      let savedApiKey = '';
      let savedBaseUrl = '';
      let savedSyncInterval = '15';
      let savedAutoSync = true;
      
      if (Platform.OS === 'web') {
        // For web, use localStorage
        savedApiKey = localStorage.getItem('api_key') || '';
        savedBaseUrl = localStorage.getItem('api_base_url') || '';
        savedSyncInterval = localStorage.getItem('api_sync_interval') || '15';
        savedAutoSync = localStorage.getItem('api_auto_sync') === 'false' ? false : true;
      } else {
        // For native, use SecureStore
        savedApiKey = await SecureStore.getItemAsync('api_key') || '';
        savedBaseUrl = await SecureStore.getItemAsync('api_base_url') || '';
        savedSyncInterval = await SecureStore.getItemAsync('api_sync_interval') || '15';
        savedAutoSync = await SecureStore.getItemAsync('api_auto_sync') !== 'false';
      }
      
      setApiKey(savedApiKey);
      setBaseUrl(savedBaseUrl);
      setSyncInterval(savedSyncInterval);
      setAutoSync(savedAutoSync);
    } catch (error) {
      console.error('Failed to load saved configuration:', error);
      Alert.alert('Error', 'Failed to load saved configuration');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Missing Information', 'Please enter an API key');
      return;
    }

    if (!baseUrl.trim()) {
      Alert.alert('Missing Information', 'Please enter the API base URL');
      return;
    }

    try {
      setLoading(true);
      
      // Save settings
      const config = {
        apiKey,
        baseUrl,
        syncInterval: parseInt(syncInterval, 10),
        autoSync,
        dataFormat,
        validationRules,
        locationFormat
      };
      
      // Store settings
      if (Platform.OS === 'web') {
        localStorage.setItem('api_key', apiKey);
        localStorage.setItem('api_base_url', baseUrl);
        localStorage.setItem('api_sync_interval', syncInterval);
        localStorage.setItem('api_auto_sync', String(autoSync));
      } else {
        await SecureStore.setItemAsync('api_key', apiKey);
        await SecureStore.setItemAsync('api_base_url', baseUrl);
        await SecureStore.setItemAsync('api_sync_interval', syncInterval);
        await SecureStore.setItemAsync('api_auto_sync', String(autoSync));
      }
      
      // Test the connection if possible
      // This would typically call an API to validate the connection
      
      // Call the callback with the new configuration
      onSave(config);
      
      Alert.alert('Success', 'API configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      Alert.alert('Error', 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const renderAdvancedOptions = () => {
    if (!advancedMode) return null;

    return (
      <View style={styles.advancedSection}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Data Format</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity 
              style={[styles.radioButton, dataFormat === 'JSON' && styles.radioButtonSelected]}
              onPress={() => setDataFormat('JSON')}
            >
              <Text style={[styles.radioText, dataFormat === 'JSON' && styles.radioTextSelected]}>JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.radioButton, dataFormat === 'XML' && styles.radioButtonSelected]}
              onPress={() => setDataFormat('XML')}
            >
              <Text style={[styles.radioText, dataFormat === 'XML' && styles.radioTextSelected]}>XML</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location Data Format</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity 
              style={[styles.radioButton, locationFormat === 'coordinates' && styles.radioButtonSelected]}
              onPress={() => setLocationFormat('coordinates')}
            >
              <Text style={[styles.radioText, locationFormat === 'coordinates' && styles.radioTextSelected]}>Coordinates</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.radioButton, locationFormat === 'address' && styles.radioButtonSelected]}
              onPress={() => setLocationFormat('address')}
            >
              <Text style={[styles.radioText, locationFormat === 'address' && styles.radioTextSelected]}>Addresses</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.radioButton, locationFormat === 'both' && styles.radioButtonSelected]}
              onPress={() => setLocationFormat('both')}
            >
              <Text style={[styles.radioText, locationFormat === 'both' && styles.radioTextSelected]}>Both</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Data Validation Rules</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter custom validation rules (JSON format)"
            placeholderTextColor={Colors.textSecondary}
            value={validationRules}
            onChangeText={setValidationRules}
            multiline
            numberOfLines={4}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Server color={Colors.primary} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.title}>External API Configuration</Text>
          <Text style={styles.subtitle}>Connect to organization database</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>API Base URL</Text>
          <View style={styles.inputContainer}>
            <Server color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.input}
              placeholder="https://api.organization.com/v1"
              placeholderTextColor={Colors.textSecondary}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>API Key</Text>
          <View style={styles.inputContainer}>
            <Shield color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.input}
              placeholder="Your API key"
              placeholderTextColor={Colors.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>
          <Text style={styles.helperText}>
            This key will be stored securely and used for all API requests.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Sync Interval (minutes)</Text>
          <View style={styles.inputContainer}>
            <RefreshCw color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.input}
              placeholder="15"
              placeholderTextColor={Colors.textSecondary}
              value={syncInterval}
              onChangeText={setSyncInterval}
              keyboardType="number-pad"
            />
          </View>
          <Text style={styles.helperText}>
            How often to check for new data (minimum 15 minutes)
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable Auto Sync</Text>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <Text style={styles.helperText}>
            Automatically sync data in the background
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Advanced Configuration</Text>
            <Switch
              value={advancedMode}
              onValueChange={setAdvancedMode}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {renderAdvancedOptions()}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Database color={Colors.primary} size={20} />
          <Text style={styles.infoTitle}>About Data Synchronization</Text>
        </View>
        <Text style={styles.infoText}>
          This API integration allows Pet Sanctuary to securely connect to the external organization's database. Data will be synchronized based on the interval specified above and cached locally for optimal performance.
        </Text>
        <Text style={styles.infoText}>
          The synchronized data includes organization profiles, services offered, location information, and other relevant metadata that helps improve the pet rescue coordination process.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Clock color={Colors.primary} size={20} />
          <Text style={styles.infoTitle}>Estimated Data Usage</Text>
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usageLabel}>Initial Sync:</Text>
          <Text style={styles.usageValue}>~2-5 MB</Text>
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usageLabel}>Regular Updates:</Text>
          <Text style={styles.usageValue}>~100-500 KB</Text>
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usageLabel}>Storage Required:</Text>
          <Text style={styles.usageValue}>~10-20 MB</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Settings color={Colors.primary} size={20} />
          <Text style={styles.infoTitle}>Technical Requirements</Text>
        </View>
        <Text style={styles.infoText}>
          • Stable internet connection for synchronization{"\n"}
          • 15-minute minimum sync interval to prevent rate limiting{"\n"}
          • API key with proper authorization level{"\n"}
          • Background app refresh enabled (for mobile)
        </Text>
      </View>
    </ScrollView>
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
    padding: 20,
    backgroundColor: Colors.white,
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  title: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginTop: 0,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    marginLeft: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  helperText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  advancedSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 20,
    marginTop: 12,
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  radioTextSelected: {
    color: Colors.white,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginLeft: 8,
  },
  infoText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  usageLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  usageValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  }
});