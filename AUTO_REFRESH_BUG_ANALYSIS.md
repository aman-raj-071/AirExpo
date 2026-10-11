# CRITICAL: Auto-Refresh Bug Analysis

## 🚨 URGENT ISSUES FOUND

### Bug #1: Location Jumps Every Second (CRITICAL)
**File:** `src/App.tsx` line 289-309
**Problem:** `useEffect` with `telemetryReloadKey` re-runs telemetry fetch on EVERY state change
**Impact:** Location refreshes constantly, UI jumps, excessive API calls

### Bug #2: Greeting Updates Every Minute
**File:** `src/App.tsx` line 103-107  
**Problem:** `setGreetingClock` every 60 seconds triggers re-renders
**Impact:** Minor but contributes to refresh cycle

### Bug #3: Search Debounce Too Short
**File:** `src/App.tsx` line 315-350
**Problem:** 280ms debounce, searches trigger on every keystroke
**Impact:** Dropdown flickers, excessive searches

### Bug #4: Route AQI Refresh Every Minute
**File:** `src/App.tsx` line 199-203
**Problem:** Routes refresh every 60 seconds when tracking enabled
**Impact:** Map jumps, route data refreshes constantly

### Bug #5: Missing Dependency Arrays
**File:** Multiple useEffect hooks missing proper dependencies
**Problem:** Effects re-run on every render
**Impact:** Cascade of re-renders

## ROOT CAUSE
The main culprit is line 289-309 useEffect that depends on `telemetryReloadKey` but triggers
location data fetch which causes state updates → re-renders → re-triggers effect → infinite loop

## FIX STRATEGY
1. Remove `telemetryReloadKey` dependency or make it explicit manual trigger only
2. Add proper dependency arrays to ALL useEffect hooks
3. Increase search debounce from 280ms to 500ms  
4. Disable auto-refresh on routes (make it manual button)
5. Stop greeting clock from triggering location re-fetch
