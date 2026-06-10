import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { estimate1RM } from '@/lib/rm';
import { useWorkoutStore, type SetLog } from '@/store/workoutStore';

type Props = {
  log: SetLog;
  onPickExercise: (logId: number) => void;
};

/** 数値入力文字列を正規化する(数字と小数点1つだけ許可) */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

export function SetLogRow({ log, onPickExercise }: Props) {
  const exercises = useWorkoutStore((s) => s.exercises);
  const updateSetLog = useWorkoutStore((s) => s.updateSetLog);
  const removeSetLog = useWorkoutStore((s) => s.removeSetLog);
  const duplicateSetLog = useWorkoutStore((s) => s.duplicateSetLog);

  // 入力途中の "60." などを保持するため、表示用の文字列は行内ローカルで持つ
  const [weightText, setWeightText] = useState(log.weight ? String(log.weight) : '');
  const [repsText, setRepsText] = useState(log.reps ? String(log.reps) : '');

  const exercise = exercises.find((e) => e.id === log.exerciseId);
  const oneRM = estimate1RM(log.weight, log.reps);

  const onChangeWeight = (text: string) => {
    const sanitized = sanitizeDecimal(text);
    setWeightText(sanitized);
    updateSetLog(log.id, { weight: parseFloat(sanitized) || 0 });
  };

  const onChangeReps = (text: string) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    setRepsText(sanitized);
    updateSetLog(log.id, { reps: parseInt(sanitized, 10) || 0 });
  };

  return (
    <View className="mb-2">
      <ReanimatedSwipeable
        renderRightActions={() => (
          <Pressable
            onPress={() => removeSetLog(log.id)}
            className="ml-2 w-20 items-center justify-center rounded-2xl bg-red-500 active:bg-red-600"
          >
            <Ionicons name="trash-outline" size={22} color="white" />
            <Text className="mt-0.5 text-xs font-bold text-white">削除</Text>
          </Pressable>
        )}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <View className="rounded-2xl bg-white px-4 py-3 shadow-sm">
          {/* 種目選択 + 複製 */}
          <View className="flex-row items-center">
            <Pressable
              onPress={() => onPickExercise(log.id)}
              className="flex-1 flex-row items-center"
              hitSlop={4}
            >
              <Text
                className={`mr-1 text-base font-semibold ${
                  exercise ? 'text-gray-900' : 'text-gray-400'
                }`}
                numberOfLines={1}
              >
                {exercise ? exercise.name : '種目を選択'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9ca3af" />
            </Pressable>
            <Pressable
              onPress={() => duplicateSetLog(log.id)}
              hitSlop={8}
              className="ml-2 p-1"
              accessibilityLabel="このセットを複製"
            >
              <Ionicons name="copy-outline" size={18} color="#9ca3af" />
            </Pressable>
          </View>

          {/* 重量 × レップ + 1RM */}
          <View className="mt-2 flex-row items-center">
            <TextInput
              value={weightText}
              onChangeText={onChangeWeight}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#d1d5db"
              className="w-16 rounded-lg bg-gray-100 px-2 py-1.5 text-center text-base font-bold text-gray-900"
              maxLength={6}
            />
            <Text className="ml-1.5 text-sm text-gray-500">kg</Text>
            <Text className="mx-2.5 text-sm text-gray-400">×</Text>
            <TextInput
              value={repsText}
              onChangeText={onChangeReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#d1d5db"
              className="w-14 rounded-lg bg-gray-100 px-2 py-1.5 text-center text-base font-bold text-gray-900"
              maxLength={3}
            />
            <Text className="ml-1.5 text-sm text-gray-500">回</Text>
            <View className="flex-1" />
            {oneRM > 0 && (
              <View className="rounded-full bg-indigo-50 px-2.5 py-1">
                <Text className="text-xs font-bold text-primary-dark">1RM {oneRM}kg</Text>
              </View>
            )}
          </View>
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}
