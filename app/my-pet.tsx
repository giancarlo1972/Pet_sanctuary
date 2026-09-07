import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old route. Real record is /pet-record. */
export default function MyPetRedirect() {
  const { id, petId } = useLocalSearchParams<{ id?: string; petId?: string }>();
  const pid = petId || id;
  return <Redirect href={pid ? `/pet-record?petId=${pid}` : '/(tabs)/profile'} />;
}
