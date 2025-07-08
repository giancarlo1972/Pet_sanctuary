import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Scan, Search, Zap, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface ChipData {
  chipId: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  lastUpdated: string;
  status: 'active' | 'lost' | 'found' | 'inactive';
  vetInfo?: string;
  medicalNotes?: string;
}

export default function ChipScannerScreen() {
  const [scanMode, setScanMode] = useState<'scan' | 'manual'>('scan');
  const [chipId, setChipId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [chipData, setChipData] = useState<ChipData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mock chip database
  const mockChipDatabase: Record<string, ChipData> = {
    '982000123456789': {
      chipId: '982000123456789',
      petName: 'Luna',
      ownerName: 'Sarah Johnson',
      ownerPhone: '(555) 123-4567',
      ownerEmail: 'sarah@email.com',
      lastUpdated: '2024-01-15T10:00:00Z',
      status: 'lost',
      vetInfo: 'City Veterinary Clinic',
      medicalNotes: 'Vaccinated, spayed, no known allergies'
    },
    '982000987654321': {
      chipId: '982000987654321',
      petName: 'Max',
      ownerName: 'John Smith',
      ownerPhone: '(555) 987-6543',
      ownerEmail: 'john@email.com',
      lastUpdated: '2024-01-20T14:30:00Z',
      status: 'active',
      vetInfo: 'Happy Paws Veterinary',
      medicalNotes: 'Recent checkup, all vaccinations current'
    }
  };

  const simulateNFCScan = async () => {
    setScanning(true);
    setError(null);
    setChipData(null);

    try {
      // Simulate NFC scan delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Randomly select a chip ID for demo
      const chipIds = Object.keys(mockChipDatabase);
      const randomChipId = chipIds[Math.floor(Math.random() * chipIds.length)];
      
      const data = mockChipDatabase[randomChipId];
      if (data) {
        setChipData(data);
        setChipId(randomChipId);
      } else {
        setError('Chip not found in database');
      }
    } catch (error) {
      setError('Failed to scan chip. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const lookupChipId = async () => {
    if (!chipId.trim()) {
      setError('Please enter a chip ID');
      return;
    }

    setError(null);
    setChipData(null);

    const data = mockChipDatabase[chipId.trim()];
    if (data) {
      setChipData(data);
    } else {
      setError('Chip ID not found in database');
    }
  };

  const handleContactOwner = () => {
    if (!chipData) return;

    Alert.alert(
      'Contact Owner',
      `Call ${chipData.ownerName} at ${chipData.ownerPhone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            // In a real app, this would open the phone dialer
            Alert.alert('Calling...', `Dialing ${chipData.ownerPhone}`);
          }
        },
      ]
    );
  };

  const handleReportFound = () => {
    if (!chipData) return;

    Alert.alert(
      'Report Pet Found',
      `Report that ${chipData.petName} has been found?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Report Found', 
          onPress: () => {
            router.push(`/lost-stray-report?type=found&chipId=${chipData.chipId}&petName=${chipData.petName}`);
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return Colors.success;
      case 'lost': return Colors.error;
      case 'found': return Colors.warning;
      case 'inactive': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle color={Colors.success} size={20} />;
      case 'lost': return <AlertCircle color={Colors.error} size={20} />;
      case 'found': return <CheckCircle color={Colors.warning} size={20} />;
      case 'inactive': return <AlertCircle color={Colors.textSecondary} size={20} />;
      default: return <AlertCircle color={Colors.textSecondary} size={20} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Chip Scanner</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === 'scan' && styles.modeButtonActive]}
            onPress={() => setScanMode('scan')}
          >
            <Scan color={scanMode === 'scan' ? Colors.white : Colors.primary} size={20} />
            <Text style={[styles.modeText, scanMode === 'scan' && styles.modeTextActive]}>
              NFC Scan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === 'manual' && styles.modeButtonActive]}
            onPress={() => setScanMode('manual')}
          >
            <Search color={scanMode === 'manual' ? Colors.white : Colors.primary} size={20} />
            <Text style={[styles.modeText, scanMode === 'manual' && styles.modeTextActive]}>
              Manual Lookup
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scan Mode */}
        {scanMode === 'scan' && (
          <View style={styles.scanSection}>
            <View style={styles.scanArea}>
              <View style={[styles.scanIndicator, scanning && styles.scanIndicatorActive]}>
                <Zap color={scanning ? Colors.primary : Colors.textSecondary} size={48} />
              </View>
              <Text style={styles.scanInstructions}>
                {Platform.OS === 'web' 
                  ? 'NFC scanning not available on web. Use manual lookup instead.'
                  : scanning 
                    ? 'Scanning for chip...' 
                    : 'Hold your device near the pet\'s chip'
                }
              </Text>
            </View>
            
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
                onPress={simulateNFCScan}
                disabled={scanning}
              >
                <Text style={styles.scanButtonText}>
                  {scanning ? 'Scanning...' : 'Start Scan'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual Mode */}
        {scanMode === 'manual' && (
          <View style={styles.manualSection}>
            <Text style={styles.manualLabel}>Enter Chip ID</Text>
            <View style={styles.manualInputContainer}>
              <TextInput
                style={styles.manualInput}
                value={chipId}
                onChangeText={setChipId}
                placeholder="e.g., 982000123456789"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.lookupButton} onPress={lookupChipId}>
                <Search color={Colors.white} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.manualHint}>
              Chip IDs are usually 15 digits long and start with 982
            </Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle color={Colors.error} size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Chip Data Display */}
        {chipData && (
          <View style={styles.chipDataContainer}>
            <View style={styles.chipDataHeader}>
              <Text style={styles.chipDataTitle}>Chip Information</Text>
              <View style={styles.statusContainer}>
                {getStatusIcon(chipData.status)}
                <Text style={[styles.statusText, { color: getStatusColor(chipData.status) }]}>
                  {chipData.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.chipDataContent}>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Chip ID:</Text>
                <Text style={styles.dataValue}>{chipData.chipId}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Pet Name:</Text>
                <Text style={styles.dataValue}>{chipData.petName}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Owner:</Text>
                <Text style={styles.dataValue}>{chipData.ownerName}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Phone:</Text>
                <Text style={styles.dataValue}>{chipData.ownerPhone}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Email:</Text>
                <Text style={styles.dataValue}>{chipData.ownerEmail}</Text>
              </View>
              {chipData.vetInfo && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Veterinarian:</Text>
                  <Text style={styles.dataValue}>{chipData.vetInfo}</Text>
                </View>
              )}
              {chipData.medicalNotes && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Medical Notes:</Text>
                  <Text style={styles.dataValue}>{chipData.medicalNotes}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.contactButton} onPress={handleContactOwner}>
                <Text style={styles.contactButtonText}>Contact Owner</Text>
              </TouchableOpacity>
              {chipData.status === 'lost' && (
                <TouchableOpacity style={styles.reportButton} onPress={handleReportFound}>
                  <Text style={styles.reportButtonText}>Report Found</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>How to Use Chip Scanner</Text>
          <Text style={styles.helpText}>
            • Use NFC scan for pets with compatible chips{'\n'}
            • Use manual lookup if you know the chip ID{'\n'}
            • Contact owners immediately if pet is reported lost{'\n'}
            • Report found pets to update their status
          </Text>
        </View>
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
    padding: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  modeTextActive: {
    color: Colors.white,
  },
  scanSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  scanArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  scanIndicator: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  scanIndicatorActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  scanInstructions: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  manualSection: {
    marginBottom: 32,
  },
  manualLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 12,
  },
  manualInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  manualInput: {
    flex: 1,
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
  lookupButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualHint: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  errorText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.medium,
    color: Colors.error,
    flex: 1,
  },
  chipDataContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chipDataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chipDataTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.bold,
  },
  chipDataContent: {
    gap: 12,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dataLabel: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    flex: 1,
  },
  dataValue: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  reportButton: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  helpSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  helpTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});