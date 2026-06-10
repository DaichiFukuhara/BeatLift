import { Pressable, Text, View } from 'react-native';

import { dayOfMonth, getWeekDates, isToday, weekdayLabel } from '@/lib/date';

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
};

export function WeekCalendarStrip({ selectedDate, onSelect }: Props) {
  const weekDates = getWeekDates(selectedDate);

  return (
    <View className="flex-row px-2">
      {weekDates.map((date) => {
        const selected = date === selectedDate;
        const today = isToday(date);
        const label = weekdayLabel(date);
        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            className="flex-1 items-center py-1"
            hitSlop={4}
          >
            <Text
              className={`mb-1 text-xs ${
                label === '日' ? 'text-red-400' : label === '土' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {label}
            </Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${
                selected ? 'bg-primary' : today ? 'border border-primary' : ''
              }`}
            >
              <Text
                className={`text-base ${
                  selected ? 'font-bold text-white' : today ? 'font-bold text-primary' : 'text-gray-700'
                }`}
              >
                {dayOfMonth(date)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
