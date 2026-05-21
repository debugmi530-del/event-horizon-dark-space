import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarBackground } from "@/components/StarBackground";
import { useGame } from "@/contexts/GameContext";

const { width: W } = Dimensions.get("window");

function MenuButton({
  label,
  onPress,
  color,
  icon,
}: {
  label: string;
  onPress: () => void;
  color: string;
  icon: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, { borderColor: color }]}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={color}
          style={{ marginRight: 10 }}
        />
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const { stats } = useGame();

  const titleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shipAnim, {
          toValue: -10,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shipAnim, {
          toValue: 10,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <StarBackground />
      <LinearGradient
        colors={["#030B1A", "transparent", "#030B1A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: topInset + 20 }]}>
        <Animated.View
          style={{
            opacity: titleAnim,
            transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            alignItems: "center",
          }}
        >
          <Text style={styles.subtitle}>⚡ SPACE COMBAT RPG</Text>
          <Text style={styles.title}>EVENT{"\n"}HORIZON</Text>
          <Text style={styles.titleSub}>DARK SPACE</Text>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: shipAnim }], marginVertical: 30 }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <PlayerShipIcon size={80} />
          </Animated.View>
        </Animated.View>

        {stats.highScore > 0 && (
          <View style={styles.statsRow}>
            <StatBadge icon="trophy" label="BEST" value={stats.highScore.toLocaleString()} color="#FFD700" />
            <StatBadge icon="waves" label="WAVE" value={`${stats.bestWave}`} color="#00D4FF" />
            <StatBadge icon="currency-usd" label="CREDITS" value={stats.credits.toLocaleString()} color="#44FF88" />
          </View>
        )}

        <View style={styles.buttons}>
          <MenuButton
            label="BATTLE"
            onPress={() => router.push("/game")}
            color="#00D4FF"
            icon="rocket-launch"
          />
          <MenuButton
            label="HANGAR"
            onPress={() => router.push("/hangar")}
            color="#FF6B35"
            icon="wrench"
          />
        </View>

        {stats.highScore === 0 && (
          <Text style={styles.creditsLabel}>
            Credits: {stats.credits.toLocaleString()}
          </Text>
        )}
      </View>

      <Text style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8 }]}>
        TOUCH TO MOVE · AUTO FIRE
      </Text>
    </View>
  );
}

function PlayerShipIcon({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size * 1.3, alignItems: "center" }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.28,
          borderRightWidth: size * 0.28,
          borderBottomWidth: size * 0.42,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: "#00D4FF",
        }}
      />
      <View
        style={{
          width: size * 0.56,
          height: size * 0.5,
          backgroundColor: "#00D4FF",
          borderRadius: 6,
          marginTop: -2,
        }}
      />
      <View style={{ flexDirection: "row", width: size * 1.1, justifyContent: "space-between", marginTop: -6 }}>
        <View style={{ width: 0, height: 0, borderTopWidth: size * 0.28, borderRightWidth: size * 0.22, borderTopColor: "#1A5A8A", borderRightColor: "transparent" }} />
        <View style={{ width: 0, height: 0, borderTopWidth: size * 0.28, borderLeftWidth: size * 0.22, borderTopColor: "#1A5A8A", borderLeftColor: "transparent" }} />
      </View>
      <View
        style={{
          width: size * 0.22,
          height: size * 0.18,
          backgroundColor: "#FF6B35",
          borderRadius: size * 0.08,
          opacity: 0.9,
          marginTop: 2,
        }}
      />
    </View>
  );
}

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      <Text style={[styles.badgeLabel, { color: "#5A7A9A" }]}>{label}</Text>
      <Text style={[styles.badgeValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030B1A",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  subtitle: {
    color: "#00D4FF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 4,
    marginBottom: 8,
    opacity: 0.8,
  },
  title: {
    color: "#E0F4FF",
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 54,
    letterSpacing: 8,
  },
  titleSub: {
    color: "#FF6B35",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 6,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: "#0D1F38",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1A3050",
    gap: 2,
  },
  badgeLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  badgeValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  buttons: {
    width: "100%",
    gap: 14,
    marginTop: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 16,
    backgroundColor: "rgba(13,31,56,0.8)",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  creditsLabel: {
    color: "#FFD700",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
  },
  footer: {
    textAlign: "center",
    color: "#1A3050",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 2,
  },
});
