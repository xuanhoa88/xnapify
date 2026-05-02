/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_COLUMN_WIDTH = 240;
const GUTTER = 16;
const RESIZE_DEBOUNCE_MS = 200;

/**
 * Compute masonry positions for items using the shortest-column algorithm.
 * Items are placed left-to-right into the shortest column (Pinterest-style).
 *
 * @param {number[]} heights - Measured heights of each item.
 * @param {number} columnCount - Number of columns.
 * @param {number} columnWidth - Width of each column in px.
 * @param {number} gutter - Space between items in px.
 * @returns {{ positions: Array<{top: number, left: number, width: number, height: number}>, containerHeight: number }}
 */
function computePositions(heights, columnCount, columnWidth, gutter) {
  const columnHeights = new Array(columnCount).fill(0);
  const positions = [];

  for (let i = 0; i < heights.length; i++) {
    // Find the shortest column
    let shortestCol = 0;
    for (let c = 1; c < columnCount; c++) {
      if (columnHeights[c] < columnHeights[shortestCol]) {
        shortestCol = c;
      }
    }

    const top = columnHeights[shortestCol];
    const left = shortestCol * (columnWidth + gutter);

    positions.push({
      top: top,
      left: left,
      width: columnWidth,
      height: heights[i],
    });

    columnHeights[shortestCol] = top + heights[i] + gutter;
  }

  let containerHeight = 0;
  for (let c = 0; c < columnCount; c++) {
    if (columnHeights[c] > containerHeight) {
      containerHeight = columnHeights[c];
    }
  }

  // Remove trailing gutter from container height
  if (containerHeight > 0) {
    containerHeight = containerHeight - gutter;
  }

  return { positions, containerHeight };
}

/**
 * Custom hook for masonry layout.
 * Observes container width, measures item heights via a hidden render pass,
 * then computes absolute positions using the shortest-column algorithm.
 *
 * @param {object} options
 * @param {Array} options.items - Data items array.
 * @param {number} [options.columnWidth=240] - Target width of each column.
 * @returns {{ containerRef: React.RefObject, measureRef: React.RefObject, positions: Array, containerHeight: number, containerWidth: number, columnWidth: number, isReady: boolean }}
 */
export function useMasonryLayout({ items, columnWidth: targetColumnWidth }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const resizeTimerRef = useRef(null);

  const colWidth = targetColumnWidth || DEFAULT_COLUMN_WIDTH;

  const [state, setState] = useState({
    containerWidth: 0,
    positions: [],
    containerHeight: 0,
    resolvedColumnWidth: colWidth,
    isReady: false,
  });

  /**
   * Measure all child elements in the measurement container and compute layout.
   */
  const measureAndLayout = useCallback(() => {
    const container = containerRef.current;
    const measureContainer = measureRef.current;
    if (!container || !measureContainer) return;

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    // Calculate column count from available width
    const rawColumnCount = Math.floor(
      (containerWidth + GUTTER) / (colWidth + GUTTER),
    );
    const columnCount = Math.max(1, rawColumnCount);

    // Distribute remaining space equally across columns
    const totalGutters = (columnCount - 1) * GUTTER;
    const actualColumnWidth = Math.floor(
      (containerWidth - totalGutters) / columnCount,
    );

    // Measure heights from hidden measurement container
    const measureChildren = measureContainer.children;
    const heights = [];
    for (let i = 0; i < measureChildren.length; i++) {
      heights.push(measureChildren[i].offsetHeight);
    }

    if (heights.length === 0) return;

    const result = computePositions(
      heights,
      columnCount,
      actualColumnWidth,
      GUTTER,
    );

    setState({
      containerWidth: containerWidth,
      positions: result.positions,
      containerHeight: result.containerHeight,
      resolvedColumnWidth: actualColumnWidth,
      isReady: true,
    });
  }, [colWidth]);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(function handleResize() {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = setTimeout(function debouncedLayout() {
        measureAndLayout();
      }, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(container);

    // Initial measurement
    measureAndLayout();

    return function cleanup() {
      observer.disconnect();
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, [measureAndLayout]);

  // Re-measure when items change
  useEffect(() => {
    // Use requestAnimationFrame to let the measurement DOM update first
    const frameId = requestAnimationFrame(function onFrame() {
      measureAndLayout();
    });
    return function cancelFrame() {
      cancelAnimationFrame(frameId);
    };
  }, [items, measureAndLayout]);

  return {
    containerRef: containerRef,
    measureRef: measureRef,
    positions: state.positions,
    containerHeight: state.containerHeight,
    containerWidth: state.containerWidth,
    columnWidth: state.resolvedColumnWidth,
    isReady: state.isReady,
  };
}
