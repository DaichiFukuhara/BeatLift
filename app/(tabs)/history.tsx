import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GraphView } from '@/components/GraphView';
import { MonthCalendar } from '@/components/MonthCalendar';
import * as repo from '@/lib/db';
import { formatMonthDay, todayKey } from '@/lib/date';

type SessionRow = Awaited<ReturnType<typeof repo.listRecentSessions>>[number];
type ExerciseGroup = { name: string; sets: { weight: number; reps: number; index: number }[] };
type Tab = 'calendar' | 'graph';

function monthPrefixOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const todayStr = todayKey();
  const [initYear, initMonth] = todayStr.split('-').map(Number);

  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ sessions: 0, volume: 0 });
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);

  useFocusEffect(
    useCallback(() => {
      const prefix = monthPrefixOf(viewYear, viewMonth);
      Promise.all([repo.listRecentSessions(365), repo.getMonthlyStats(prefix)]).then(
        ([recent, stats]) => {
          setSessions(recent);
          setMonthlyStats(stats);
        }
      );
    }, [viewYear, viewMonth])
  );

  useEffect(() => {
    const session = sessions.find((s) => s.date === selectedDate) ?? null;
    setSelectedSession(session);
    if (!session) {
      setGroups([]);
      return;
    }
    repo.getSessionSets(session.id).then((rows) => {
      const map = new Map<string, ExerciseGroup>();
      const ordered: ExerciseGroup[] = [];
      for (const row of rows) {
        const key = row.exerciseName ?? '種目未設定';
        let g = map.get(key);
        if (!g) {
          g = { name: key, sets: [] };
          map.set(key, g);
          ordered.push(g);
        }
        g.sets.push({ weight: row.weight, reps: row.reps, index: g.sets.length + 1 });
      }
      setGroups(ordered);
    });
  }, [selectedDate, sessions]);

  const workoutDates = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);

  // 日付昇順の配列（スワイプナビ用）
  const sortedWorkoutDates = useMemo(
    () => Array.from(workoutDates).sort(),
    [workoutDates]
  );

  // PanResponder 内でレンダーごとの最新値を参照するための ref
  const navRef = useRef({ sortedWorkoutDates, selectedDate });
  navRef.current = { sortedWorkoutDates, selectedDate };

  function navigateTo(date: string) {
    const [y, m] = date.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m);
    setSelectedDate(date);
  }

  // PanResponder は一度だけ生成し、navRef 経由で最新値を読む
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12,
      onPanResponderRelease: (_, { dx }) => {
        const { sortedWorkoutDates: dates, selectedDate: current } = navRef.current;
        const idx = dates.indexOf(current);
        if (dx < -50 && idx !== -1 && idx < dates.length - 1) {
          navigateTo(dates[idx + 1]);
        } else if (dx > 50 && idx > 0) {
          navigateTo(dates[idx - 1]);
        }
      },
    })
  ).current;

  const currentIdx = sortedWorkoutDates.indexOf(selectedDate);
  const prevDate = currentIdx > 0 ? sortedWorkoutDates[currentIdx - 1] : null;
  const nextDate =
    currentIdx !== -1 && currentIdx < sortedWorkoutDates.length - 1
      ? sortedWorkoutDates[currentIdx + 1]
      : null;

  function handlePrevMonth() {
    setSelectedDate(todayStr);
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    setSelectedDate(todayStr);
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* ヘッダー */}
      <View className="flex-row items-end justify-between px-5 py-3">
        <Text className="text-xl font-bold text-gray-900">履歴</Text>
        {activeTab === 'calendar' && (
          <Text className="text-xs text-gray-500">
            {viewYear}年{viewMonth}月 {monthlyStats.sessions}回・
            {Math.round(monthlyStats.volume).toLocaleString('ja-JP')}kg
          </Text>
        )}
      </View>

      {/* タブ切り替え */}
      <View className="mx-5 mb-3 flex-row rounded-xl bg-gray-100 p-1">
        {(['calendar', 'graph'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 items-center rounded-lg py-1.5 ${activeTab === tab ? 'bg-white' : ''}`}
          >
            <Text
              className={`text-sm font-medium ${activeTab === tab ? 'text-gray-900' : 'text-gray-500'}`}
            >
              {tab === 'calendar' ? 'カレンダー' : 'グラフ'}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'calendar' ? (
        <>
          <MonthCalendar
            year={viewYear}
            month={viewMonth}
            workoutDates={workoutDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />

          <View className="mx-4 h-px bg-gray-100" />

          {/* スワイプエリア */}
          <View className="flex-1" {...panResponder.panHandlers}>
            {/* 前後ナビゲーション行 */}
            {(prevDate || nextDate) && (
              <View className="flex-row items-center justify-between px-4 py-2">
                {prevDate ? (
                  <Pressable onPress={() => navigateTo(prevDate)} className="flex-row items-center gap-1" hitSlop={8}>
                    <Ionicons name="chevron-back" size={14} color="#9ca3af" />
                    <Text className="text-xs text-gray-400">{formatMonthDay(prevDate)}</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                {nextDate ? (
                  <Pressable onPress={() => navigateTo(nextDate)} className="flex-row items-center gap-1" hitSlop={8}>
                    <Text className="text-xs text-gray-400">{formatMonthDay(nextDate)}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
                  </Pressable>
                ) : (
                  <View />
                )}
              </View>
            )}

            {selectedSession ? (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              >
                <View className="mb-3 flex-row flex-wrap items-center justify-between gap-1">
                  <Text className="text-base font-bold text-gray-900">
                    {formatMonthDay(selectedSession.date)}
                  </Text>
                  <View className="flex-row gap-3">
                    <Text className="text-sm text-gray-500">
                      <Text className="font-bold text-primary-dark">
                        {Math.round(selectedSession.volume).toLocaleString('ja-JP')}kg
                      </Text>
                      {' ボリューム'}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      <Text className="font-bold text-gray-700">{selectedSession.setCount}</Text>
                      {' セット'}
                    </Text>
                  </View>
                </View>

                {groups.map((g) => (
                  <View key={g.name} className="mb-3 rounded-2xl bg-white px-4 py-3">
                    <Text className="mb-2 text-sm font-bold text-gray-800">{g.name}</Text>
                    {g.sets.map((s, i) => (
                      <View key={i} className="mb-1 flex-row items-center">
                        <Text className="w-6 text-xs text-gray-400">{s.index}</Text>
                        <Text className="text-sm text-gray-700">
                          {s.weight}kg × {s.reps}rep
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}

                {selectedSession.note ? (
                  <View className="rounded-xl bg-white px-3 py-2.5">
                    <Text className="mb-1 text-xs font-semibold text-gray-400">メモ</Text>
                    <Text className="text-sm text-gray-700">{selectedSession.note}</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View className="flex-1 items-center justify-center pb-16">
                <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                <Text className="mt-3 text-base font-medium text-gray-400">
                  {sessions.length === 0 ? 'まだ記録がありません' : 'この日は記録がありません'}
                </Text>
                {sessions.length === 0 && (
                  <Text className="mt-1 text-sm text-gray-400">
                    ホームでセットを記録すると、ここに表示されます
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      ) : (
        <GraphView />
      )}
    </SafeAreaView>
  );
}
