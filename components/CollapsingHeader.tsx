import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { WeekCalendarStrip } from '@/components/WeekCalendarStrip';
import { addDays, formatHeaderDate, isToday, todayKey } from '@/lib/date';
import { selectTotalSets, selectTotalVolume, useWorkoutStore } from '@/store/workoutStore';

// 折りたたみ対象(週カレンダー + 総重量)の展開時の高さ
const COLLAPSIBLE_HEIGHT = 128;
// この距離スクロールしたら完全に折りたたむ
const COLLAPSE_DISTANCE = 100;

type Props = {
  scrollY: SharedValue<number>;
};

export function CollapsingHeader({ scrollY }: Props) {
  const selectedDate = useWorkoutStore((s) => s.selectedDate);
  const loadSession = useWorkoutStore((s) => s.loadSession);
  const totalVolume = useWorkoutStore(selectTotalVolume);
  const totalSets = useWorkoutStore(selectTotalSets);

  const collapsibleStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      height: progress * COLLAPSIBLE_HEIGHT,
      opacity: progress,
    };
  });

  const volumeText = (Math.round(totalVolume * 10) / 10).toLocaleString('ja-JP');

  return (
    <View className="border-b border-gray-200 bg-white px-2 pt-1">
      {/* 日付ナビ(常時表示) */}
      <View className="h-12 flex-row items-center justify-between px-2">
        <Pressable onPress={() => loadSession(addDays(selectedDate, -1))} hitSlop={8} className="p-2">
          <Ionicons name="chevron-back" size={22} color="#374151" />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-gray-900">{formatHeaderDate(selectedDate)}</Text>
          {!isToday(selectedDate) && (
            <Pressable
              onPress={() => loadSession(todayKey())}
              className="rounded-full bg-indigo-50 px-2.5 py-1"
              hitSlop={4}
            >
              <Text className="text-xs font-bold text-primary">今日</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => loadSession(addDays(selectedDate, 1))} hitSlop={8} className="p-2">
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </Pressable>
      </View>

      {/* 週カレンダー + 総重量(スクロールで折りたたみ) */}
      <Animated.View style={[{ overflow: 'hidden' }, collapsibleStyle]}>
        <WeekCalendarStrip selectedDate={selectedDate} onSelect={loadSession} />
        <View className="mx-2 mb-3 mt-2 flex-row items-end justify-between rounded-2xl bg-indigo-50 px-4 py-2.5">
          <View className="flex-row items-end gap-1.5">
            <Text className="pb-1 text-xs font-medium text-gray-500">総重量</Text>
            <Text className="text-2xl font-extrabold text-primary-dark">{volumeText}</Text>
            <Text className="pb-1 text-xs font-medium text-gray-500">kg</Text>
          </View>
          <Text className="pb-1 text-xs font-medium text-gray-500">{totalSets} セット</Text>
        </View>
      </Animated.View>
    </View>
  );
}
