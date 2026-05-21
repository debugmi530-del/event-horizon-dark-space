import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarBackground } from "@/components/StarBackground";
import { type PlayerStats, useGame } from "@/contexts/GameContext";

type UpgradeStat = keyof Omit<PlayerStats, "credits" | "highScore" | "bestWave">;

interface StatConfig {
  key: UpgradeStat;
  label: string;
  icon: string;
  color: string;
  desc: (lvl: number) => string;
}

const STAT_CONFIGS: StatConfig[] = [
  { key: "hullLevel", label: "HULL ARMOR", icon: "shield-half-full", color: "#44FF88", desc: l => ["100", "140", "190", "260", "360"][l - 1] + " HP" },
  { key: "shieldLevel", label: "SHIELD GENERATOR", icon: "shield", color: "#4488FF", desc: l => ["50", "75", "110", "160", "220"][l - 1] + " shield" },
  { key: "damageLevel", label: "WEAPONS", icon: "lightning-bolt", color: "#FF6B35", desc: l => ["10", "14", "20", "28", "40"][l - 1] + " dmg" },
  { key: "fireRateLevel", label: "FIRE RATE", icon: "fire", color: "#FF4455", desc: l => ["320", "260", "200", "145", "100"][l - 1] + "ms" },
  { key: "speedLevel", label: "THRUSTER", icon: "rocket", color: "#00D4FF", desc: l => ["4", "5.5", "7", "8.5", "10"][l - 1] + " spd" },
];

export default function HangarScreen() {
  const insets = useSafeAreaInsets();
  const { stats, upgrade, getUpgradeCost } = useGame();
  const [message, setMessage] = useState<string | null>(null);

  const handleUpgrade = (cfg: StatConfig) => {
    const level = stats[cfg.key] as number;
    if (level >= 5) { setMessage("MAX LEVEL"); return; }
    const cost = getUpgradeCost(level);
    if (stats.credits < cost) { setMessage("NOT ENOUGH CREDITS"); return; }
    const ok = upgrade(cfg.key);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage(`${cfg.label} UPGRADED!`);
    }
    setTimeout(() => setMessage(null), 1800);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <StarBackground />
      <LinearGradient colors={["#030B1A", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120 }} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#5A7A9A" />
        </Pressable>
        <Text style={styles.title}>HANGAR</Text>
        <View style={styles.creditsBox}>
          <MaterialCommunityIcons name="currency-usd" size={15} color="#FFD700" />
          <Text style={styles.creditsText}>{stats.credits.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.shipDisplay}>
        <ShipPreview />
        <View style={styles.shipStats}>
          <MiniStat label="HP" value={["100", "140", "190", "260", "360"][stats.hullLevel - 1]} color="#44FF88" />
          <MiniStat label="SH" value={["50", "75", "110", "160", "220"][stats.shieldLevel - 1]} color="#4488FF" />
          <MiniStat label="DMG" value={["10", "14", "20", "28", "40"][stats.damageLevel - 1]} color="#FF6B35" />
          <MiniStat label="SPD" value={["4", "5.5", "7", "8.5", "10"][stats.speedLevel - 1]} color="#00D4FF" />
        </View>
      </View>

      {message && (
        <View style={styles.messageBanner}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: botInset + 16 }]} showsVerticalScrollIndicator={false}>
        {STAT_CONFIGS.map(cfg => {
          const level = stats[cfg.key] as number;
          const isMax = level >= 5;
          const cost = isMax ? 0 : getUpgradeCost(level);
          const canAfford = stats.credits >= cost;

          return (
            <View key={cfg.key} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { backgroundColor: cfg.color + "22" }]}>
                  <MaterialCommunityIcons name={cfg.icon as any} size={22} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>{cfg.label}</Text>
                  <Text style={[styles.statValue, { color: cfg.color }]}>{cfg.desc(level)}</Text>
                  <LevelDots level={level} color={cfg.color} />
                </View>
              </View>
              <Pressable
                onPress={() => handleUpgrade(cfg)}
                disabled={isMax}
                style={[
                  styles.upgradeBtn,
                  { borderColor: isMax ? "#1A3050" : canAfford ? cfg.color : "#3A2020" },
                ]}
              >
                {isMax ? (
                  <Text style={[styles.upgradeBtnText, { color: "#1A3050" }]}>MAX</Text>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <MaterialCommunityIcons name="arrow-up-bold" size={16} color={canAfford ? cfg.color : "#3A4050"} />
                    <Text style={[styles.upgradeCost, { color: canAfford ? "#FFD700" : "#3A4050" }]}>
                      {cost.toLocaleString()}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botInset + 8 }]}>
        <Pressable style={styles.battleBtn} onPress={() => router.replace("/game")}>
          <MaterialCommunityIcons name="rocket-launch" size={18} color="#030B1A" />
          <Text style={styles.battleBtnText}>LAUNCH</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LevelDots({ level, color }: { level: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= level ? color : "#0D1F38", borderWidth: 1, borderColor: i <= level ? color : "#1A3050" }} />
      ))}
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
    </View>
  );
}

function ShipPreview() {
  return (
    <View style={{ width: 60, height: 78, alignItems: "center" }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 18, borderRightWidth: 18, borderBottomWidth: 28, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#00D4FF" }} />
      <View style={{ width: 33, height: 30, backgroundColor: "#00D4FF", borderRadius: 4, marginTop: -2 }} />
      <View style={{ flexDirection: "row", width: 63, justifyContent: "space-between", marginTop: -4 }}>
        <View style={{ width: 0, height: 0, borderTopWidth: 14, borderRightWidth: 13, borderTopColor: "#0D5A8A", borderRightColor: "transparent" }} />
        <View style={{ width: 0, height: 0, borderTopWidth: 14, borderLeftWidth: 13, borderTopColor: "#0D5A8A", borderLeftColor: "transparent" }} />
      </View>
      <View style={{ width: 13, height: 10, backgroundColor: "#FF6B35", borderRadius: 3, marginTop: 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030B1A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 8 },
  title: { color: "#E0F4FF", fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 5 },
  creditsBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0D1F38", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#1A3050" },
  creditsText: { color: "#FFD700", fontSize: 14, fontFamily: "Inter_700Bold" },
  shipDisplay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 16, paddingHorizontal: 24, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#0D1F38", borderRadius: 16, borderWidth: 1, borderColor: "#1A3050" },
  shipStats: { flexDirection: "row", gap: 16 },
  miniStat: { alignItems: "center", gap: 2 },
  miniStatLabel: { color: "#5A7A9A", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  miniStatValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  messageBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#0D1F38", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#00D4FF" },
  messageText: { color: "#00D4FF", fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  list: { paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0D1F38", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1A3050" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { color: "#5A7A9A", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 1 },
  upgradeBtn: { width: 58, height: 58, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  upgradeBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  upgradeCost: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  battleBtn: { backgroundColor: "#00D4FF", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  battleBtnText: { color: "#030B1A", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 4 },
});
