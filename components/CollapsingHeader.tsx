import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { WeekCalendarStrip } from '@/components/WeekCalendarStrip';
import { addDays, formatHeaderDate, formatShortDate, isToday, todayKey } from '@/lib/date';
import {
  selectCompletedSets,
  selectTotalSets,
  selectTotalVolume,
  useWorkoutStore,
} from '@/store/workoutStore';

// 折りたたみ対象(週カレンダー + 総重量 + 前回比)の高さ。実測が入るまでのフォールバック
const COLLAPSIBLE_FALLBACK_HEIGHT = 158;
// この距離スクロールしたら完全に折りたたむ
const COLLAPSE_DISTANCE = 120;

type Props = {
  scrollY: SharedValue<number>;
  onPressNote: () => void;
};

export function CollapsingHeader({ scrollY, onPressNote }: Props) {
  const selectedDate = useWorkoutStore((s) => s.selectedDate);
  const loadSession = useWorkoutStore((s) => s.loadSession);
  const totalVolume = useWorkoutStore(selectTotalVolume);
  const totalSets = useWorkoutStore(selectTotalSets);
  const completedSets = useWorkoutStore(selectCompletedSets);
  const prevSession = useWorkoutStore((s) => s.prevSession);
  const hasNote = useWorkoutStore((s) => s.note.trim().length > 0);

  // 前回比行の有無などで中身の高さが変わるため、onLayout の実測値で折りたたむ
  const contentHeight = useSharedValue(COLLAPSIBLE_FALLBACK_HEIGHT);

  const collapsibleStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      height: progress * contentHeight.value,
      opacity: progress,
    };
  });

  const volumeText = (Math.round(totalVolume * 10) / 10).toLocaleString('ja-JP');

  // 前回比: 今回の総重量 - 前回の総重量(totalVolume>0 のときのみ表示)
  const diff = prevSession ? totalVolume - prevSession.volume : 0;
  const diffText = (Math.round(Math.abs(diff) * 10) / 10).toLocaleString('ja-JP');

  return (
    <View className="border-b border-gray-200 bg-white px-2 pt-1">
      {/* 日付ナビ(常時表示) */}
      <View className="h-12 flex-row items-center justify-between px-2">
        <Pressable
          onPress={() => loadSession(addDays(selectedDate, -1))}
          hitSlop={8}
          className="p-2"
        >
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
        <View className="flex-row items-center">
          <Pressable onPress={onPressNote} hitSlop={8} className="p-2">
            <View>
              <Ionicons name="document-text-outline" size={20} color="#374151" />
              {hasNote && (
                <View className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </View>
          </Pressable>
          <Pressable
            onPress={() => loadSession(addDays(selectedDate, 1))}
            hitSlop={8}
            className="p-2"
          >
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </Pressable>
        </View>
      </View>

      {/* 週カレンダー + 総重量(スクロールで折りたたみ) */}
      <Animated.View style={[{ overflow: 'hidden' }, collapsibleStyle]}>
        <View
          onLayout={(e) => {
            contentHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <WeekCalendarStrip selectedDate={selectedDate} onSelect={loadSession} />
          <View className="mx-2 mb-2 mt-2 flex-row items-end justify-between rounded-2xl bg-indigo-50 px-4 py-2.5">
            <View className="flex-row items-end gap-1.5">
              <Text className="pb-1 text-xs font-medium text-gray-500">総重量</Text>
              <Text className="text-2xl font-extrabold text-primary-dark">{volumeText}</Text>
              <Text className="pb-1 text-xs font-medium text-gray-500">kg</Text>
            </View>
            <Text className="pb-1 text-xs font-medium text-gray-500">
              {completedSets}/{totalSets} セット完了
            </Text>
          </View>
          {prevSession && (
            <View className="mx-2 mb-2 mt-1 flex-row items-center justify-between px-2">
              <Text className="text-xs text-gray-400">
                前回({formatShortDate(prevSession.date)}){' '}
                {(Math.round(prevSession.volume * 10) / 10).toLocaleString('ja-JP')}kg
              </Text>
              {totalVolume > 0 && (
                <Text className={`text-xs ${diff >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                  {diff >= 0 ? `▲ +${diffText}kg` : `▼ ${diffText}kg`}
                </Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
