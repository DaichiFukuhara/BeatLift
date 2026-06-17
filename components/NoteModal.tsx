import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatMonthDay } from '@/lib/date';
import { useWorkoutStore } from '@/store/workoutStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NoteModal({ visible, onClose }: Props) {
  const selectedDate = useWorkoutStore((s) => s.selectedDate);
  const note = useWorkoutStore((s) => s.note);
  const saveNote = useWorkoutStore((s) => s.saveNote);

  const [text, setText] = useState(note);

  useEffect(() => {
    if (visible) {
      setText(note);
    }
  }, [visible, note]);

  const onPressSave = async () => {
    await saveNote(text);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="rounded-2xl bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900">メモ</Text>
              <Text className="text-xs text-gray-400">{formatMonthDay(selectedDate)}</Text>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="今日のトレーニングメモ…"
              placeholderTextColor="#9ca3af"
              className="mt-3 h-28 rounded-xl bg-gray-100 p-3 text-sm text-gray-900"
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={onClose} className="px-4 py-2">
                <Text className="text-sm font-semibold text-gray-500">キャンセル</Text>
              </Pressable>
              <Pressable onPress={onPressSave} className="rounded-full bg-primary px-5 py-2">
                <Text className="text-sm font-bold text-white">保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
