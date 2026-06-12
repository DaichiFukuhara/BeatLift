import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useWorkoutStore, type Exercise } from '@/store/workoutStore';

type Props = {
  visible: boolean;
  selectedExerciseId: number | null;
  onSelect: (exerciseId: number) => void;
  onClose: () => void;
};

const ALL_CHIP = 'すべて';
const OTHER_CHIP = 'その他';

// 新規種目フォームの部位選択チップ('その他' は bodyPart=null として扱う)
const NEW_EXERCISE_BODY_PARTS = ['胸', '背中', '脚', '肩', '腕', '腹', 'その他'] as const;

export function ExercisePickerSheet({ visible, selectedExerciseId, onSelect, onClose }: Props) {
  const exercises = useWorkoutStore((s) => s.exercises);
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);

  // 部位チップでの絞り込み('すべて' か exercises に出現する bodyPart 文字列 か 'その他')
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>(ALL_CHIP);
  const [searchText, setSearchText] = useState('');
  // 新規種目追加フォームの表示状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBodyPart, setNewBodyPart] = useState<(typeof NEW_EXERCISE_BODY_PARTS)[number]>('胸');

  // visible が false→true になったら内部状態を初期化
  useEffect(() => {
    if (visible) {
      setSelectedBodyPart(ALL_CHIP);
      setSearchText('');
      setShowAddForm(false);
      setNewName('');
      setNewBodyPart('胸');
    }
  }, [visible]);

  // 部位チップ一覧: 'すべて' + exercises の bodyPart 出現順ユニーク + (bodyPart=null の種目があれば 'その他')
  const bodyPartChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [ALL_CHIP];
    let hasNullBodyPart = false;
    for (const exercise of exercises) {
      if (exercise.bodyPart == null) {
        hasNullBodyPart = true;
        continue;
      }
      if (!seen.has(exercise.bodyPart)) {
        seen.add(exercise.bodyPart);
        chips.push(exercise.bodyPart);
      }
    }
    if (hasNullBodyPart) {
      chips.push(OTHER_CHIP);
    }
    return chips;
  }, [exercises]);

  // 部位 + 検索で絞り込んだ種目リスト
  const filteredExercises = useMemo(() => {
    let list = exercises;
    if (selectedBodyPart === OTHER_CHIP) {
      list = list.filter((e) => e.bodyPart == null);
    } else if (selectedBodyPart !== ALL_CHIP) {
      list = list.filter((e) => e.bodyPart === selectedBodyPart);
    }
    const trimmed = searchText.trim();
    if (trimmed) {
      list = list.filter((e) => e.name.includes(trimmed));
    }
    return list;
  }, [exercises, selectedBodyPart, searchText]);

  const canAdd = newName.trim().length > 0;

  const onPressAdd = async () => {
    if (!canAdd) return;
    const bodyPart = newBodyPart === OTHER_CHIP ? null : newBodyPart;
    const newId = await addCustomExercise(newName.trim(), bodyPart);
    onSelect(newId);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel="閉じる" />
          <View className="max-h-[70%] rounded-t-3xl bg-white pb-6">
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            {showAddForm ? (
              <View className="px-5">
                <Text className="mb-3 text-lg font-bold text-gray-900">新しい種目を追加</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  placeholder="種目名"
                  placeholderTextColor="#9ca3af"
                  className="rounded-xl bg-gray-100 px-3 py-2 text-base text-gray-900"
                />
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {NEW_EXERCISE_BODY_PARTS.map((part) => {
                    const selected = newBodyPart === part;
                    return (
                      <Pressable
                        key={part}
                        onPress={() => setNewBodyPart(part)}
                        className={`rounded-full px-3 py-1.5 ${
                          selected ? 'bg-primary' : 'bg-gray-100'
                        }`}
                      >
                        <Text
                          className={`text-sm ${selected ? 'font-bold text-white' : 'text-gray-600'}`}
                        >
                          {part}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="mt-4 flex-row justify-end gap-2">
                  <Pressable onPress={() => setShowAddForm(false)} className="px-4 py-2">
                    <Text className="text-sm font-semibold text-gray-500">キャンセル</Text>
                  </Pressable>
                  <Pressable
                    onPress={onPressAdd}
                    disabled={!canAdd}
                    className={`rounded-full bg-primary px-5 py-2 ${!canAdd ? 'opacity-40' : ''}`}
                  >
                    <Text className="text-sm font-bold text-white">追加</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text className="mb-2 px-5 text-lg font-bold text-gray-900">種目を選択</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-2 px-5"
                  contentContainerStyle={{ gap: 8 }}
                >
                  {bodyPartChips.map((chip) => {
                    const selected = selectedBodyPart === chip;
                    return (
                      <Pressable
                        key={chip}
                        onPress={() => setSelectedBodyPart(chip)}
                        className={`rounded-full px-3 py-1.5 ${
                          selected ? 'bg-primary' : 'bg-gray-100'
                        }`}
                      >
                        <Text
                          className={`text-sm ${selected ? 'font-bold text-white' : 'text-gray-600'}`}
                        >
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="種目名で検索"
                  placeholderTextColor="#9ca3af"
                  className="mx-5 mb-2 rounded-xl bg-gray-100 px-3 py-2 text-base text-gray-900"
                />
                <FlatList
                  data={filteredExercises}
                  keyExtractor={(item) => String(item.id)}
                  style={{ flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }: { item: Exercise }) => {
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
                  ListEmptyComponent={
                    <View className="items-center py-6">
                      <Text className="text-sm text-gray-400">該当する種目がありません</Text>
                    </View>
                  }
                />
                <Pressable
                  onPress={() => setShowAddForm(true)}
                  className="mx-5 mt-2 items-center rounded-xl bg-gray-100 py-3 active:bg-gray-200"
                >
                  <Text className="text-sm font-bold text-primary">＋ 新しい種目を追加</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
