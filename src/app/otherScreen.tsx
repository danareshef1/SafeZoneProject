// src/app/otherScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Define the shape of a Q&A item
interface QAItem {
  id: string;
  question: string;
  answer: string;
}

// Sample Q&A data (you can replace this with your actual data)
const QA_DATA: QAItem[] = [
  {
    id: '1',
    question: 'מהו React Native?',
    answer:
      'React Native הוא מסגרת לפיתוח אפליקציות ניידות המאפשרת להשתמש ב-JavaScript וב-React ליצירת ממשקי משתמש מרשימים.',
  },
  {
    id: '2',
    question: 'כיצד עובד הניווט באפליקציה?',
    answer:
      'הניווט באפליקציה מתבצע באמצעות ספריות כמו React Navigation, המאפשרות למשתמש לעבור בין מסכים שונים בקלות ובנוחות.',
  },
  {
    id: '3',
    question: 'מה ההבדל בין State ל-Props?',
    answer:
      'State הוא נתון פנימי של קומפוננטה שמשתנה במהלך זמן הריצה, בעוד ש-Props הם נתונים שמועברים מקומפוננטה אב לחתוכה ואינם משתנים.',
  },
  {
    id: '4',
    question: 'כיצד ניתן לנהל נתונים גלובליים באפליקציה?',
    answer:
      'ניתן לנהל נתונים גלובליים באמצעות Context API או ספריות חיצוניות כמו Redux, שמאפשרות שיתוף נתונים בין קומפוננטות שונות.',
  },
  {
    id: '5',
    question: 'מהם Hooks ב-React?',
    answer:
      'Hooks הם פונקציות המאפשרות להשתמש ב-State ובתכונות אחרות של React ללא צורך בכתיבת קומפוננטות מחלקה.',
  },
];

const OtherScreen: React.FC = () => {
  // State to keep track of which questions are expanded
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Toggle the expansion of a question
  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedIds.includes(id)) {
      setExpandedIds(expandedIds.filter((itemId) => itemId !== id));
    } else {
      setExpandedIds([...expandedIds, id]);
    }
  };

  // Render each Q&A item
  const renderItem = ({ item }: { item: QAItem }) => {
    const isExpanded = expandedIds.includes(item.id);
    return (
      <View style={styles.qaItem}>
        <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.questionContainer}>
          <Text style={styles.questionText}>{item.question}</Text>
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={24}
            color="#555"
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.answerContainer}>
            <Text style={styles.answerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>שאלות ותשובות</Text>
      <FlatList
        data={QA_DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

export default OtherScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    alignSelf: 'center',
    color: '#333',
  },
  listContent: {
    paddingBottom: 16,
  },
  qaItem: {
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 12,
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionText: {
    fontSize: 18,
    color: '#333',
    flex: 1,
    paddingRight: 8,
  },
  answerContainer: {
    marginTop: 8,
    paddingLeft: 8,
  },
  answerText: {
    fontSize: 16,
    color: '#555',
  },
  separator: {
    height: 12,
  },
});