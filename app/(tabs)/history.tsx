import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base font-medium text-gray-400">履歴（実装予定）</Text>
      </View>
    </SafeAreaView>
  );
}
