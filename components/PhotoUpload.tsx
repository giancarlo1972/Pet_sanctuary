import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  title?: string;
}

export default function PhotoUpload({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 5,
  title = "Pet Photos"
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      return true; // Web doesn't need explicit permissions
    }

    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'We need camera and photo library permissions to upload pet photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  const showImagePicker = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Maximum Photos', `You can only upload up to ${maxPhotos} photos.`);
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    if (Platform.OS === 'web') {
      // On web, directly open image library
      openImageLibrary();
    } else {
      // On mobile, show options
      Alert.alert(
        'Select Photo',
        'Choose how you want to add a photo',
        [
          { text: 'Camera', onPress: () => openCamera() },
          { text: 'Photo Library', onPress: () => openImageLibrary() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const openCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera Not Available', 'Camera is not available on web. Please use photo library.');
      return;
    }

    try {
      setUploading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newPhoto = result.assets[0].uri;
        onPhotosChange([...photos, newPhoto]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openImageLibrary = async () => {
    try {
      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: Platform.OS !== 'web', // Multiple selection not supported on web
        selectionLimit: Platform.OS !== 'web' ? maxPhotos - photos.length : 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        onPhotosChange([...photos, ...newPhotos]);
      }
    } catch (error) {
      console.error('Image library error:', error);
      Alert.alert('Error', 'Failed to select photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(updatedPhotos);
  };

  const renderPhotoItem = (uri: string, index: number) => (
    <View key={index} style={styles.photoItem}>
      <Image source={{ uri }} style={styles.photoImage} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(index)}
      >
        <X color={Colors.white} size={16} />
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => (
    <TouchableOpacity
      style={[styles.addButton, uploading && styles.addButtonDisabled]}
      onPress={showImagePicker}
      disabled={uploading || photos.length >= maxPhotos}
    >
      {uploading ? (
        <Text style={styles.addButtonText}>Uploading...</Text>
      ) : (
        <>
          <Plus color={Colors.primary} size={24} />
          <Text style={styles.addButtonText}>Add Photo</Text>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {photos.length}/{maxPhotos} photos
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photosContainer}
      >
        {photos.map((uri, index) => renderPhotoItem(uri, index))}
        {photos.length < maxPhotos && renderAddButton()}
      </ScrollView>

      {photos.length === 0 && (
        <View style={styles.emptyState}>
          <ImageIcon color={Colors.textSecondary} size={48} />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyDescription}>
            Add photos to help potential adopters fall in love with this pet
          </Text>
          <TouchableOpacity 
            style={[styles.emptyButton, uploading && styles.emptyButtonDisabled]} 
            onPress={showImagePicker}
            disabled={uploading}
          >
            <Camera color={Colors.white} size={20} />
            <Text style={styles.emptyButtonText}>
              {uploading ? 'Loading...' : 'Add First Photo'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  photosContainer: {
    paddingHorizontal: 4,
    gap: 12,
  },
  photoItem: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonDisabled: {
    opacity: 0.6,
  },
  emptyButtonText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
});