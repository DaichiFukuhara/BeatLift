import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSetFab } from '@/components/AddSetFab';
import { CollapsingHeader } from '@/components/CollapsingHeader';
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet';
import { SetLogList } from '@/components/SetLogList';
import { useWorkoutStore } from '@/store/workoutStore';

export default function HomeScreen() {
  const scrollY = useSharedValue(0);
  const init = useWorkoutStore((s) => s.init);
  const addSetLog = useWorkoutStore((s) => s.addSetLog);
  const updateSetLog = useWorkoutStore((s) => s.updateSetLog);
  const setLogs = useWorkoutStore((s) => s.setLogs);

  // 種目選択シートを開いている行のID(null = 閉じている)
  const [pickerLogId, setPickerLogId] = useState<number | null>(null);
  const pickerLog = setLogs.find((l) => l.id === pickerLogId);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <CollapsingHeader scrollY={scrollY} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SetLogList scrollY={scrollY} onPickExercise={setPickerLogId} />
      </KeyboardAvoidingView>
      <AddSetFab onPress={addSetLog} />
      <ExercisePickerSheet
        visible={pickerLogId != null}
        selectedExerciseId={pickerLog?.exerciseId ?? null}
        onSelect={(exerciseId) => {
          if (pickerLogId != null) {
            updateSetLog(pickerLogId, { exerciseId });
          }
          setPickerLogId(null);
        }}
        onClose={() => setPickerLogId(null)}
      />
    </SafeAreaView>
  );
}
