import React, { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import { useSpring, a } from '@react-spring/three';

function AnimatedSphere({ position, color, size, opacity }) {
  const { pos } = useSpring({
    pos: position,
    config: { mass: 1, tension: 120, friction: 14 }
  });

  return (
    <a.mesh position={pos}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </a.mesh>
  );
}

function AnimatedLine({ start, end, color }) {
  // Line interpolation is tricky in React Spring natively without custom frame loops, 
  // so we'll use a standard Line but animate the sphere anchors.
  // When 'start' and 'end' change instantly, the Line snaps, but the spheres glide.
  return <Line points={[start, end]} color={color} lineWidth={4} />;
}

export function HilbertManifold({ refScores = [], testScores = [], isRegimeShift = false, fStat = 0 }) {
  
  // Format scatter data
  const refPoints = useMemo(() => {
    if (!refScores || refScores.length === 0) return [];
    if (typeof refScores[0] === 'number') return [refScores];
    return refScores;
  }, [refScores]);

  const testPoints = useMemo(() => {
    if (!testScores || testScores.length === 0) return [];
    if (typeof testScores[0] === 'number') return [testScores];
    return testScores;
  }, [testScores]);

  // Calculate centroids
  const refCentroid = useMemo(() => {
    if (refPoints.length === 0) return [0,0,0];
    const sum = refPoints.reduce((acc, val) => [acc[0] + val[0], acc[1] + (val[1]||0), acc[2] + (val[2]||0)], [0,0,0]);
    return sum.map(v => v / refPoints.length);
  }, [refPoints]);

  const testCentroid = useMemo(() => {
    if (testPoints.length === 0) return [0,0,0];
    const sum = testPoints.reduce((acc, val) => [acc[0] + val[0], acc[1] + (val[1]||0), acc[2] + (val[2]||0)], [0,0,0]);
    return sum.map(v => v / testPoints.length);
  }, [testPoints]);

  const divergence = useMemo(() => {
    const diff = refCentroid.map((r, i) => testCentroid[i] - r);
    return Math.sqrt(diff.reduce((s, v) => s + v * v, 0));
  }, [refCentroid, testCentroid]);

  // Scale factor to make the plot fit nicely in the view (FPCA scores can be large)
  const scale = 5.0; 
  const pRef = refPoints.map(p => [p[0]*scale, (p[1]||0)*scale, (p[2]||0)*scale]);
  const pTest = testPoints.map(p => [p[0]*scale, (p[1]||0)*scale, (p[2]||0)*scale]);
  const cRef = refCentroid.map(v => v*scale);
  const cTest = testCentroid.map(v => v*scale);

  return (
    <div className="glass-panel" style={{ height: '350px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--border-radius-lg)' }}>
      {/* Overlay labels */}
      <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 10, pointerEvents: 'none' }}>
        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>3D Functional Score Space (PC1, PC2, PC3)</strong>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
          <span style={{ color: '#3b82f6' }}>●</span> Reference Population &nbsp;
          <span style={{ color: isRegimeShift ? '#ef4444' : '#22d3ee' }}>●</span> Test Population
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
          Geometric Shift ‖Δξ‖: {divergence.toFixed(3)} | F-Stat: {fStat.toFixed(2)}
        </div>
      </div>

      <div style={{
        position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 10,
        padding: '0.2rem 0.6rem', borderRadius: '15px', fontSize: '0.65rem', fontWeight: 'bold',
        backgroundColor: isRegimeShift ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.15)',
        color: isRegimeShift ? '#ef4444' : '#22d3ee',
        border: `1px solid ${isRegimeShift ? '#ef4444' : '#22d3ee'}`,
        pointerEvents: 'none'
      }}>
        {isRegimeShift ? '⚠ STRUCTURAL SHIFT' : '◉ DEMOGRAPHICALLY STABLE'}
      </div>

      <Canvas camera={{ position: [25, 20, 25], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[20, 20, 20]} intensity={1.0} />
        <pointLight position={[-20, -20, -20]} intensity={0.5} />
        
        {/* Axes */}
        <Line points={[[-20, 0, 0], [20, 0, 0]]} color="rgba(255,255,255,0.2)" lineWidth={1} />
        <Line points={[[0, -20, 0], [0, 20, 0]]} color="rgba(255,255,255,0.2)" lineWidth={1} />
        <Line points={[[0, 0, -20], [0, 0, 20]]} color="rgba(255,255,255,0.2)" lineWidth={1} />
        <Text position={[21, 0, 0]} fontSize={1} color="rgba(255,255,255,0.5)">PC1</Text>
        <Text position={[0, 21, 0]} fontSize={1} color="rgba(255,255,255,0.5)">PC2</Text>
        <Text position={[0, 0, 21]} fontSize={1} color="rgba(255,255,255,0.5)">PC3</Text>

        {/* Reference Population Spheres */}
        {pRef.map((pos, i) => (
          <AnimatedSphere key={`ref-${i}`} position={pos} color="#3b82f6" size={0.3} opacity={0.6} />
        ))}

        {/* Test Population Spheres */}
        {pTest.map((pos, i) => (
          <AnimatedSphere key={`test-${i}`} position={pos} color={isRegimeShift ? "#ef4444" : "#22d3ee"} size={0.4} opacity={0.9} />
        ))}

        {/* Centroids and Geometric Shift Vector */}
        {pRef.length > 0 && pTest.length > 0 && (
          <>
            <AnimatedSphere position={cRef} color="#ffffff" size={0.6} opacity={1.0} />
            <AnimatedSphere position={cTest} color={isRegimeShift ? "#ffaaaa" : "#aaffaa"} size={0.6} opacity={1.0} />
            
            <AnimatedLine start={cRef} end={cTest} color={isRegimeShift ? "#ef4444" : "#10b981"} />
          </>
        )}

        <OrbitControls enableZoom={true} autoRotate autoRotateSpeed={1.0} />
      </Canvas>
    </div>
  );
}
