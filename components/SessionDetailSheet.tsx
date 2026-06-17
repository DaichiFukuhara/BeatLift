import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as repo from '@/lib/db';
import { formatMonthDay } from '@/lib/date';

type Session = {
  id: number;
  date: string;
  volume: number;
  setCount: number;
  note: string | null;
};

type ExerciseGroup = {
  name: string;
  sets: { weight: number; reps: number; index: number }[];
};

type Props = {
  session: Session | null;
  onClose: () => void;
};

export function SessionDetailSheet({ session, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);

  useEffect(() => {
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
  }, [session]);

  return (
    <Modal
      visible={session !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <View
          className="rounded-t-3xl bg-white"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {/* ハンドルバー */}
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>

          {/* ヘッダー */}
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-lg font-bold text-gray-900">
              {session ? formatMonthDay(session.date) : ''}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#9ca3af" />
            </Pressable>
          </View>

          {/* 統計 */}
          {session && (
            <View className="flex-row gap-4 px-5 pb-4">
              <Text className="text-sm text-gray-500">
                <Text className="font-bold text-primary-dark">
                  {Math.round(session.volume).toLocaleString('ja-JP')}kg
                </Text>
                {' ボリューム'}
              </Text>
              <Text className="text-sm text-gray-500">
                <Text className="font-bold text-gray-700">{session.setCount}</Text>
                {' セット'}
              </Text>
            </View>
          )}

          {/* セット一覧 */}
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            {groups.map((g) => (
              <View key={g.name} className="mb-4">
                <Text className="mb-1.5 text-sm font-bold text-gray-800">{g.name}</Text>
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

            {session?.note ? (
              <View className="mt-1 rounded-xl bg-gray-50 px-3 py-2.5">
                <Text className="mb-1 text-xs font-semibold text-gray-400">メモ</Text>
                <Text className="text-sm text-gray-700">{session.note}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
