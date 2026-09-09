import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy 5-step Urgency flow — redirect to the 4-step type-grid report. */
export default function LegacyLostStrayReport() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  return (
    <Redirect
      href={prefillPetId ? { pathname: '/report', params: { prefillPetId } } : '/report'}
    />
  );
}
