import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { isToday, toDateKey } from '@/lib/date';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  year: number;
  month: number;
  workoutDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function MonthCalendar({
  year,
  month,
  workoutDates,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View className="bg-white px-3 pb-2">
      <View className="flex-row items-center justify-between px-2 py-3">
        <Pressable onPress={onPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color="#6b7280" />
        </Pressable>
        <Text className="text-base font-bold text-gray-800">
          {year}年{month}月
        </Text>
        <Pressable onPress={onNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={label}
            className={`flex-1 text-center text-xs font-medium ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row">
          {week.map((day, di) => {
            if (!day) return <View key={di} className="flex-1 py-1" />;

            const dateKey = toDateKey(new Date(year, month - 1, day));
            const hasWorkout = workoutDates.has(dateKey);
            const isSelected = selectedDate === dateKey;
            const today = isToday(dateKey);

            return (
              <Pressable
                key={di}
                onPress={() => hasWorkout && onSelectDate(dateKey)}
                className="flex-1 items-center py-1"
                hitSlop={2}
              >
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    isSelected ? 'bg-primary' : today ? 'border border-primary' : ''
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? 'font-bold text-white'
                        : today
                        ? 'font-bold text-primary'
                        : di === 0
                        ? 'text-red-400'
                        : di === 6
                        ? 'text-blue-400'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </Text>
                </View>
                <View className="mt-0.5 h-1.5 items-center justify-center">
                  {hasWorkout && (
                    <View
                      className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
