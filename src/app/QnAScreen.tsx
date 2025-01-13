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
    question: 'מהו Safe Zone וכיצד הוא תומך במשתמשים במהלך מצבי חירום?',
    answer:
      'Safe Zone היא אפליקציה ניידת שמטרתה להעניק למשתמשים תמיכה בזמן מצבי חירום כמו התקפות רקטות, אסונות טבע, ואירועים אחרים. האפליקציה כוללת התראות בזמן אמת, נווטת את המשתמשים למקלטים הקרובים ביותר, מאפשרת להם להודיע לאנשי קשר על מצבם ומיקומם, ומספקת תמיכה רגשית באמצעות טכנולוגיית GenAI לניהול מתח וחרדה. בנוסף, האפליקציה מאפשרת לדווח על מצבו של המקלט כדי לעזור לרשויות להקצות משאבים בצורה אפקטיבית.',
  },
  {
    id: '2',
    question: 'כיצד האפליקציה מזהה את המקלט הקרוב ביותר?',
    answer:
      'האפליקציה משתמשת בשירותי מיקום בזמן אמת כדי לאתר את מיקום המשתמש ולנווט אותו למקלט הקרוב ביותר בהתחשב בזמינות המקלט ובמרחק. תהליך זה מבוצע בצורה אוטומטית כדי שהמשתמש יוכל להגיע במהרה למקום בטוח.',
  },
  {
    id: '3',
    question: 'האם Safe Zone מספקת תמיכה רגשית בזמן מצבי חירום?',
    answer:
      'כן, האפליקציה משתמשת בטכנולוגיית GenAI כדי לספק תמיכה רגשית מותאמת אישית, כולל טכניקות להרפיית מתח, תרגילי נשימות, ומסרים מעודדים שמסייעים למשתמשים להתמודד עם החרדה במצבים קריטיים.',
  },
  {
    id: '4',
    question: 'כיצד Safe Zone מספקת עדכונים בזמן אמת על מצב המקלטים?',
    answer:
      'המשתמשים יכולים לדווח על מצב המקלטים (כגון "המקלט overcrowded" או "דורש תיקון") בזמן אמת, והנתונים מועברים לרשויות המקומיות כדי להבטיח את ניהול המשאבים בצורה אופטימלית. האפליקציה מציגה גם את רמות תפוסת המקלטים, כך שהמשתמשים יכולים לבחור מקלטים עם פחות עומס.',
  },
  {
    id: '5',
    question: 'האם ניתן לשלוח הודעות אוטומטיות לאנשי קשר במהלך חירום?',
    answer:
      'כן, האפליקציה מאפשרת למשתמשים להגדיר אנשי קשר חירום מראש, ובמהלך מצב חירום, האפליקציה שולחת עדכון אוטומטי עם מיקום המשתמש וסטטוס הבטיחות שלו. זה מסייע לצמצם את הדאגה והבלבול אצל בני משפחה ואנשי קשר.',
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
      <Text style={styles.title}>שאלות ותשובות - Safe Zone</Text>
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
