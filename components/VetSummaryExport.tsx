import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Download } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

export interface SummaryData {
  pet: {
    name: string | null;
    species: string | null;
    breed: string;
    gender: string | null;
    date_of_birth: string | null;
    microchipped: boolean | null;
    spayed_neutered: boolean | null;
    weight_kg: number | null;
    body_condition_score: number | null;
    target_weight_kg: number | null;
    previous_names: string[] | null;
  };
  vaccinations: {
    vaccine: string;
    administered_on: string | null;
    next_due_on: string | null;
    lot_number: string | null;
    manufacturer: string | null;
    vet_clinic: string | null;
    vet_name: string | null;
  }[];
  conditions: {
    kind: string;
    name: string;
    severity: string | null;
    diagnosed_on: string | null;
    is_active: boolean;
  }[];
  labPanels: any[];
  clinics: any[];
}

export function VetSummaryExport({ data }: { data: SummaryData }) {
  const generateText = (): string => {
    const lines: string[] = [];
    lines.push('VET SUMMARY EXPORT');
    lines.push('==================');
    lines.push('');
    const pet = data.pet;
    lines.push(`Name: ${pet.name || '—'}`);
    lines.push(`Species: ${pet.species || '—'}`);
    lines.push(`Breed: ${pet.breed}`);
    lines.push(`Gender: ${pet.gender || '—'}`);
    lines.push(`Date of Birth: ${pet.date_of_birth || '—'}`);
    lines.push(`Microchipped: ${pet.microchipped ? 'Yes' : 'No'}`);
    lines.push(`Spayed/Neutered: ${pet.spayed_neutered ? 'Yes' : 'No'}`);
    lines.push(`Weight (kg): ${pet.weight_kg ?? '—'}`);
    lines.push(`Body Condition Score: ${pet.body_condition_score ?? '—'}/9`);
    lines.push(`Target Weight (kg): ${pet.target_weight_kg ?? '—'}`);
    if (pet.previous_names?.length) lines.push(`Previous Names: ${pet.previous_names.join(', ')}`);
    lines.push('');
    lines.push('VACCINATIONS');
    lines.push('------------');
    data.vaccinations.forEach((v) => {
      lines.push(`- ${v.vaccine}: Given ${v.administered_on || '—'}, Next due ${v.next_due_on || '—'}`);
      if (v.vet_clinic) lines.push(`  Clinic: ${v.vet_clinic}`);
      if (v.vet_name) lines.push(`  Vet: ${v.vet_name}`);
      if (v.lot_number) lines.push(`  Lot: ${v.lot_number}`);
      if (v.manufacturer) lines.push(`  Mfr: ${v.manufacturer}`);
    });
    lines.push('');
    lines.push('CONDITIONS & ALLERGIES');
    lines.push('---------------------');
    data.conditions.forEach((c) => {
      lines.push(`- [${c.kind}] ${c.name} (${c.severity || 'unspecified'}) — ${c.is_active ? 'Active' : 'Resolved'}, diagnosed ${c.diagnosed_on || '—'}`);
    });
    return lines.join('\n');
  };

  const handleExport = () => {
    const text = generateText();
    if (typeof window !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vet-summary-${data.pet.name || 'pet'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85}>
        <Download color={Colors.navy} size={16} />
        <Text style={styles.exportText}>Export vet summary</Text>
      </TouchableOpacity>
      <Text style={styles.disclaimer}>
        Generates a plain-text summary of this pet's vaccinations, conditions, and key info for vet visits.
      </Text>
    </View>
  );
}

export default VetSummaryExport;

const styles = StyleSheet.create({
  container: { marginBottom: 16, marginTop: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, alignSelf: 'flex-start' },
  exportText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  disclaimer: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 6, lineHeight: 16 },
});
