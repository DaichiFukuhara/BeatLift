import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, SectionList, Text, View } from 'react-native';

import { useWorkoutStore, type Exercise } from '@/store/workoutStore';

type Props = {
  visible: boolean;
  selectedExerciseId: number | null;
  onSelect: (exerciseId: number) => void;
  onClose: () => void;
};

export function ExercisePickerSheet({ visible, selectedExerciseId, onSelect, onClose }: Props) {
  const exercises = useWorkoutStore((s) => s.exercises);

  // body_part でグルーピング(シード順を維持)
  const sections = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const exercise of exercises) {
      const key = exercise.bodyPart ?? 'その他';
      const list = map.get(key);
      if (list) {
        list.push(exercise);
      } else {
        map.set(key, [exercise]);
      }
    }
    return [...map.entries()].map(([title, data]) => ({ title, data }));
  }, [exercises]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="閉じる" />
        <View className="max-h-[70%] rounded-t-3xl bg-white pb-6">
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text className="mb-2 px-5 text-lg font-bold text-gray-900">種目を選択</Text>
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderSectionHeader={({ section }) => (
              <View className="bg-gray-50 px-5 py-1.5">
                <Text className="text-xs font-bold text-gray-500">{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const selected = item.id === selectedExerciseId;
              return (
                <Pressable
                  onPress={() => onSelect(item.id)}
                  className="flex-row items-center justify-between px-5 py-3 active:bg-indigo-50"
                >
                  <Text
                    className={`text-base ${
                      selected ? 'font-bold text-primary-dark' : 'text-gray-800'
                    }`}
                  >
                    {item.name}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={20} color="#4f46e5" />}
                </Pressable>
              );
            }}
            stickySectionHeadersEnabled
          />
        </View>
      </View>
    </Modal>
  );
}
