import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { estimate1RM } from '@/lib/rm';
import { useWorkoutStore, type SetLog } from '@/store/workoutStore';

type Props = {
  log: SetLog;
  index: number;
};

/** 数値入力文字列を正規化する(数字と小数点1つだけ許可) */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

export function SetRow({ log, index }: Props) {
  const updateSetLog = useWorkoutStore((s) => s.updateSetLog);
  const removeSetLog = useWorkoutStore((s) => s.removeSetLog);
  const toggleSetCompleted = useWorkoutStore((s) => s.toggleSetCompleted);
  const bestE1RM = useWorkoutStore((s) =>
    log.exerciseId != null ? (s.historyByExercise[log.exerciseId]?.bestE1RM ?? 0) : 0,
  );

  // 入力途中の "60." などを保持するため、表示用の文字列は行内ローカルで持つ
  const [weightText, setWeightText] = useState(log.weight ? String(log.weight) : '');
  const [repsText, setRepsText] = useState(log.reps ? String(log.reps) : '');

  const oneRM = estimate1RM(log.weight, log.reps);
  const isPR = oneRM > 0 && bestE1RM > 0 && oneRM > bestE1RM;

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

  const onToggleCompleted = () => {
    Haptics.selectionAsync();
    toggleSetCompleted(log.id);
  };

  const onRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeSetLog(log.id);
  };

  return (
    <View className="flex-row items-center py-1.5">
      <View
        className={`h-7 w-7 items-center justify-center rounded-full ${
          log.completed ? 'bg-emerald-100' : 'bg-gray-100'
        }`}
      >
        <Text
          className={`text-xs font-bold ${log.completed ? 'text-emerald-600' : 'text-gray-500'}`}
        >
          {index + 1}
        </Text>
      </View>
      <TextInput
        value={weightText}
        onChangeText={onChangeWeight}
        selectTextOnFocus
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#d1d5db"
        className="ml-2 w-14 rounded-lg bg-gray-100 px-2 py-1.5 text-center text-base font-bold text-gray-900"
        maxLength={6}
      />
      <Text className="ml-1 text-sm text-gray-500">kg</Text>
      <Text className="mx-2 text-sm text-gray-400">×</Text>
      <TextInput
        value={repsText}
        onChangeText={onChangeReps}
        selectTextOnFocus
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#d1d5db"
        className="w-12 rounded-lg bg-gray-100 px-2 py-1.5 text-center text-base font-bold text-gray-900"
        maxLength={3}
      />
      <Text className="ml-1 text-sm text-gray-500">回</Text>
      <View className="flex-1" />
      {oneRM > 0 && (
        <View className={`mr-2 rounded-full px-2 py-1 ${isPR ? 'bg-amber-100' : 'bg-indigo-50'}`}>
          <Text className={`text-xs font-bold ${isPR ? 'text-amber-600' : 'text-primary-dark'}`}>
            {isPR ? `🏆 ${oneRM}` : `1RM ${oneRM}`}
          </Text>
        </View>
      )}
      <Pressable onPress={onToggleCompleted} hitSlop={6} className="p-1">
        <Ionicons
          name={log.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={24}
          color={log.completed ? '#10b981' : '#d1d5db'}
        />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={6} className="ml-1 p-1">
        <Ionicons name="trash-outline" size={16} color="#9ca3af" />
      </Pressable>
    </View>
  );
}
