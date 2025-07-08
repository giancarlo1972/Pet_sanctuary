import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, LinearGradient, Defs, Stop } from 'react-native-svg';
import { Colors } from '@/constants/Colors';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'icon' | 'horizontal';
  showText?: boolean;
}

export default function Logo({ size = 60, variant = 'full', showText = true }: LogoProps) {
  const iconSize = variant === 'horizontal' ? size * 0.8 : size;
  
  const LogoIcon = () => (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="1" />
          <Stop offset="100%" stopColor="#6B46C1" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFE66D" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFD700" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      
      {/* Sanctuary Shield Background */}
      <Path
        d="M50 10 C65 10 75 20 75 35 L75 55 C75 75 50 90 50 90 C50 90 25 75 25 55 L25 35 C25 20 35 10 50 10 Z"
        fill="url(#gradient1)"
      />
      
      {/* Inner Heart Shape (representing love for pets) */}
      <Path
        d="M50 70 C45 65 30 55 30 45 C30 40 35 35 40 35 C45 35 50 40 50 40 C50 40 55 35 60 35 C65 35 70 40 70 45 C70 55 55 65 50 70 Z"
        fill="white"
        opacity="0.95"
      />
      
      {/* Pet Ears (Cat/Dog) */}
      <Path
        d="M42 30 L38 20 L46 25 Z"
        fill="url(#gradient2)"
      />
      <Path
        d="M58 30 L54 25 L62 20 Z"
        fill="url(#gradient2)"
      />
      
      {/* Pet Face Elements */}
      <Circle cx="45" cy="48" r="2" fill="#6B46C1" />
      <Circle cx="55" cy="48" r="2" fill="#6B46C1" />
      
      {/* Nose */}
      <Path
        d="M50 52 L48 55 L52 55 Z"
        fill="#6B46C1"
      />
      
      {/* Protective Hands */}
      <Path
        d="M15 45 C12 42 12 38 15 35 C18 32 22 32 25 35 L25 50 C22 53 18 53 15 50 Z"
        fill="url(#gradient2)"
        opacity="0.8"
      />
      <Path
        d="M85 45 C88 42 88 38 85 35 C82 32 78 32 75 35 L75 50 C78 53 82 53 85 50 Z"
        fill="url(#gradient2)"
        opacity="0.8"
      />
    </Svg>
  );

  if (variant === 'icon') {
    return <LogoIcon />;
  }

  return (
    <View style={[
      styles.container,
      variant === 'horizontal' && styles.horizontal
    ]}>
      <LogoIcon />
      {showText && (
        <View style={[
          styles.textContainer,
          variant === 'horizontal' && styles.textHorizontal
        ]}>
          <Svg 
            width={variant === 'horizontal' ? size * 2.5 : size * 2} 
            height={variant === 'horizontal' ? size * 0.4 : size * 0.5} 
            viewBox="0 0 200 40"
          >
            <Defs>
              <LinearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#6B46C1" stopOpacity="1" />
                <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <text
              x="100"
              y="15"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="url(#textGradient)"
              fontFamily="Inter-Bold"
            >
              Pet Sanctuary
            </text>
            <text
              x="100"
              y="32"
              textAnchor="middle"
              fontSize="8"
              fill="#6B46C1"
              opacity="0.8"
              fontFamily="Inter-Medium"
            >
              SAFE • LOVED • HOME
            </text>
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  textHorizontal: {
    marginTop: 0,
    marginLeft: 12,
  },
});