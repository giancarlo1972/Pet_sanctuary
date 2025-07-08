import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, Lock, User, MapPin, Eye, EyeOff } from 'lucide-react-native';
import { Colors, Gradients } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import Logo from '@/components/Logo';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'adopter',
    location: '',
  });

  const roles = [
    { id: 'adopter', name: 'Adopter', description: 'Looking to adopt a pet' },
    { id: 'shelter', name: 'Shelter', description: 'Animal shelter or rescue' },
    { id: 'foster', name: 'Foster', description: 'Provide temporary care' },
    { id: 'vet', name: 'Veterinarian', description: 'Veterinary professional' },
    { id: 'volunteer', name: 'Volunteer', description: 'Help with animal care' },
  ];

  const handleAuth = () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && (!formData.name || !formData.location)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Mock authentication
    router.replace('/(tabs)');
  };

  const InputField = ({ 
    icon, 
    placeholder, 
    value, 
    onChangeText, 
    secureTextEntry = false,
    keyboardType = 'default'
  }: {
    icon: React.ReactNode;
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: any;
  }) => (
    <View style={styles.inputContainer}>
      <View style={styles.inputIcon}>
        {icon}
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
      {placeholder === 'Password' && (
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff color={Colors.textSecondary} size={20} />
          ) : (
            <Eye color={Colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const RoleSelector = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.roleTitle}>Join Pet Sanctuary as...</Text>
      <View style={styles.roleGrid}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleCard,
              formData.role === role.id && styles.roleCardActive,
            ]}
            onPress={() => setFormData({ ...formData, role: role.id })}
          >
            <Text
              style={[
                styles.roleName,
                formData.role === role.id && styles.roleNameActive,
              ]}
            >
              {role.name}
            </Text>
            <Text
              style={[
                styles.roleDescription,
                formData.role === role.id && styles.roleDescriptionActive,
              ]}
            >
              {role.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={Gradients.primary} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Logo size={100} showText={true} />
              <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Join Our Community'}</Text>
              <Text style={styles.subtitle}>
                {isLogin
                  ? 'Sign in to continue your journey of saving lives'
                  : 'Help us create a sanctuary for every animal in need'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {!isLogin && (
                <InputField
                  icon={<User color={Colors.textSecondary} size={20} />}
                  placeholder="Full Name"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              )}

              <InputField
                icon={<Mail color={Colors.textSecondary} size={20} />}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
              />

              <InputField
                icon={<Lock color={Colors.textSecondary} size={20} />}
                placeholder="Password"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
              />

              {!isLogin && (
                <InputField
                  icon={<MapPin color={Colors.textSecondary} size={20} />}
                  placeholder="Location (City, State)"
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                />
              )}

              {!isLogin && <RoleSelector />}

              {/* Auth Button */}
              <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
                <Text style={styles.authButtonText}>
                  {isLogin ? 'Enter Sanctuary' : 'Join Sanctuary'}
                </Text>
              </TouchableOpacity>

              {/* Forgot Password */}
              {isLogin && (
                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {/* Switch Mode */}
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {isLogin ? "New to Pet Sanctuary?" : 'Already part of our sanctuary?'}
                </Text>
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.switchLink}>
                    {isLogin ? 'Join Us' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: FontSizes['4xl'],
    fontFamily: Fonts.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.regular,
    color: Colors.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  form: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  eyeIcon: {
    marginLeft: 12,
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 16,
  },
  roleGrid: {
    gap: 8,
  },
  roleCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  roleCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  roleNameActive: {
    color: Colors.white,
  },
  roleDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  roleDescriptionActive: {
    color: Colors.white,
    opacity: 0.9,
  },
  authButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  authButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.primary,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  switchText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
});