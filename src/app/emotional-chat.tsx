import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
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

// ===== API =====
const BASE_URL =
  "https://mhlkyg7otc.execute-api.us-east-1.amazonaws.com/emotional-support";

// ===== Types =====
type Msg = { id: string; role: "user" | "assistant"; content: string; ts?: number };

// ===== Networking helpers =====
const REQ_TIMEOUT_MS = 15000; // יותר מרווח, שלא נחתוך את הלמבדא
async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  retries = 1
): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350)); // backoff עדין
        continue;
      }
      throw lastErr;
    }
  }
  // לא מגיעים לכאן
  // @ts-expect-error
  return null;
}

export default function EmotionalChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionIdRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  // הודעת פתיחה טבעית
  const initialAssistant = useMemo<Msg>(
    () => ({
      id: `sys_${Date.now()}`,
      role: "assistant",
      content: "היי, אני כאן איתך. מה קורה ברגע זה?",
      ts: Date.now(),
    }),
    []
  );

  const [messages, setMessages] = useState<Msg[]>([initialAssistant]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);

  // ניווט אחורה – קטן, בלי אמוג'ים
  const goBack = useCallback(() => {
    const target = typeof params.returnTo === "string" ? `/${params.returnTo}` : "/mainScreen";
    router.replace(target);
  }, [params, router]);

  // ניקוי שיחה: איפוס sessionId + cache מקומי
  const clearChat = useCallback(() => {
    // אישור רך (בלי מודאל כבד) – מודיע בשיחה
    (async () => {
      try {
        await AsyncStorage.multiRemove(["safezone_chat_cache", "chat_session_id"]);
      } catch {}
      sessionIdRef.current = null;
      setMessages([
        {
          id: `sys_${Date.now()}`,
          role: "assistant",
          content: "התחלנו מחדש. אני כאן, נשום/י רגע—מה נחוץ לך עכשיו?",
          ts: Date.now(),
        },
      ]);
      setInput("");
    })();
  }, []);

  // קונטקסט מהניווט (שולחים לשרת רק אם יש ערך)
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

  // טעינת קאש + sessionId
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("safezone_chat_cache");
        if (cached) setMessages(JSON.parse(cached));
      } catch {}
      try {
        const sid = await AsyncStorage.getItem("chat_session_id");
        if (sid) sessionIdRef.current = sid;
      } catch {}
    })();
  }, []);

  // שמירת קאש חכמה (לא כל תו)
  useEffect(() => {
    AsyncStorage.setItem("safezone_chat_cache", JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // גלילה למטה על הודעה חדשה
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages.length]);

  // Quick replies
  const quickReplies = ["אני מרגישה חרדה עכשיו", "יש לי דופק מהיר", "אני לבד בבית", "תן לי צעד אחד להרגעה"];
  const sendQuick = (text: string) => {
    if (sending) return;
    setInput(text);
    setTimeout(() => sendMessage(), 0);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !text.replace(/\s+/g, "") || sending) return;

    const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setSending(true);
    setTyping(true);

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

      // דוגמה ל־clientState (לא חובה)
      payload.clientState = { panicLevel: "high" };

      const res = await fetchWithTimeout(
        BASE_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        1 // ריטריי אחד
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json(); // { reply, sessionId, ... }

      if (data.sessionId && !sessionIdRef.current) {
        sessionIdRef.current = data.sessionId;
        try {
          await AsyncStorage.setItem("chat_session_id", data.sessionId);
        } catch {}
      }

      const botMsg: Msg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: String(data.reply || "").trim() || "…",
        ts: Date.now(),
      };
      setMessages((prev) => [botMsg, ...prev]);
    } catch (err) {
      console.error(err);
      // הודעת שגיאה עדינה בשיחה (לא פותחים Alert באמצע התקף חרדה)
      setMessages((prev) => [
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: "לא הצלחתי לענות כרגע. אפשר לנסות שוב.",
          ts: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setTyping(false);
      setSending(false);
    }
  }, [input, sending, baseCtx]);

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={{
          alignSelf: isUser ? "flex-end" : "flex-start",
          backgroundColor: isUser ? "#EAF7E7" : "#FFFFFF",
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginVertical: 6,
          maxWidth: "85%",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
          borderWidth: 1,
          borderColor: isUser ? "#CDE6C8" : "#ECEFF5",
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 22, color: "#1f2937" }}>{item.content}</Text>
        {item.ts && (
          <Text
            style={{
              fontSize: 11,
              color: "#9CA3AF",
              marginTop: 4,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#E3E7EE",
          backgroundColor: "#FFFFFF",
        }}
      >
        {/* Back – קטן וצלול */}
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#EEF2F7" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>חזרה</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>צ׳אט תמיכה · SafeZone</Text>

        {/* Clear chat */}
        <TouchableOpacity
          onPress={clearChat}
          accessibilityRole="button"
          accessibilityLabel="נקה שיחה"
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#FBEAEA" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#B91C1C" }}>נקה</Text>
        </TouchableOpacity>
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
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
        />

        {typing && (
          <View
            style={{
              alignSelf: "flex-start",
              marginHorizontal: 16,
              marginBottom: 8,
              backgroundColor: "#fff",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#ECEFF5",
            }}
          >
            <Text style={{ color: "#6B7280" }}>העוזר מקליד…</Text>
          </View>
        )}

        {/* Quick Replies */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingBottom: 8 }}>
          {quickReplies.map((q) => (
            <TouchableOpacity
              key={q}
              onPress={() => sendQuick(q)}
              disabled={sending}
              style={{
                backgroundColor: "#E6EAF2",
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 14,
                opacity: sending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#1f2937" }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Composer */}
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
            returnKeyType="send"
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
            {sending ? <ActivityIndicator /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>שליחה</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
