import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarBackground } from "@/components/StarBackground";
import { useGame } from "@/contexts/GameContext";

const { width: SW, height: SH } = Dimensions.get("window");

const PLAYER_W = 40;
const PLAYER_H = 52;
const BULLET_R = 4;
const PLAYER_BULLET_SPEED = 14;
const ENEMY_BULLET_SPEED = 5;
const SCORE_MAP = { scout: 50, fighter: 120, heavy: 250, boss: 800 } as const;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

type EnemyKind = "scout" | "fighter" | "heavy" | "boss";

interface Bullet {
  id: string;
  x: number;
  y: number;
  damage: number;
  speed: number;
  friendly: boolean;
}

interface Enemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  size: number;
  color: string;
  credits: number;
  lastFire: number;
  fireRate: number;
  angle: number;
  startX: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface SpawnEntry {
  kind: EnemyKind;
  at: number;
}

interface GS {
  playerX: number;
  targetX: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  score: number;
  wave: number;
  credits: number;
  lastFire: number;
  lastShieldRegen: number;
  invincibleUntil: number;
  spawnQueue: SpawnEntry[];
  status: "playing" | "wave_complete" | "game_over";
  totalEarned: number;
}

const ENEMY_CFG: Record<EnemyKind, { hp: number; speed: number; damage: number; size: number; color: string; credits: number; fireRate: number }> = {
  scout: { hp: 30, speed: 2.2, damage: 8, size: 28, color: "#FF4455", credits: 10, fireRate: 3200 },
  fighter: { hp: 70, speed: 1.6, damage: 15, size: 36, color: "#AA44FF", credits: 25, fireRate: 2200 },
  heavy: { hp: 160, speed: 0.9, damage: 25, size: 48, color: "#FF8800", credits: 55, fireRate: 1800 },
  boss: { hp: 600, speed: 0.6, damage: 40, size: 64, color: "#FF0044", credits: 220, fireRate: 900 },
};

function buildWaveQueue(wave: number, now: number): SpawnEntry[] {
  const q: SpawnEntry[] = [];
  let t = now + 800;
  const gap = 600;
  const scouts = Math.min(wave * 2 + 1, 12);
  const fighters = wave > 2 ? Math.floor((wave - 2) * 1.2) : 0;
  const heavies = wave > 4 ? Math.floor((wave - 4) * 0.8) : 0;
  const hasBoss = wave % 5 === 0;

  for (let i = 0; i < scouts; i++) { q.push({ kind: "scout", at: t }); t += gap; }
  for (let i = 0; i < fighters; i++) { q.push({ kind: "fighter", at: t }); t += gap + 200; }
  for (let i = 0; i < heavies; i++) { q.push({ kind: "heavy", at: t }); t += gap + 400; }
  if (hasBoss) { q.push({ kind: "boss", at: t }); }
  return q;
}

function spawnEnemy(kind: EnemyKind, wave: number): Enemy {
  const cfg = ENEMY_CFG[kind];
  const x = cfg.size / 2 + Math.random() * (SW - cfg.size);
  const hpMult = 1 + (wave - 1) * 0.18;
  return {
    id: genId(), kind, x, y: -cfg.size,
    hp: Math.round(cfg.hp * hpMult), maxHp: Math.round(cfg.hp * hpMult),
    speed: cfg.speed * (1 + (wave - 1) * 0.06),
    damage: cfg.damage, size: cfg.size, color: cfg.color,
    credits: cfg.credits, lastFire: 0, fireRate: cfg.fireRate,
    angle: Math.random() * Math.PI * 2, startX: x,
  };
}

function makeParticle(x: number, y: number, color: string): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 4 + 1;
  return {
    id: genId(), x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 18 + Math.floor(Math.random() * 14),
    color, size: Math.random() * 5 + 2,
  };
}

function initialState(maxHp: number, maxShield: number, wave: number): GS {
  const now = Date.now();
  return {
    playerX: SW / 2, targetX: SW / 2,
    hp: maxHp, maxHp, shield: maxShield, maxShield,
    bullets: [], enemies: [], particles: [],
    score: 0, wave, credits: 0,
    lastFire: 0, lastShieldRegen: now,
    invincibleUntil: 0,
    spawnQueue: buildWaveQueue(wave, now),
    status: "playing",
    totalEarned: 0,
  };
}

function PlayerShipSvg({ x, y }: { x: number; y: number }) {
  const sw = PLAYER_W;
  const sh = PLAYER_H;
  return (
    <View style={{ position: "absolute", left: x - sw / 2, top: y - sh / 2, width: sw, height: sh, alignItems: "center" }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: sw * 0.3, borderRightWidth: sw * 0.3, borderBottomWidth: sh * 0.38, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#00D4FF" }} />
      <View style={{ width: sw * 0.55, height: sh * 0.38, backgroundColor: "#00D4FF", borderRadius: 4, marginTop: -2 }} />
      <View style={{ flexDirection: "row", width: sw * 1.05, justifyContent: "space-between", marginTop: -4 }}>
        <View style={{ width: 0, height: 0, borderTopWidth: sh * 0.22, borderRightWidth: sw * 0.22, borderTopColor: "#0D5A8A", borderRightColor: "transparent" }} />
        <View style={{ width: 0, height: 0, borderTopWidth: sh * 0.22, borderLeftWidth: sw * 0.22, borderTopColor: "#0D5A8A", borderLeftColor: "transparent" }} />
      </View>
      <View style={{ width: sw * 0.22, height: sh * 0.12, backgroundColor: "#FF6B35", borderRadius: 3, opacity: 0.9, marginTop: 2 }} />
    </View>
  );
}

function EnemyShipView({ enemy }: { enemy: Enemy }) {
  const s = enemy.size;
  const hpPct = enemy.hp / enemy.maxHp;
  return (
    <View style={{ position: "absolute", left: enemy.x - s / 2, top: enemy.y - s / 2 }}>
      <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
        {enemy.kind === "boss" ? (
          <View style={{ width: s, height: s, borderRadius: s * 0.15, backgroundColor: enemy.color, opacity: 0.9, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FF6688" }}>
            <View style={{ width: s * 0.4, height: s * 0.4, borderRadius: s * 0.2, backgroundColor: "#FF6688" }} />
          </View>
        ) : enemy.kind === "heavy" ? (
          <View style={{ width: s * 0.7, height: s, backgroundColor: enemy.color, borderRadius: 6, opacity: 0.9, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: s * 0.35, height: s * 0.35, borderRadius: s * 0.18, backgroundColor: "#FF6600" }} />
          </View>
        ) : enemy.kind === "fighter" ? (
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 0, height: 0, borderLeftWidth: s * 0.28, borderRightWidth: s * 0.28, borderTopWidth: s * 0.4, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: enemy.color }} />
            <View style={{ flexDirection: "row", width: s * 0.9, justifyContent: "space-between", marginTop: -4 }}>
              <View style={{ width: s * 0.28, height: s * 0.22, backgroundColor: enemy.color, borderRadius: 3, opacity: 0.7 }} />
              <View style={{ width: s * 0.28, height: s * 0.22, backgroundColor: enemy.color, borderRadius: 3, opacity: 0.7 }} />
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <View style={{ width: s * 0.5, height: s * 0.5, borderRadius: 4, backgroundColor: enemy.color, opacity: 0.9, transform: [{ rotate: "45deg" }] }} />
          </View>
        )}
      </View>
      <View style={{ position: "absolute", bottom: -6, left: 0, width: s, height: 3, backgroundColor: "#1A3050", borderRadius: 2 }}>
        <View style={{ width: `${hpPct * 100}%`, height: "100%", backgroundColor: hpPct > 0.5 ? "#44FF88" : hpPct > 0.25 ? "#FFD700" : "#FF3355", borderRadius: 2 }} />
      </View>
    </View>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { getMaxHP, getMaxShield, getDamage, getSpeed, getFireRate, earnCredits, updateRecord } = useGame();

  const PLAYER_Y = SH - (Platform.OS === "web" ? 34 : insets.bottom) - 90;
  const playerSpeed = getSpeed();
  const playerDamage = getDamage();
  const playerFireRate = getFireRate();
  const maxHp = getMaxHP();
  const maxShield = getMaxShield();

  const gsRef = useRef<GS>(initialState(maxHp, maxShield, 1));
  const [tick, setTick] = useState(0);
  const [showWaveUI, setShowWaveUI] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const gs = gsRef.current;
      if (gs.status !== "playing") return;

      const now = Date.now();

      const dx = gs.targetX - gs.playerX;
      const newPlayerX = Math.max(PLAYER_W / 2, Math.min(SW - PLAYER_W / 2,
        gs.playerX + Math.sign(dx) * Math.min(Math.abs(dx), playerSpeed)));

      const bullets: Bullet[] = [];
      let lastFire = gs.lastFire;
      if (now - gs.lastFire >= playerFireRate) {
        bullets.push({ id: genId(), x: newPlayerX, y: PLAYER_Y - PLAYER_H / 2 - 4, damage: playerDamage, speed: PLAYER_BULLET_SPEED, friendly: true });
        lastFire = now;
      }

      const allBullets = [...gs.bullets, ...bullets];

      const newSpawnNow = gs.spawnQueue.filter(s => s.at <= now);
      const remainingQueue = gs.spawnQueue.filter(s => s.at > now);
      const newEnemies = newSpawnNow.map(s => spawnEnemy(s.kind, gs.wave));
      let enemies = [...gs.enemies, ...newEnemies];

      const enemyFireBullets: Bullet[] = [];
      enemies = enemies.map(e => {
        let { x, y, angle } = e;
        switch (e.kind) {
          case "scout": y += e.speed; break;
          case "fighter":
            y += e.speed * 0.65;
            angle += 0.04;
            x = e.startX + Math.sin(angle) * 70;
            x = Math.max(e.size / 2, Math.min(SW - e.size / 2, x));
            break;
          case "heavy":
          case "boss":
            y += e.speed * 0.5;
            if (e.kind === "boss") {
              x = e.startX + Math.sin(angle * 0.5) * 100;
              x = Math.max(e.size / 2, Math.min(SW - e.size / 2, x));
              angle += 0.02;
            }
            break;
        }
        let lf = e.lastFire;
        if (now - e.lastFire >= e.fireRate) {
          enemyFireBullets.push({ id: genId(), x: e.x, y: e.y + e.size / 2, damage: e.damage, speed: ENEMY_BULLET_SPEED, friendly: false });
          lf = now;
        }
        return { ...e, x, y, angle, lastFire: lf };
      });

      const movedBullets = [...allBullets, ...enemyFireBullets].map(b => ({
        ...b, y: b.friendly ? b.y - b.speed : b.y + b.speed,
      })).filter(b => b.y > -20 && b.y < SH + 20);

      const hitDamage = new Map<string, number>();
      const hitBulletIds = new Set<string>();
      const friendlyBullets = movedBullets.filter(b => b.friendly);
      const enemyBullets = movedBullets.filter(b => !b.friendly);

      for (const b of friendlyBullets) {
        for (const e of enemies) {
          const half = e.size / 2 + BULLET_R;
          if (Math.abs(b.x - e.x) < half && Math.abs(b.y - e.y) < half) {
            hitDamage.set(e.id, (hitDamage.get(e.id) ?? 0) + b.damage);
            hitBulletIds.add(b.id);
            break;
          }
        }
      }

      let scoreGain = 0;
      let creditsGain = 0;
      const newParticles: Particle[] = [];
      const survivingEnemies: Enemy[] = [];

      for (const e of enemies) {
        const dmg = hitDamage.get(e.id) ?? 0;
        const newHp = e.hp - dmg;
        if (newHp <= 0) {
          scoreGain += SCORE_MAP[e.kind];
          creditsGain += e.credits;
          for (let i = 0; i < 10; i++) newParticles.push(makeParticle(e.x, e.y, e.color));
          if (e.kind === "boss") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (e.y < SH + e.size) {
          survivingEnemies.push({ ...e, hp: newHp });
        }
      }

      const survivingFriendly = friendlyBullets.filter(b => !hitBulletIds.has(b.id));
      const isInvincible = now < gs.invincibleUntil;
      let newHp = gs.hp;
      let newShield = gs.shield;
      let invincibleUntil = gs.invincibleUntil;
      const survivingEnemyBullets: Bullet[] = [];

      const playerHitW = PLAYER_W * 0.55;
      for (const b of enemyBullets) {
        if (!isInvincible && Math.abs(b.x - newPlayerX) < playerHitW && Math.abs(b.y - PLAYER_Y) < PLAYER_H * 0.45) {
          if (newShield > 0) {
            newShield = Math.max(0, newShield - b.damage);
          } else {
            newHp -= b.damage;
            invincibleUntil = now + 300;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          if (dmg > 0) for (let i = 0; i < 4; i++) newParticles.push(makeParticle(newPlayerX, PLAYER_Y, "#00D4FF"));
        } else {
          survivingEnemyBullets.push(b);
        }
      }

      let lastShieldRegen = gs.lastShieldRegen;
      if (now - gs.lastShieldRegen >= 2500 && newShield < gs.maxShield) {
        newShield = Math.min(gs.maxShield, newShield + 3);
        lastShieldRegen = now;
      }

      const updParticles = [
        ...gs.particles.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1, vy: p.vy + 0.12 })).filter(p => p.life > 0),
        ...newParticles,
      ];

      let newStatus = gs.status;
      if (newHp <= 0) {
        newStatus = "game_over";
        newHp = 0;
        clearInterval(intervalRef.current!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (survivingEnemies.length === 0 && remainingQueue.length === 0) {
        newStatus = "wave_complete";
        clearInterval(intervalRef.current!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      gsRef.current = {
        ...gs,
        playerX: newPlayerX,
        hp: Math.max(0, newHp),
        shield: Math.max(0, newShield),
        bullets: [...survivingFriendly, ...survivingEnemyBullets],
        enemies: survivingEnemies,
        particles: updParticles,
        score: gs.score + scoreGain,
        credits: gs.credits + creditsGain,
        lastFire,
        lastShieldRegen,
        invincibleUntil,
        spawnQueue: remainingQueue,
        status: newStatus,
        totalEarned: gs.totalEarned + creditsGain,
      };

      setTick(t => t + 1);
    }, 33);
  }, [PLAYER_Y, playerSpeed, playerDamage, playerFireRate]);

  useEffect(() => {
    startLoop();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startLoop]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { gsRef.current.targetX = e.nativeEvent.locationX; },
      onPanResponderMove: (e) => { gsRef.current.targetX = e.nativeEvent.locationX; },
    })
  ).current;

  const gs = gsRef.current;

  const nextWave = useCallback(() => {
    const nextW = gs.wave + 1;
    earnCredits(gs.totalEarned);
    updateRecord(gs.score, gs.wave);
    gsRef.current = {
      ...initialState(maxHp, maxShield, nextW),
      score: gs.score,
    };
    setShowWaveUI(false);
    setTick(t => t + 1);
    startLoop();
  }, [gs, maxHp, maxShield, earnCredits, updateRecord, startLoop]);

  useEffect(() => {
    if (gs.status === "wave_complete") {
      setShowWaveUI(true);
    }
  }, [gs.status]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <StarBackground />

      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
        {gs.enemies.map(e => <EnemyShipView key={e.id} enemy={e} />)}

        {gs.bullets.filter(b => b.friendly).map(b => (
          <View key={b.id} style={[styles.bullet, { left: b.x - BULLET_R, top: b.y - BULLET_R * 2, width: BULLET_R * 2, height: BULLET_R * 4, backgroundColor: "#00D4FF" }]} />
        ))}

        {gs.bullets.filter(b => !b.friendly).map(b => (
          <View key={b.id} style={[styles.bullet, { left: b.x - BULLET_R + 1, top: b.y - BULLET_R, width: (BULLET_R - 1) * 2, height: BULLET_R * 3, backgroundColor: "#FF4455" }]} />
        ))}

        {gs.particles.map(p => (
          <View key={p.id} style={{ position: "absolute", left: p.x - p.size / 2, top: p.y - p.size / 2, width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.color, opacity: Math.min(1, p.life / 12) }} />
        ))}

        <PlayerShipSvg x={gs.playerX} y={PLAYER_Y} />
      </View>

      <View style={[styles.hud, { paddingTop: topInset + 4 }]} pointerEvents="none">
        <View style={styles.hudRow}>
          <Pressable onPress={() => { clearInterval(intervalRef.current!); router.back(); }} style={styles.backBtn} pointerEvents="box-only">
            <MaterialCommunityIcons name="arrow-left" size={20} color="#5A7A9A" />
          </Pressable>
          <View style={styles.hudCenter}>
            <Text style={styles.waveText}>WAVE {gs.wave}</Text>
            <Text style={styles.scoreText}>{gs.score.toLocaleString()}</Text>
          </View>
          <View style={styles.creditsHud}>
            <MaterialCommunityIcons name="currency-usd" size={14} color="#FFD700" />
            <Text style={styles.creditsText}>{gs.credits}</Text>
          </View>
        </View>

        <View style={styles.barsContainer}>
          <BarRow icon="heart" value={gs.hp} max={gs.maxHp} color="#44FF88" />
          <BarRow icon="shield" value={gs.shield} max={gs.maxShield} color="#4488FF" />
        </View>
      </View>

      {gs.status === "game_over" && (
        <View style={styles.overlay}>
          <LinearGradient colors={["#030B1A", "#0D1F38"]} style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>DESTROYED</Text>
            <Text style={styles.overlayWave}>Reached Wave {gs.wave}</Text>
            <Text style={styles.overlayScore}>{gs.score.toLocaleString()} pts</Text>
            <Text style={styles.overlayCredits}>+{gs.totalEarned} credits earned</Text>
            <OverlayButton label="RETRY" onPress={() => {
              earnCredits(gs.totalEarned);
              updateRecord(gs.score, gs.wave);
              gsRef.current = initialState(maxHp, maxShield, 1);
              setTick(t => t + 1);
              startLoop();
            }} color="#FF3355" />
            <OverlayButton label="HANGAR" onPress={() => {
              earnCredits(gs.totalEarned);
              updateRecord(gs.score, gs.wave);
              router.replace("/hangar");
            }} color="#FF6B35" />
            <OverlayButton label="MENU" onPress={() => {
              earnCredits(gs.totalEarned);
              updateRecord(gs.score, gs.wave);
              router.replace("/");
            }} color="#5A7A9A" />
          </LinearGradient>
        </View>
      )}

      {showWaveUI && gs.status === "wave_complete" && (
        <View style={styles.overlay}>
          <LinearGradient colors={["#030B1A", "#0D1F38"]} style={styles.overlayCard}>
            <Text style={styles.overlayTitleGood}>WAVE {gs.wave} CLEAR</Text>
            <Text style={styles.overlayScore}>{gs.score.toLocaleString()} pts</Text>
            <Text style={styles.overlayCredits}>+{gs.totalEarned} credits earned</Text>
            <OverlayButton label={`WAVE ${gs.wave + 1}`} onPress={nextWave} color="#00D4FF" />
            <OverlayButton label="HANGAR" onPress={() => {
              earnCredits(gs.totalEarned);
              updateRecord(gs.score, gs.wave);
              router.replace("/hangar");
            }} color="#FF6B35" />
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

function BarRow({ icon, value, max, color }: { icon: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={styles.barRow}>
      <MaterialCommunityIcons name={icon as any} size={12} color={color} />
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barLabel, { color }]}>{Math.ceil(value)}</Text>
    </View>
  );
}

function OverlayButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.overlayBtn, { borderColor: color }]}>
      <Text style={[styles.overlayBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030B1A" },
  bullet: { position: "absolute", borderRadius: 3 },
  hud: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  hudRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  backBtn: { padding: 6 },
  hudCenter: { alignItems: "center" },
  waveText: { color: "#5A7A9A", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 3 },
  scoreText: { color: "#E0F4FF", fontSize: 18, fontFamily: "Inter_700Bold" },
  creditsHud: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#0D1F38", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  creditsText: { color: "#FFD700", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  barsContainer: { gap: 5 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barBg: { flex: 1, height: 6, backgroundColor: "#0D1F38", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  barLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", width: 32, textAlign: "right" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,11,26,0.85)" },
  overlayCard: { width: "80%", borderRadius: 20, padding: 28, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#1A3050" },
  overlayTitle: { color: "#FF3355", fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  overlayTitleGood: { color: "#00D4FF", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  overlayWave: { color: "#5A7A9A", fontSize: 14, fontFamily: "Inter_500Medium" },
  overlayScore: { color: "#E0F4FF", fontSize: 22, fontFamily: "Inter_700Bold" },
  overlayCredits: { color: "#FFD700", fontSize: 14, fontFamily: "Inter_500Medium" },
  overlayBtn: { width: "100%", borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  overlayBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 3 },
});
