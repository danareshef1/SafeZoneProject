import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "expo-router";


const BASE_URL = "https://uby7jbz88a.execute-api.us-east-1.amazonaws.com/default/emotional-support"; 

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function EmotionalChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "sys1", role: "assistant", content: "היי! אני כאן בשבילך 💛 איך את מרגישה היום?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const params = useLocalSearchParams();
  const router = useRouter();

  // כפתור חזור
  // לפני: השתמשת ב-params.from + router.push/back

// בתוך הקומפוננטה:
const goBack = useCallback(() => {
  const target = typeof params.returnTo === "string" ? `/${params.returnTo}` : "/mainScreen";
  console.log("⬅ goBack → replace to:", target);
  router.replace(target);
}, [params, router]);



  // --- שאר הקוד שלך ללא שינוי חשוב ---
  const baseCtx = {
    city: typeof params.city === "string" ? params.city : "",
    isAtHome: params.isAtHome === "1",
    shelterName: typeof params.shelterName === "string" ? params.shelterName : "",
    distanceKm:
      typeof params.distanceKm === "string" && params.distanceKm !== ""
        ? Number(params.distanceKm)
        : undefined,
    countdown:
      typeof params.countdown === "string" && params.countdown !== ""
        ? Number(params.countdown)
        : undefined,
  };

  useEffect(() => {
    (async () => {
      try {
        const sid = await AsyncStorage.getItem("chat_session_id");
        if (sid) sessionIdRef.current = sid;
      } catch {}
    })();
  }, []);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setSending(true);

    try {
      const payload: Record<string, any> = { message: text };
      if (sessionIdRef.current) payload.sessionId = sessionIdRef.current;

      if (baseCtx.city) payload.city = baseCtx.city;
      if (typeof baseCtx.isAtHome === "boolean") payload.isAtHome = baseCtx.isAtHome;
      if (baseCtx.shelterName) payload.shelterName = baseCtx.shelterName;
      if (typeof baseCtx.distanceKm === "number" && !Number.isNaN(baseCtx.distanceKm))
        payload.distanceKm = baseCtx.distanceKm;
      if (typeof baseCtx.countdown === "number" && !Number.isNaN(baseCtx.countdown))
        payload.countdown = baseCtx.countdown;

      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      const data = await res.json();
      if (data.sessionId && !sessionIdRef.current) {
        sessionIdRef.current = data.sessionId;
        try { await AsyncStorage.setItem("chat_session_id", data.sessionId); } catch {}
      }

      const botMsg: Msg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: String(data.reply || "").trim() || "🙂",
      };
      setMessages((prev) => [botMsg, ...prev]);
    } catch (err) {
      console.error(err);
      Alert.alert("שגיאה", "לא הצלחתי לשלוח כרגע. נסי שוב.");
      setMessages((prev) => [
        { id: `e_${Date.now()}`, role: "assistant", content: "אופס… לא הצלחתי לענות כרגע." },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, baseCtx]);

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={{
          alignSelf: isUser ? "flex-end" : "flex-start",
          backgroundColor: isUser ? "#DCF8C6" : "#fff",
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginVertical: 6,
          maxWidth: "85%",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 22, color: "#222" }}>{item.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      {/* כותרת עליונה עם כפתור חזור */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", padding: 12, gap: 12 }}>
        <TouchableOpacity
          onPress={goBack}
          style={{ backgroundColor: "#E6EAF2", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>⬅ חזרה</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>צ׳אט תמיכה – SafeZone</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, paddingHorizontal: 14 }}
          contentContainerStyle={{ paddingVertical: 10, flexGrow: 1, justifyContent: "flex-end" }}
          inverted
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            gap: 8,
            backgroundColor: "#F5F7FB",
            borderTopWidth: 1,
            borderTopColor: "#E3E7EE",
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="כתבי הודעה…"
            multiline
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#E3E7EE",
              fontSize: 16,
            }}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || !input.trim()}
            style={{
              backgroundColor: sending || !input.trim() ? "#B9C3D1" : "#3B82F6",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minWidth: 72,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sending ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>שליחה</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
