// 記録画面の本体リスト。setLogs を種目ごとにグループ化して ExerciseGroupCard を縦に並べ、
// スクロール量を scrollY(共有値)へ流してヘッダーの折りたたみと連動させる。
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Dimensions, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';

import { ExerciseGroupCard } from '@/components/ExerciseGroupCard';
import { groupSetLogs, useWorkoutStore, type ExerciseGroup } from '@/store/workoutStore';

type Props = {
  scrollY: SharedValue<number>;
  onPickExercise: (groupKey: string, currentExerciseId: number | null) => void;
};

export function SetLogList({ scrollY, onPickExercise }: Props) {
  const setLogs = useWorkoutStore((s) => s.setLogs);
  const loading = useWorkoutStore((s) => s.loading);

  const groups = useMemo(() => groupSetLogs(setLogs), [setLogs]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  if (loading && setLogs.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={groups}
      keyExtractor={(item: ExerciseGroup) => item.key}
      renderItem={({ item }) => <ExerciseGroupCard group={item} onPickExercise={onPickExercise} />}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 140,
        // リストが短くてもヘッダーを折りたためるよう、常にスクロール可能な高さを確保
        minHeight: setLogs.length > 0 ? Dimensions.get('window').height + 128 : undefined,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center pb-24">
          <Ionicons name="barbell-outline" size={48} color="#d1d5db" />
          <Text className="mt-3 text-base font-medium text-gray-400">記録がありません</Text>
          <Text className="mt-1 text-sm text-gray-400">右下の＋ボタンで種目を追加</Text>
        </View>
      }
    />
  );
}
