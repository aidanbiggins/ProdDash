import React, { useEffect, useRef } from 'react';

interface NetworkBackgroundProps {
  scrollProgress: number; // 0 to 1 representing scroll through page
}

/**
 * NetworkBackground - Abstract visualization of "connecting segments, unlocking understanding"
 * Nodes scattered across viewport, connections form and pulses flow as you scroll
 */
export function NetworkBackground({ scrollProgress }: NetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const scrollProgressRef = useRef(scrollProgress);
  const nodesRef = useRef<Array<{
    x: number;
    y: number;
    size: number;
    pulseOffset: number;
    unlockAt: number;
    connections: number[];
  }>>([]);

  // Update scroll progress ref without triggering re-render
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  // Generate nodes to fill beyond the viewport (no visible edges)
  const generateNodes = () => {
    const nodes: typeof nodesRef.current = [];

    // Extend beyond viewport edges so network feels infinite
    const overflow = 150;
    const leftBound = -overflow;
    const rightBound = window.innerWidth + overflow;
    const topBound = -overflow;
    const bottomBound = window.innerHeight + overflow;

    const cols = 8;
    const rows = 7;
    const usableWidth = rightBound - leftBound;
    const usableHeight = bottomBound - topBound;
    const cellW = usableWidth / cols;
    const cellH = usableHeight / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Random position within cell with some jitter
        const x = leftBound + col * cellW + cellW * 0.25 + Math.random() * cellW * 0.5;
        const y = topBound + row * cellH + cellH * 0.25 + Math.random() * cellH * 0.5;

        nodes.push({
          x,
          y,
          size: 2 + Math.random() * 2,
          pulseOffset: Math.random() * Math.PI * 2,
          unlockAt: Math.max(0, ((row * cols + col) / (rows * cols) - 0.3) * 0.2), // Most nodes visible immediately, all by 15% scroll
          connections: [],
        });
      }
    }

    // Create connections to nearby nodes
    nodes.forEach((node, i) => {
      const nearby = nodes
        .map((other, j) => ({
          j,
          dist: Math.hypot(node.x - other.x, node.y - other.y),
        }))
        .filter(({ j, dist }) => j !== i && dist < 350)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      node.connections = nearby.map(n => n.j);
    });

    nodesRef.current = nodes;
  };

  // Initialize canvas and animation loop once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to full window size and regenerate nodes on resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      generateNodes();
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      timeRef.current += 0.016;
      const time = timeRef.current;
      const nodes = nodesRef.current;
      const currentScrollProgress = scrollProgressRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      nodes.forEach((node, i) => {
        const nodeVisible = currentScrollProgress >= node.unlockAt;
        if (!nodeVisible) return;

        const nodeAlpha = Math.min(1, (currentScrollProgress - node.unlockAt) * 3);

        node.connections.forEach(j => {
          const target = nodes[j];
          const targetVisible = currentScrollProgress >= target.unlockAt;
          if (!targetVisible) return;

          const targetAlpha = Math.min(1, (currentScrollProgress - target.unlockAt) * 3);
          const alpha = Math.min(nodeAlpha, targetAlpha);

          // Connection line
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.2})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Traveling pulse
          const pulseT = (time * 0.15 + node.pulseOffset) % 1;
          const px = node.x + (target.x - node.x) * pulseT;
          const py = node.y + (target.y - node.y) * pulseT;

          // Pulse glow
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.25})`;
          ctx.fill();

          // Pulse core
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 240, 255, ${alpha * 0.8})`;
          ctx.fill();
        });
      });

      // Draw nodes
      nodes.forEach((node, i) => {
        const nodeVisible = currentScrollProgress >= node.unlockAt;
        if (!nodeVisible) return;

        const alpha = Math.min(1, (currentScrollProgress - node.unlockAt) * 3);
        const pulse = 0.7 + Math.sin(time * 2 + node.pulseOffset) * 0.3;

        // Outer glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.15 * pulse})`;
        ctx.fill();

        // Middle ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.35})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
        ctx.fill();
      });

      // "Insight" ripples at scroll milestones
      [0.25, 0.5, 0.75].forEach(threshold => {
        if (currentScrollProgress > threshold && currentScrollProgress < threshold + 0.1) {
          const t = (currentScrollProgress - threshold) / 0.1;
          const radius = t * 400;
          const alpha = (1 - t) * 0.2;

          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []); // Empty dependency array - only run on mount

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        // Keep behind landing content; pages should render their content on a higher z-index.
        zIndex: 0,
        filter: 'blur(2.5px)',
      }}
    />
  );
}

export default NetworkBackground;
