'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { World, SpeciationEvent } from '../lib/simulation/world';

export interface SimStats {
  population: number;
  predatorCount: number;
  preyCount: number;
  livingSpecies: number;
  extinctSpecies: number;
  avgSpeed: number;
  avgSize: number;
  generation: number;
  tick: number;
  fps: number;
}

export function useSimulation() {
  const worldRef = useRef<World | null>(null);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const lastTimeRef = useRef(0);
  const fpsCounterRef = useRef({ frames: 0, time: 0, fps: 0 });

  const [stats, setStats] = useState<SimStats>({
    population: 0,
    predatorCount: 0,
    preyCount: 0,
    livingSpecies: 1,
    extinctSpecies: 0,
    avgSpeed: 0,
    avgSize: 0,
    generation: 0,
    tick: 0,
    fps: 0,
  });

  const [speciationEvents, setSpeciationEvents] = useState<SpeciationEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeedState] = useState(1);

  // Initialize world once
  useEffect(() => {
    const world = new World();
    worldRef.current = world;

    const unsub = world.onSpeciation((event) => {
      setSpeciationEvents((prev) => [...prev, event]);
    });

    world.initialize();

    return () => {
      unsub();
    };
  }, []);

  // rAF loop
  useEffect(() => {
    let running = true;

    function loop(timestamp: number) {
      if (!running) return;

      const world = worldRef.current;
      if (world && !pausedRef.current) {
        const ticks = speedRef.current;
        for (let i = 0; i < ticks; i++) {
          world.advance();
        }

        // FPS tracking
        const fc = fpsCounterRef.current;
        fc.frames++;
        if (timestamp - fc.time >= 1000) {
          fc.fps = Math.round((fc.frames * 1000) / (timestamp - fc.time));
          fc.frames = 0;
          fc.time = timestamp;
        }

        // Update stats every ~10 frames
        if (timestamp - lastTimeRef.current > 100) {
          lastTimeRef.current = timestamp;
          const s = world.getStats();
          setStats({
            ...s,
            fps: fc.fps,
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const restart = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.initialize();
    setSpeciationEvents([]);
    setStats({
      population: 0,
      predatorCount: 0,
      preyCount: 0,
      livingSpecies: 1,
      extinctSpecies: 0,
      avgSpeed: 0,
      avgSize: 0,
      generation: 0,
      tick: 0,
      fps: 0,
    });
  }, []);

  const setMutationRate = useCallback((rate: number) => {
    if (worldRef.current) worldRef.current.mutationRate = rate;
  }, []);

  const setFoodAbundance = useCallback((abundance: number) => {
    if (worldRef.current) worldRef.current.foodAbundance = abundance;
  }, []);

  const triggerExtinction = useCallback(() => {
    if (worldRef.current) worldRef.current.triggerExtinctionEvent();
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  }, []);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  return {
    worldRef,
    stats,
    speciationEvents,
    isPaused,
    speed,
    restart,
    setMutationRate,
    setFoodAbundance,
    triggerExtinction,
    togglePause,
    setSpeed,
  };
}
