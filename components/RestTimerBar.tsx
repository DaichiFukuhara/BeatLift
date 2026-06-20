import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useWorkoutStore } from '@/store/workoutStore';

/** 秒数を m:ss 形式(秒は2桁ゼロ埋め)に整形する */
function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimerBar() {
  const restTimer = useWorkoutStore((s) => s.restTimer);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const stopRestTimer = useWorkoutStore((s) => s.stopRestTimer);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!restTimer) return;
    // タイマー開始直後に前回マウント時の now が残らないよう即同期する
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    if (!restTimer) return;
    const remainingMs = restTimer.endsAt - now;
    if (remainingMs <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stopRestTimer();
    }
  }, [restTimer, now, stopRestTimer]);

  if (!restTimer) return null;

  const remainingSec = Math.max(0, Math.ceil((restTimer.endsAt - now) / 1000));
  const pct = Math.max(0, Math.min(100, (remainingSec / restTimer.totalSec) * 100));

  return (
    <View className="absolute bottom-7 left-4 right-24 rounded-2xl bg-gray-900 px-4 py-3">
      <View className="flex-row items-center">
        <Ionicons name="stopwatch-outline" size={20} color="white" />
        <Text className="ml-2 text-lg font-bold text-white">{formatRemaining(remainingSec)}</Text>
        <View className="flex-1" />
        <Pressable
          onPress={() => adjustRestTimer(30)}
          hitSlop={4}
          className="mr-2 rounded-full bg-white/20 px-2.5 py-1"
        >
          <Text className="text-xs font-bold text-white">+30秒</Text>
        </Pressable>
        <Pressable
          onPress={stopRestTimer}
          hitSlop={4}
          className="rounded-full bg-white/20 px-2.5 py-1"
        >
          <Text className="text-xs font-bold text-white">スキップ</Text>
        </Pressable>
      </View>
      <View className="mt-2 h-1 rounded-full bg-white/20">
        <View className="h-1 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
