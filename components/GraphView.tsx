// 履歴画面で実績をグラフ表示するコンポーネント。DB から集計を読み込み、
// 月別ボリュームや種目別の推移を棒/折れ線グラフで描画する(react-native-gifted-charts)。
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import * as repo from '@/lib/db';

type Exercise = { id: number; name: string };

// チャート配色
const PRIMARY = '#6366f1';
const PRIMARY_DARK = '#4f46e5';
// 軸ラベルのフォントスタイル
const AXIS_TEXT = { fontSize: 10, color: '#9ca3af' };
// 棒グラフの棒幅・間隔、折れ線グラフのデータ点間隔
const BAR_W = 24;
const BAR_SPACING = 12;
const LINE_SPACING = 52;

export function GraphView() {
  const [monthlyVolumes, setMonthlyVolumes] = useState<{ month: string; volume: number }[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [rmHistory, setRmHistory] = useState<{ date: string; rm: number }[]>([]);

  useEffect(() => {
    Promise.all([repo.getMonthlyVolumes(), repo.getExercisesWithHistory()]).then(
      ([volumes, exs]) => {
        setMonthlyVolumes(volumes);
        setExercises(exs);
        if (exs.length > 0) setSelectedExerciseId(exs[0].id);
      },
    );
  }, []);

  useEffect(() => {
    if (selectedExerciseId === null) return;
    repo.get1RMHistory(selectedExerciseId).then(setRmHistory);
  }, [selectedExerciseId]);

  // 棒グラフ用データに変換。件数が多い場合はラベルを間引いて重なりを防ぐ
  const volumeBarData = useMemo(
    () =>
      monthlyVolumes.map((d, i) => {
        const [, m] = d.month.split('-');
        const total = monthlyVolumes.length;
        const showLabel = total <= 12 || i % Math.ceil(total / 12) === 0 || i === total - 1;
        return {
          value: Math.round(d.volume),
          label: showLabel ? `${Number(m)}月` : '',
          frontColor: PRIMARY,
        };
      }),
    [monthlyVolumes],
  );

  // 折れ線グラフ用データに変換。同様にラベルを間引く
  const rmLineData = useMemo(
    () =>
      rmHistory.map((d, i) => {
        const [, m, day] = d.date.split('-');
        const total = rmHistory.length;
        const showLabel = total <= 12 || i % Math.ceil(total / 12) === 0 || i === total - 1;
        return {
          value: Math.round(d.rm * 10) / 10,
          label: showLabel ? `${Number(m)}/${Number(day)}` : '',
        };
      }),
    [rmHistory],
  );

  // データ件数に応じてチャート幅を計算（横スクロールで全件表示するため）
  const barChartWidth = Math.max(300, volumeBarData.length * (BAR_W + BAR_SPACING) + 60);
  const lineChartWidth = Math.max(300, rmLineData.length * LINE_SPACING + 60);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}
    >
      {/* 月次ボリューム */}
      <Text className="mb-3 px-4 text-sm font-bold text-gray-700">月次ボリューム (kg)</Text>
      {volumeBarData.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <BarChart
            data={volumeBarData}
            width={barChartWidth}
            height={160}
            barWidth={BAR_W}
            spacing={BAR_SPACING}
            noOfSections={4}
            hideRules
            roundedTop
            yAxisTextStyle={AXIS_TEXT}
            xAxisLabelTextStyle={AXIS_TEXT}
          />
        </ScrollView>
      ) : (
        <EmptyChart />
      )}

      {/* 推定1RM */}
      <Text className="mb-2 mt-6 px-4 text-sm font-bold text-gray-700">推定1RM (kg)</Text>

      {/* 種目セレクター */}
      {exercises.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="mb-3"
        >
          <View className="flex-row gap-2">
            {exercises.map((ex) => (
              <Pressable
                key={ex.id}
                onPress={() => setSelectedExerciseId(ex.id)}
                className={`rounded-full px-3 py-1.5 ${
                  selectedExerciseId === ex.id ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedExerciseId === ex.id ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {ex.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {rmLineData.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <LineChart
            data={rmLineData}
            width={lineChartWidth}
            height={160}
            spacing={LINE_SPACING}
            color={PRIMARY}
            thickness={2}
            dataPointsColor={PRIMARY_DARK}
            dataPointsRadius={4}
            noOfSections={4}
            hideRules
            curved
            yAxisTextStyle={AXIS_TEXT}
            xAxisLabelTextStyle={AXIS_TEXT}
          />
        </ScrollView>
      ) : (
        <EmptyChart />
      )}
    </ScrollView>
  );
}

function EmptyChart() {
  return (
    <View className="mx-4 h-40 items-center justify-center rounded-2xl bg-gray-50">
      <Text className="text-sm text-gray-400">データがありません</Text>
    </View>
  );
}
