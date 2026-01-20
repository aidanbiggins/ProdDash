import React, { useEffect, useRef } from 'react';

interface LogoIconProps {
  className?: string;
  size?: number;
  /** Enable electrical pulse effect - use for large background versions */
  pulse?: boolean;
}

// Dodecahedron vertices (20 vertices)
// Golden ratio
const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

// Normalized dodecahedron vertices
const VERTICES: [number, number, number][] = [
  // Cube vertices (±1, ±1, ±1)
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  // Rectangle vertices (0, ±φ, ±1/φ)
  [0, PHI, INV_PHI], [0, PHI, -INV_PHI], [0, -PHI, INV_PHI], [0, -PHI, -INV_PHI],
  // Rectangle vertices (±1/φ, 0, ±φ)
  [INV_PHI, 0, PHI], [-INV_PHI, 0, PHI], [INV_PHI, 0, -PHI], [-INV_PHI, 0, -PHI],
  // Rectangle vertices (±φ, ±1/φ, 0)
  [PHI, INV_PHI, 0], [PHI, -INV_PHI, 0], [-PHI, INV_PHI, 0], [-PHI, -INV_PHI, 0],
];

// Dodecahedron edges (30 edges) - pairs of vertex indices
const EDGES: [number, number][] = [
  // Connect cube vertices to rectangle vertices
  [0, 8], [0, 12], [0, 16],
  [1, 9], [1, 14], [1, 16],
  [2, 10], [2, 12], [2, 17],
  [3, 11], [3, 14], [3, 17],
  [4, 8], [4, 13], [4, 18],
  [5, 9], [5, 15], [5, 18],
  [6, 10], [6, 13], [6, 19],
  [7, 11], [7, 15], [7, 19],
  // Connect rectangle vertices
  [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19],
];

/**
 * LogoIcon - A rotating wireframe dodecahedron (Platonic solid)
 * Represents "Perfect Form" - math made beautiful
 * Technical Luxury aesthetic with glowing cyan wireframes
 * Features subtle electrical pulse traveling through edges
 */
export function LogoIcon({ className = '', size = 48, pulse = false }: LogoIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const angleRef = useRef({ x: 0, y: 0 });
  const pulseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = size * 0.28;
    const centerX = size / 2;
    const centerY = size / 2;

    // Rotation matrices
    const rotateX = (point: [number, number, number], angle: number): [number, number, number] => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        point[0],
        point[1] * cos - point[2] * sin,
        point[1] * sin + point[2] * cos,
      ];
    };

    const rotateY = (point: [number, number, number], angle: number): [number, number, number] => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        point[0] * cos + point[2] * sin,
        point[1],
        -point[0] * sin + point[2] * cos,
      ];
    };

    const rotateZ = (point: [number, number, number], angle: number): [number, number, number] => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        point[0] * cos - point[1] * sin,
        point[0] * sin + point[1] * cos,
        point[2],
      ];
    };

    // Project 3D to 2D with perspective
    const project = (point: [number, number, number]): [number, number, number] => {
      const fov = 4;
      const z = point[2] + fov;
      const projectionScale = fov / z;
      return [
        centerX + point[0] * scale * projectionScale,
        centerY + point[1] * scale * projectionScale,
        z, // Keep z for depth sorting
      ];
    };

    // Calculate pulse intensity for an edge based on its position in the cycle
    const getPulseIntensity = (edgeIndex: number, totalEdges: number): number => {
      const edgePosition = edgeIndex / totalEdges;
      const pulsePosition = pulseRef.current;

      // Distance from pulse (wrapping around)
      let distance = Math.abs(edgePosition - pulsePosition);
      if (distance > 0.5) distance = 1 - distance;

      // Gaussian-like falloff for smooth pulse - narrower width for sharper pulse
      const pulseWidth = 0.08; // Narrower for more defined pulse
      const intensity = Math.exp(-(distance * distance) / (2 * pulseWidth * pulseWidth));

      return intensity;
    };

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Update rotation - glacially slow, barely perceptible
      angleRef.current.x += 0.0003;
      angleRef.current.y += 0.0004;

      // Update pulse - travels through edges slowly (only when pulse effect enabled)
      if (pulse) {
        pulseRef.current += 0.0015; // Slower pulse for subtlety
        if (pulseRef.current > 1) pulseRef.current = 0;
      }

      // Transform all vertices
      const transformedVertices = VERTICES.map((v) => {
        let point = rotateX(v, angleRef.current.x);
        point = rotateY(point, angleRef.current.y);
        point = rotateZ(point, angleRef.current.x * 0.5);
        return project(point);
      });

      // Sort edges by average depth for proper rendering
      const edgesWithDepth = EDGES.map((edge, index) => {
        const v1 = transformedVertices[edge[0]];
        const v2 = transformedVertices[edge[1]];
        const avgDepth = (v1[2] + v2[2]) / 2;
        return { edge, v1, v2, depth: avgDepth, index };
      }).sort((a, b) => a.depth - b.depth);

      // Draw edges with depth-based opacity (and electrical pulse if enabled)
      edgesWithDepth.forEach(({ v1, v2, depth, index }) => {
        // Depth ranges roughly from 2.5 to 5.5, normalize to 0.3-1.0 opacity
        const baseOpacity = 0.3 + (depth - 2.5) / 4 * 0.7;
        const lineWidth = 1 + (depth - 2.5) / 4 * 1.5;

        // Get pulse intensity for this edge (only if pulse enabled)
        const pulseIntensity = pulse ? getPulseIntensity(index, EDGES.length) : 0;

        // Blend base opacity with pulse (pulse adds noticeable brightness)
        const opacity = baseOpacity + pulseIntensity * 0.6;
        const pulseGlow = pulseIntensity * 1.0;

        // Outer glow - much stronger when pulse is active
        ctx.beginPath();
        ctx.moveTo(v1[0], v1[1]);
        ctx.lineTo(v2[0], v2[1]);
        ctx.strokeStyle = `rgba(56, 189, 248, ${(baseOpacity * 0.3) + pulseGlow * 0.6})`;
        ctx.lineWidth = lineWidth + 3 + pulseIntensity * 8;
        ctx.stroke();

        // Middle glow layer for pulse effect (brighter, more visible)
        if (pulse && pulseIntensity > 0.1) {
          ctx.beginPath();
          ctx.moveTo(v1[0], v1[1]);
          ctx.lineTo(v2[0], v2[1]);
          ctx.strokeStyle = `rgba(120, 220, 255, ${pulseIntensity * 0.8})`;
          ctx.lineWidth = lineWidth + 2 + pulseIntensity * 3;
          ctx.stroke();
        }

        // Inner bright line - pulses to white
        ctx.beginPath();
        ctx.moveTo(v1[0], v1[1]);
        ctx.lineTo(v2[0], v2[1]);
        const lineOpacity = Math.min(1, opacity + pulseIntensity * 0.4);
        ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
        ctx.lineWidth = lineWidth + pulseIntensity * 1;
        ctx.stroke();
      });

      // Draw vertices as glowing points
      transformedVertices.forEach((v, vIndex) => {
        const baseOpacity = 0.4 + (v[2] - 2.5) / 4 * 0.6;
        const radius = 1 + (v[2] - 2.5) / 4 * 1.5;

        // Check if any connected edge has pulse (only if pulse enabled)
        let vertexPulse = 0;
        if (pulse) {
          EDGES.forEach((edge, eIndex) => {
            if (edge[0] === vIndex || edge[1] === vIndex) {
              vertexPulse = Math.max(vertexPulse, getPulseIntensity(eIndex, EDGES.length));
            }
          });
        }

        const opacity = baseOpacity + vertexPulse * 0.5;

        // Outer glow halo when pulse hits - very visible
        if (pulse && vertexPulse > 0.3) {
          ctx.beginPath();
          ctx.arc(v[0], v[1], radius + 6 + vertexPulse * 12, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${vertexPulse * 0.4})`;
          ctx.fill();
        }

        // Glow - stronger when pulse hits vertex (vertex flash effect)
        ctx.beginPath();
        ctx.arc(v[0], v[1], radius + 2 + vertexPulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${(baseOpacity * 0.5) + vertexPulse * 0.8})`;
        ctx.fill();

        // Bright flash at vertex when pulse hits
        if (pulse && vertexPulse > 0.4) {
          ctx.beginPath();
          ctx.arc(v[0], v[1], radius + 2 + vertexPulse * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 240, 255, ${vertexPulse * 0.9})`;
          ctx.fill();
        }

        // Core - brighter during pulse
        ctx.beginPath();
        ctx.arc(v[0], v[1], radius + vertexPulse * 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, opacity + vertexPulse * 0.3)})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [size, pulse]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{
        filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))',
      }}
    />
  );
}

export default LogoIcon;
