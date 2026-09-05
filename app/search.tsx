import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search as SearchIcon, PawPrint } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import SignedImage from '@/components/SignedImage';

interface SearchResult {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  main_photo_url: string | null;
  location: string | null;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, breed, species, main_photo_url, location')
        .eq('is_public', true)
        .or(`name.ilike.%${query.trim()}%,breed.ilike.%${query.trim()}%,species.ilike.%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) setResults(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [query]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Search</Text>
        <View style={styles.topBtn} />
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <SearchIcon color={Colors.textTertiary} size={18} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search by name, breed, or species..." placeholderTextColor={Colors.textTertiary} returnKeyType="search" onSubmitEditing={handleSearch} autoCapitalize="none" />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
        ) : searched && results.length === 0 ? (
          <View style={styles.emptyState}>
            <PawPrint color={Colors.textTertiary} size={40} />
            <Text style={styles.emptyTitle}>No pets found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term.</Text>
          </View>
        ) : !searched ? (
          <View style={styles.emptyState}>
            <SearchIcon color={Colors.textTertiary} size={40} />
            <Text style={styles.emptyTitle}>Search for a pet</Text>
            <Text style={styles.emptySubtitle}>Find pets by name, breed, or species.</Text>
          </View>
        ) : (
          results.map((r) => (
            <TouchableOpacity key={r.id} style={styles.resultCard} onPress={() => router.push(`/pet-details?id=${r.id}`)} activeOpacity={0.85}>
              {r.main_photo_url ? (
                <SignedImage path={r.main_photo_url} style={styles.resultPhoto} />
              ) : (
                <View style={[styles.resultPhoto, styles.resultPhotoFallback]}><PawPrint color={Colors.textTertiary} size={20} /></View>
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultMeta}>{r.breed ? `${r.breed} · ` : ''}{r.species}</Text>
                {r.location && <Text style={styles.resultLocation} numberOfLines={1}>{r.location}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, backgroundColor: Colors.screen },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  searchBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coral, justifyContent: 'center' },
  searchBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  resultPhoto: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.surface },
  resultPhotoFallback: { justifyContent: 'center', alignItems: 'center' },
  resultInfo: { flex: 1 },
  resultName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  resultMeta: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  resultLocation: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 2 },
});
