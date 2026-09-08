import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Home, PawPrint, MapPin, Users, Siren } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { CONTENT_MAX } from '@/components/Page';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('onboarding_done').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (error) return;
      if (data && data.onboarding_done === false) router.replace('/onboarding');
    });
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.coral,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          maxWidth: CONTENT_MAX,
          width: '100%',
          alignSelf: 'center',
          marginHorizontal: 'auto',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Pets',
          tabBarIcon: ({ size, color }) => <PawPrint size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ size, color }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ size, color }) => <Siren size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null,
        }}
      />
    </Tabs>
  );
}
