import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface PlayerStats {
  credits: number;
  hullLevel: number;
  shieldLevel: number;
  damageLevel: number;
  speedLevel: number;
  fireRateLevel: number;
  highScore: number;
  bestWave: number;
}

interface GameContextType {
  stats: PlayerStats;
  earnCredits: (amount: number) => void;
  upgrade: (stat: keyof Omit<PlayerStats, "credits" | "highScore" | "bestWave">) => boolean;
  updateRecord: (score: number, wave: number) => void;
  getUpgradeCost: (level: number) => number;
  getMaxHP: () => number;
  getMaxShield: () => number;
  getDamage: () => number;
  getSpeed: () => number;
  getFireRate: () => number;
}

const defaultStats: PlayerStats = {
  credits: 300,
  hullLevel: 1,
  shieldLevel: 1,
  damageLevel: 1,
  speedLevel: 1,
  fireRateLevel: 1,
  highScore: 0,
  bestWave: 0,
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<PlayerStats>(defaultStats);

  useEffect(() => {
    AsyncStorage.getItem("eh_player_stats").then((data) => {
      if (data) {
        try {
          setStats({ ...defaultStats, ...JSON.parse(data) });
        } catch {}
      }
    });
  }, []);

  const save = (newStats: PlayerStats) => {
    setStats(newStats);
    AsyncStorage.setItem("eh_player_stats", JSON.stringify(newStats));
  };

  const earnCredits = (amount: number) => {
    save({ ...stats, credits: stats.credits + amount });
  };

  const getUpgradeCost = (level: number): number =>
    ([200, 400, 750, 1400, 2500] as const)[level - 1] ?? 99999;

  const upgrade = (stat: keyof Omit<PlayerStats, "credits" | "highScore" | "bestWave">): boolean => {
    const currentLevel = stats[stat] as number;
    if (currentLevel >= 5) return false;
    const cost = getUpgradeCost(currentLevel);
    if (stats.credits < cost) return false;
    save({ ...stats, credits: stats.credits - cost, [stat]: currentLevel + 1 });
    return true;
  };

  const updateRecord = (score: number, wave: number) => {
    save({
      ...stats,
      highScore: Math.max(stats.highScore, score),
      bestWave: Math.max(stats.bestWave, wave),
    });
  };

  const getMaxHP = () => [100, 140, 190, 260, 360][stats.hullLevel - 1] ?? 100;
  const getMaxShield = () => [50, 75, 110, 160, 220][stats.shieldLevel - 1] ?? 50;
  const getDamage = () => [10, 14, 20, 28, 40][stats.damageLevel - 1] ?? 10;
  const getSpeed = () => [4, 5.5, 7, 8.5, 10][stats.speedLevel - 1] ?? 4;
  const getFireRate = () => [320, 260, 200, 145, 100][stats.fireRateLevel - 1] ?? 320;

  return (
    <GameContext.Provider
      value={{ stats, earnCredits, upgrade, updateRecord, getUpgradeCost, getMaxHP, getMaxShield, getDamage, getSpeed, getFireRate }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = (): GameContextType => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};
