import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

type Props = {
  onPress: () => void;
};

export function AddSetFab({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute bottom-8 right-6 h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg active:bg-primary-dark"
      accessibilityLabel="種目を追加"
    >
      <Ionicons name="add" size={34} color="white" />
    </Pressable>
  );
}
