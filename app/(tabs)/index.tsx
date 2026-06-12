import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSetFab } from '@/components/AddSetFab';
import { CollapsingHeader } from '@/components/CollapsingHeader';
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet';
import { NoteModal } from '@/components/NoteModal';
import { RestTimerBar } from '@/components/RestTimerBar';
import { SetLogList } from '@/components/SetLogList';
import { useWorkoutStore } from '@/store/workoutStore';

type PickerState =
  | { mode: 'add' }
  | { mode: 'change'; groupKey: string; exerciseId: number | null }
  | null;

export default function HomeScreen() {
  const scrollY = useSharedValue(0);
  const init = useWorkoutStore((s) => s.init);
  const addSetForExercise = useWorkoutStore((s) => s.addSetForExercise);
  const changeGroupExercise = useWorkoutStore((s) => s.changeGroupExercise);

  // 種目選択シートの状態(null = 閉じている)
  const [picker, setPicker] = useState<PickerState>(null);
  const [noteVisible, setNoteVisible] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <CollapsingHeader scrollY={scrollY} onPressNote={() => setNoteVisible(true)} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SetLogList
          scrollY={scrollY}
          onPickExercise={(groupKey, exerciseId) =>
            setPicker({ mode: 'change', groupKey, exerciseId })
          }
        />
      </KeyboardAvoidingView>
      <RestTimerBar />
      <AddSetFab onPress={() => setPicker({ mode: 'add' })} />
      <ExercisePickerSheet
        visible={picker != null}
        selectedExerciseId={picker?.mode === 'change' ? picker.exerciseId : null}
        onSelect={(exerciseId) => {
          if (picker?.mode === 'add') {
            addSetForExercise(exerciseId);
          } else if (picker?.mode === 'change') {
            changeGroupExercise(picker.exerciseId, exerciseId);
          }
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <NoteModal visible={noteVisible} onClose={() => setNoteVisible(false)} />
    </SafeAreaView>
  );
}
