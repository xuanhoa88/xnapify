/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_COLUMN_WIDTH = 240;
const GUTTER = 16;

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
  const [containerNode, setContainerNode] = useState(null);
  const measureRef = useRef(null);

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
    const container = containerNode;
    const measureContainer = measureRef.current;
    if (!container || !measureContainer) return;

    const computedStyle = window.getComputedStyle(container);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const containerWidth = container.clientWidth - paddingLeft - paddingRight;

    if (containerWidth <= 0) return;

    // Dynamically adjust target column width for smaller screens to allow 2 columns on mobile
    const dynamicColWidth = containerWidth < 640 ? 150 : colWidth;

    // Calculate column count from available width
    const rawColumnCount = Math.floor(
      (containerWidth + GUTTER) / (dynamicColWidth + GUTTER),
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

    // Force the new width synchronously onto the measurement DOM nodes
    // so we can read the correct offsetHeight before React re-renders.
    for (let i = 0; i < measureChildren.length; i++) {
      measureChildren[i].style.width = actualColumnWidth + 'px';
    }

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
  }, [colWidth, containerNode]);

  // Observe container resize + window resize
  useEffect(() => {
    const container = containerNode;
    if (!container) return undefined;

    let frameId;

    function scheduleLayout() {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(function onFrame() {
        measureAndLayout();
      });
    }

    // ResizeObserver for container-level size changes (sidebar toggle, etc.)
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(container);

    // Window resize listener — catches browser window drag-resize even when
    // the container element's own box dimensions don't trigger ResizeObserver.
    window.addEventListener('resize', scheduleLayout);

    // Initial measurement
    measureAndLayout();

    return function cleanup() {
      observer.disconnect();
      window.removeEventListener('resize', scheduleLayout);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [measureAndLayout, containerNode]);

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
    containerRef: setContainerNode, // Callback ref!
    measureRef: measureRef,
    positions: state.positions,
    containerHeight: state.containerHeight,
    containerWidth: state.containerWidth,
    columnWidth: state.resolvedColumnWidth,
    isReady: state.isReady,
  };
}
