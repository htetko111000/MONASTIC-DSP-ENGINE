/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export default function AudioVisualizer({ analyser, isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high resolution for retina screens
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Setup audio data buffers
    let bufferLength = analyser ? analyser.frequencyBinCount : 128;
    let dataArray = new Uint8Array(bufferLength);

    let angle = 0; // for idle wave animation

    const draw = () => {
      const width = canvas.getBoundingClientRect().width;
      const height = canvas.getBoundingClientRect().height;
      if (width === 0 || height === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Create a warm, dark, elegant gradient background for the visualizer itself
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "rgba(25, 20, 15, 0.85)"); // very dark warm charcoal/sienna
      bgGrad.addColorStop(1, "rgba(15, 12, 10, 0.95)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal reference grid lines for zen appearance
      ctx.strokeStyle = "rgba(217, 119, 6, 0.04)"; // very faint amber/gold
      ctx.lineWidth = 1;
      for (let y = height / 5; y < height; y += height / 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isPlaying && analyser) {
        // ACTIVE PLAYING VISUALIZATION: Golden monk energy waves
        analyser.getByteTimeDomainData(dataArray);

        // We will draw three layers of waveforms with different opacities to simulate group depth
        const drawLayer = (sliceOffset: number, color: string, lineWidth: number, amplitudeMultiplier: number) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            // Get sample (-1.0 to 1.0)
            const v = (dataArray[i] / 128.0) - 1.0;
            // Shift sample slightly based on layer for visual organic drift
            const shiftIdx = (i + sliceOffset) % bufferLength;
            const shiftedV = ((dataArray[shiftIdx] / 128.0) - 1.0) * amplitudeMultiplier;
            
            const y = (height / 2) + shiftedV * (height / 2) * 0.85;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.stroke();
        };

        // Inner glowing core
        drawLayer(0, "rgba(251, 191, 36, 0.9)", 3, 1.0); // Bright Gold
        // Ambient secondary monk voice wave
        drawLayer(10, "rgba(245, 158, 11, 0.55)", 2, 0.8); // Saffron
        // Crowd depth atmospheric echo wave
        drawLayer(25, "rgba(185, 28, 28, 0.3)", 1.5, 0.65); // Crimson
        
      } else {
        // IDLE STATE: Soothing meditative breath waves (sine waves)
        angle += 0.015; // speed of breathing cycle

        const drawIdleWave = (phase: number, amplitude: number, speed: number, color: string, widthFactor: number) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = widthFactor;
          
          let x = 0;
          const sliceWidth = width / 100;

          for (let i = 0; i <= 100; i++) {
            const progress = i / 100;
            // Meditative breathing envelope (tapers waves at the edges)
            const envelope = Math.sin(progress * Math.PI);
            
            // Generate nested sine waves
            const y = (height / 2) + 
              Math.sin(progress * Math.PI * 2.5 + angle * speed + phase) * 
              amplitude * envelope * (height * 0.22);

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }
          ctx.stroke();
        };

        // Draw multiple overlapping transparent waves simulating deep breathing chants
        drawIdleWave(0, 1.0, 1.0, "rgba(217, 119, 6, 0.35)", 2);  // Saffron gold
        drawIdleWave(Math.PI / 2, 0.7, 1.2, "rgba(251, 191, 36, 0.2)", 1.5); // Amber core
        drawIdleWave(Math.PI, 0.5, 0.8, "rgba(185, 28, 28, 0.15)", 1); // Crimson drone
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div className="relative w-full h-40 md:h-48 overflow-hidden rounded-xl border border-amber-500/20 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 left-4 flex items-center space-x-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-amber-500 animate-pulse" : "bg-emerald-600/60"}`} />
        <span className="text-[11px] font-mono tracking-wider uppercase text-amber-100/70">
          {isPlaying ? "Dhamma Acoustics Active" : "Meditative Breath Idle"}
        </span>
      </div>
      <div className="absolute bottom-3 right-4">
        <span className="text-[10px] font-mono text-amber-100/40">
          Stereo Churn Engine
        </span>
      </div>
    </div>
  );
}
