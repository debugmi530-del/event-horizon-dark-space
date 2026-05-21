import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");
const NUM_STARS = 90;

interface Star {
  x: number;
  size: number;
  opacity: number;
  speed: number;
  color: string;
  anim: Animated.Value;
}

export function StarBackground() {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: NUM_STARS }, (_, i) => ({
        x: Math.random() * W,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 3000 + 1500,
        color: i % 8 === 0 ? "#00D4FF" : i % 12 === 0 ? "#FF6B35" : "#ffffff",
        anim: new Animated.Value(Math.random()),
      })),
    []
  );

  const animations = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    animations.current = stars.map((star) =>
      Animated.loop(
        Animated.timing(star.anim, {
          toValue: 1,
          duration: star.speed,
          useNativeDriver: true,
        })
      )
    );
    animations.current.forEach((a) => a.start());
    return () => animations.current.forEach((a) => a.stop());
  }, [stars]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: star.x,
            width: star.size,
            height: star.size * 3,
            backgroundColor: star.color,
            borderRadius: star.size,
            opacity: star.opacity,
            transform: [
              {
                translateY: star.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-H * 0.05, H * 1.05],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
