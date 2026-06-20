import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as repo from '@/lib/db';
import { formatMonthDay, monthPrefix, todayKey } from '@/lib/date';
import { useWorkoutStore } from '@/store/workoutStore';

type SessionRow = Awaited<ReturnType<typeof repo.listRecentSessions>>[number];

export default function HistoryScreen() {
  const router = useRouter();
  const loadSession = useWorkoutStore((s) => s.loadSession);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ sessions: 0, volume: 0 });

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [recent, stats] = await Promise.all([
          repo.listRecentSessions(100),
          repo.getMonthlyStats(monthPrefix(todayKey())),
        ]);
        setSessions(recent);
        setMonthlyStats(stats);
      };
      load();
    }, []),
  );

  const onPressSession = (date: string) => {
    loadSession(date);
    router.navigate('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="flex-row items-end justify-between px-5 py-3">
        <Text className="text-xl font-bold text-gray-900">履歴</Text>
        <Text className="text-xs text-gray-500">
          今月 {monthlyStats.sessions}回・{Math.round(monthlyStats.volume).toLocaleString('ja-JP')}
          kg
        </Text>
      </View>
      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressSession(item.date)}
            className="mb-2 rounded-2xl bg-white px-4 py-3 active:bg-gray-50"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-gray-900">{formatMonthDay(item.date)}</Text>
              <Text className="font-extrabold text-primary-dark">
                {(Math.round(item.volume * 10) / 10).toLocaleString('ja-JP')}kg
              </Text>
            </View>
            <View className="mt-0.5 flex-row items-center">
              <Text className="text-xs text-gray-400">{item.setCount}セット</Text>
              {item.note && item.note.trim().length > 0 && (
                <Ionicons
                  name="document-text-outline"
                  size={12}
                  color="#9ca3af"
                  style={{ marginLeft: 6 }}
                />
              )}
              {item.exerciseNames && (
                <Text className="ml-1.5 flex-1 text-xs text-gray-400" numberOfLines={1}>
                  {item.exerciseNames.replace(/,/g, ' · ')}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pb-24">
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text className="mt-3 text-base font-medium text-gray-400">まだ記録がありません</Text>
            <Text className="mt-1 text-sm text-gray-400">
              ホームでセットを記録すると、ここに表示されます
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
