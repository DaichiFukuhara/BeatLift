import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SetRow } from '@/components/SetRow';
import { formatShortDate } from '@/lib/date';
import { useWorkoutStore, type ExerciseGroup } from '@/store/workoutStore';

type Props = {
  group: ExerciseGroup;
  onPickExercise: (groupKey: string, currentExerciseId: number | null) => void;
};

export function ExerciseGroupCard({ group, onPickExercise }: Props) {
  const exercises = useWorkoutStore((s) => s.exercises);
  const addSetForExercise = useWorkoutStore((s) => s.addSetForExercise);
  const removeExerciseGroup = useWorkoutStore((s) => s.removeExerciseGroup);
  const ensureExerciseHistory = useWorkoutStore((s) => s.ensureExerciseHistory);
  const history = useWorkoutStore((s) =>
    group.exerciseId != null ? s.historyByExercise[group.exerciseId] : undefined,
  );

  const exercise = exercises.find((e) => e.id === group.exerciseId);

  useEffect(() => {
    if (group.exerciseId != null) {
      ensureExerciseHistory(group.exerciseId);
    }
  }, [group.exerciseId, ensureExerciseHistory]);

  const onPressTrash = () => {
    const label = exercise ? exercise.name : '種目未選択';
    Alert.alert('セットを削除', `${label}の全${group.sets.length}セットを削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => removeExerciseGroup(group.exerciseId),
      },
    ]);
  };

  const onPressAddSet = () => {
    if (group.exerciseId == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addSetForExercise(group.exerciseId);
  };

  const subtotal = group.sets.reduce((sum, l) => sum + l.weight * l.reps, 0);

  const last = history?.last ?? null;
  const bestE1RM = history?.bestE1RM ?? 0;

  const lastSetsText = (() => {
    if (!last) return null;
    const items = last.sets.map((s) => `${s.weight}kg×${s.reps}`);
    const shown = items.length > 4 ? [...items.slice(0, 4), '…'] : items;
    return shown.join(' / ');
  })();

  return (
    <View className="mb-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      {/* ヘッダー: 種目名 + 部位チップ + ゴミ箱 */}
      <View className="flex-row items-center">
        <Pressable
          onPress={() => onPickExercise(group.key, group.exerciseId)}
          className="flex-1 flex-row items-center"
          hitSlop={4}
        >
          <Text
            className={`mr-1 text-base font-semibold ${
              exercise ? 'text-gray-900' : 'text-gray-400'
            }`}
            numberOfLines={1}
          >
            {exercise ? exercise.name : '種目未選択'}
          </Text>
          {exercise?.bodyPart && (
            <View className="mr-1 rounded-full bg-gray-100 px-2 py-0.5">
              <Text className="text-xs text-gray-500">{exercise.bodyPart}</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </Pressable>
        <Pressable onPress={onPressTrash} hitSlop={8} className="ml-2 p-1">
          <Ionicons name="trash-outline" size={18} color="#9ca3af" />
        </Pressable>
      </View>

      {/* 履歴行 */}
      {group.exerciseId != null && (lastSetsText || bestE1RM > 0) && (
        <View className="mt-1 flex-row items-center">
          {lastSetsText && (
            <Text className="flex-1 text-xs text-gray-400" numberOfLines={1}>
              前回 {formatShortDate(last!.date)}: {lastSetsText}
            </Text>
          )}
          {bestE1RM > 0 && <Text className="text-xs text-gray-400">ベスト1RM {bestE1RM}kg</Text>}
        </View>
      )}

      {/* セット行 */}
      <View className="mt-2">
        {group.sets.map((log, index) => (
          <SetRow key={log.id} log={log} index={index} />
        ))}
      </View>

      {/* フッター: セット追加 + 小計 */}
      <View className="mt-1 flex-row items-center justify-between">
        {group.exerciseId != null ? (
          <Pressable onPress={onPressAddSet} hitSlop={4} className="py-1">
            <Text className="text-sm font-semibold text-primary">＋ セット追加</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text className="text-xs text-gray-400">
          計 {(Math.round(subtotal * 10) / 10).toLocaleString('ja-JP')} kg
        </Text>
      </View>
    </View>
  );
}
