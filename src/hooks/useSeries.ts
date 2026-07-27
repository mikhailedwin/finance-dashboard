import { useEffect, useState } from 'react';

import { loadManifest, loadSeries } from '../lib/data';
import { prepareSeries, toPoints, type Point } from '../lib/series';
import type { Manifest } from '../lib/manifest';
import { INDICATOR_BY_ID } from '../config/indicators';

export interface Async<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useManifest(): Async<Manifest> {
  const [state, setState] = useState<Async<Manifest>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let live = true;
    loadManifest()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error: Error) => live && setState({ data: null, error, loading: false }));
    return () => {
      live = false;
    };
  }, []);

  return state;
}

/**
 * Load a series and run it through the same transform pipeline the build script
 * used, so a chart can never disagree with the statistics in the manifest.
 */
export function useIndicatorPoints(id: string | null): Async<Point[]> {
  const [state, setState] = useState<Async<Point[]>>({
    data: null,
    error: null,
    loading: id != null,
  });

  useEffect(() => {
    if (id == null) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    const indicator = INDICATOR_BY_ID.get(id);
    if (!indicator) {
      setState({ data: null, error: new Error(`Unknown indicator ${id}`), loading: false });
      return;
    }

    let live = true;
    setState((s) => ({ ...s, loading: true }));

    loadSeries(id)
      .then((raw) => {
        if (!live) return;
        const points = toPoints(prepareSeries(raw, indicator));
        setState({ data: points, error: null, loading: false });
      })
      .catch((error: Error) => live && setState({ data: null, error, loading: false }));

    return () => {
      live = false;
    };
  }, [id]);

  return state;
}

/** Raw, untransformed levels — used by the compare view's rebasing. */
export function useRawPoints(id: string | null): Async<Point[]> {
  const [state, setState] = useState<Async<Point[]>>({
    data: null,
    error: null,
    loading: id != null,
  });

  useEffect(() => {
    if (id == null) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    let live = true;
    setState((s) => ({ ...s, loading: true }));

    loadSeries(id)
      .then((raw) => live && setState({ data: toPoints(raw), error: null, loading: false }))
      .catch((error: Error) => live && setState({ data: null, error, loading: false }));

    return () => {
      live = false;
    };
  }, [id]);

  return state;
}
