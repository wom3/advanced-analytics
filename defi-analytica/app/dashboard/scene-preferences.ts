"use client";

import { useSyncExternalStore } from "react";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function computeLowPowerMode(nav: Navigator): boolean {
  const connection = (nav as Navigator & { connection?: NetworkInformation }).connection;
  const saveData = connection?.saveData === true;
  const slowNetwork = connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";
  const lowConcurrency = nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4;

  const navWithDeviceMemory = nav as Navigator & { deviceMemory?: number };
  const lowMemory =
    typeof navWithDeviceMemory.deviceMemory === "number" && navWithDeviceMemory.deviceMemory <= 4;

  return saveData || slowNetwork || lowConcurrency || lowMemory;
}

export function detectLowPowerMode(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return computeLowPowerMode(navigator);
}

export function useLowPowerMode(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => detectLowPowerMode(),
    () => false
  );
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false);
}

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => {
      mediaQuery.removeEventListener("change", onStoreChange);
    };
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(onStoreChange);
    return () => {
      mediaQuery.removeListener(onStoreChange);
    };
  }

  return () => {};
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
