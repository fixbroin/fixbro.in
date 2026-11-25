"use client";

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import type { SeasonalEffectConfig, SeasonalEffectMode } from '@/types/firestore';

interface SeasonalEffectsOverlayProps {
  initialSeasonalEffect?: SeasonalEffectConfig;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  vRot: number;
  color: string;
  hue: number;
  swayOffset: number;
  swaySpeed: number;
  shape: 'drop' | 'petal' | 'circle' | 'rect' | 'cloud' | 'sparkle' | 'png' | 'text';
}

const MODE_PALETTES: Record<string, string[]> = {
  diwali: ['#FF9933', '#FFB800', '#FF6B00', '#FFD700', '#FF4500'],
  holi: ['#FF2E93', '#00D2FF', '#FFD500', '#22C55E', '#A855F7', '#FF6B00'],
  celebration: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
  tricolor: ['#FF9933', '#FFFFFF', '#138808'],
  spring: ['#F9A8D4', '#FBCFE8', '#FFFFFF', '#F472B6', '#FDA4AF'],
  sunshine: ['#FDE68A', '#FCD34D', '#FEF08A', '#FBBF24'],
};

const getCountForMode = (mode: SeasonalEffectMode, intensity: 'light' | 'medium' | 'festive'): number => {
  const mult = intensity === 'light' ? 0.6 : intensity === 'festive' ? 1.5 : 1;
  switch (mode) {
    case 'rain':
      return Math.round(65 * mult);
    case 'clouds':
      return Math.round(7 * mult);
    case 'snow':
      return Math.round(45 * mult);
    case 'sunshine':
      return Math.round(28 * mult);
    case 'custom-png':
      return Math.round(22 * mult);
    case 'custom-text':
      return Math.round(12 * mult);
    default:
      return Math.round(32 * mult);
  }
};

export default function SeasonalEffectsOverlay({ initialSeasonalEffect }: SeasonalEffectsOverlayProps) {
  const pathname = usePathname();
  const { settings } = useGlobalSettings();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const effectConfig = settings?.seasonalEffect ?? initialSeasonalEffect;
  const mode: SeasonalEffectMode = effectConfig?.mode || 'none';
  const intensity = effectConfig?.intensity || 'medium';
  const scope = effectConfig?.scope || 'all';
  const customImageUrl = effectConfig?.customImageUrl;
  const customText = (effectConfig?.customText || '').trim();
  const durationType = effectConfig?.durationType || 'always';
  const startAt = effectConfig?.startAt;
  const expiresAt = effectConfig?.expiresAt;

  const [isWithinSchedule, setIsWithinSchedule] = useState<boolean>(true);

  useEffect(() => {
    if (durationType === 'always' || (!startAt && !expiresAt)) {
      setIsWithinSchedule(true);
      return;
    }

    const evaluateSchedule = () => {
      const now = Date.now();
      const startMs = startAt ? Date.parse(startAt) : NaN;
      const endMs = expiresAt ? Date.parse(expiresAt) : NaN;

      if (!Number.isNaN(startMs) && now < startMs) {
        setIsWithinSchedule(false);
        return Math.min(startMs - now, 2147483647);
      }
      if (!Number.isNaN(endMs) && now >= endMs) {
        setIsWithinSchedule(false);
        return null;
      }
      setIsWithinSchedule(true);
      if (!Number.isNaN(endMs)) {
        return Math.min(endMs - now, 2147483647);
      }
      return null;
    };

    const nextWaitMs = evaluateSchedule();
    if (nextWaitMs === null || nextWaitMs <= 0) return;

    const timer = setTimeout(() => {
      evaluateSchedule();
    }, nextWaitMs + 100);

    return () => clearTimeout(timer);
  }, [durationType, startAt, expiresAt]);

  const isExcludedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/provider') ||
    pathname.startsWith('/auth');

  const isScopeAllowed = scope === 'all' || pathname === '/';
  const isActive =
    mode !== 'none' &&
    isWithinSchedule &&
    !isExcludedRoute &&
    isScopeAllowed &&
    (mode !== 'custom-png' || Boolean(customImageUrl)) &&
    (mode !== 'custom-text' || Boolean(customText));

  useEffect(() => {
    if (!isActive) return;

    // Respect user reduced-motion preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let isDark = document.documentElement.classList.contains('dark');

    const themeObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let customImg: HTMLImageElement | null = null;
    let customImgLoaded = false;

    if (mode === 'custom-png' && customImageUrl) {
      customImg = new Image();
      customImg.crossOrigin = 'anonymous';
      customImg.onload = () => {
        customImgLoaded = true;
      };
      customImg.src = customImageUrl;
    }

    const count = getCountForMode(mode, intensity);
    const palette = MODE_PALETTES[mode] || ['#FFFFFF'];

    const createParticle = (initialSpawn: boolean): Particle => {
      const color = palette[Math.floor(Math.random() * palette.length)];

      if (mode === 'rain') {
        return {
          x: Math.random() * (width + 100) - 50,
          y: initialSpawn ? Math.random() * height : -30 - Math.random() * 100,
          vx: -1.8 - Math.random() * 1.2,
          vy: 11 + Math.random() * 7,
          size: 14 + Math.random() * 14,
          alpha: 0.45 + Math.random() * 0.35,
          rotation: 0,
          vRot: 0,
          color: 'rain',
          hue: 200,
          swayOffset: 0,
          swaySpeed: 0,
          shape: 'drop',
        };
      }

      if (mode === 'clouds') {
        return {
          x: initialSpawn ? Math.random() * width : -220 - Math.random() * 120,
          y: 25 + Math.random() * Math.max(120, height * 0.22),
          vx: 0.25 + Math.random() * 0.35,
          vy: 0,
          size: 72 + Math.random() * 65,
          alpha: 0.42 + Math.random() * 0.22,
          rotation: 0,
          vRot: 0,
          color: 'cloud',
          hue: 0,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.005,
          shape: 'cloud',
        };
      }

      if (mode === 'snow') {
        return {
          x: Math.random() * width,
          y: initialSpawn ? Math.random() * height : -15 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 1.0 + Math.random() * 1.6,
          size: 3 + Math.random() * 4.5,
          alpha: 0.72 + Math.random() * 0.25,
          rotation: 0,
          vRot: 0,
          color: 'snow',
          hue: 200,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.015 + Math.random() * 0.02,
          shape: 'circle',
        };
      }

      if (mode === 'sunshine') {
        const sunLightColors = ['#F59E0B', '#D97706', '#FBBF24', '#EA580C'];
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.25 - Math.random() * 0.45,
          size: 7 + Math.random() * 12,
          alpha: 0.35 + Math.random() * 0.3,
          rotation: Math.random() * Math.PI * 2,
          vRot: 0.01,
          color: sunLightColors[Math.floor(Math.random() * sunLightColors.length)],
          hue: 40,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.02,
          shape: 'sparkle',
        };
      }

      if (mode === 'custom-png') {
        return {
          x: Math.random() * width,
          y: initialSpawn ? Math.random() * height : -50 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 1.3 + Math.random() * 1.6,
          size: 24 + Math.random() * 22,
          alpha: 0.8 + Math.random() * 0.2,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.025,
          color: '#FFFFFF',
          hue: 0,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.02 + Math.random() * 0.02,
          shape: 'png',
        };
      }

      if (mode === 'custom-text') {
        return {
          x: Math.random() * Math.max(120, width - 80) + 40,
          y: initialSpawn ? Math.random() * height : -40 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 0.9 + Math.random() * 1.1,
          size: 13 + Math.random() * 7,
          alpha: 0.82 + Math.random() * 0.18,
          rotation: (Math.random() - 0.5) * 0.22,
          vRot: (Math.random() - 0.5) * 0.004,
          color: '#FFFFFF',
          hue: Math.floor(Math.random() * 360),
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.018 + Math.random() * 0.015,
          shape: 'text',
        };
      }

      // Festival modes: diwali, holi, celebration, tricolor, spring
      const shape: Particle['shape'] =
        mode === 'celebration'
          ? 'rect'
          : mode === 'holi'
          ? (Math.random() > 0.4 ? 'circle' : 'petal')
          : mode === 'diwali'
          ? (Math.random() > 0.75 ? 'sparkle' : 'petal')
          : 'petal';

      return {
        x: Math.random() * width,
        y: initialSpawn ? Math.random() * height : -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.7,
        vy: 1.4 + Math.random() * 1.8,
        size: shape === 'circle' ? 4 + Math.random() * 6 : 7 + Math.random() * 7,
        alpha: 0.65 + Math.random() * 0.3,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.05,
        color,
        hue: 0,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.02,
        shape,
      };
    };

    const particles: Particle[] = Array.from({ length: count }, () => createParticle(true));

    const drawCloud = (p: Particle) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(148, 163, 184, 0.58)';
      ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.14)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const r = p.size * 0.35;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.arc(p.x + r * 0.85, p.y - r * 0.25, r * 0.85, 0, Math.PI * 2);
      ctx.arc(p.x + r * 1.7, p.y, r * 0.75, 0, Math.PI * 2);
      ctx.arc(p.x - r * 0.75, p.y + r * 0.1, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawSparkle = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      const s = p.size * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(0, 0, s, 0);
      ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.swayOffset += p.swaySpeed;
        p.x += p.vx + (p.shape !== 'drop' && p.shape !== 'cloud' ? Math.sin(p.swayOffset) * 0.65 : 0);
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.shape === 'drop') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = isDark ? 'rgba(147, 197, 253, 0.88)' : 'rgba(2, 132, 199, 0.78)';
          ctx.lineWidth = isDark ? 1.5 : 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.4, p.y + p.size);
          ctx.stroke();
          ctx.restore();
        } else if (p.shape === 'cloud') {
          drawCloud(p);
        } else if (p.shape === 'sparkle') {
          drawSparkle(p);
        } else if (p.shape === 'png' && customImg && customImgLoaded) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.drawImage(customImg, -p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else if (p.shape === 'circle') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          if (p.color === 'snow') {
            ctx.fillStyle = '#FFFFFF';
            if (!isDark) {
              ctx.strokeStyle = 'rgba(14, 165, 233, 0.6)';
              ctx.lineWidth = 1;
              ctx.shadowColor = 'rgba(2, 132, 199, 0.35)';
              ctx.shadowBlur = 4;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            if (!isDark) ctx.stroke();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (p.shape === 'rect') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
          ctx.restore();
        } else if (p.shape === 'petal') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.65, p.size * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.shape === 'text' && customText) {
          p.hue = (p.hue + 0.8) % 360;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = `700 ${Math.round(p.size)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lightness = isDark ? '68%' : '42%';
          ctx.fillStyle = `hsl(${p.hue}, 88%, ${lightness})`;
          ctx.shadowColor = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
          ctx.shadowBlur = 4;
          ctx.fillText(customText, 0, 0);
          ctx.restore();
        }

        // Recycle out-of-bounds particles
        if (p.shape === 'cloud') {
          if (p.x - p.size * 2 > width) {
            particles[i] = createParticle(false);
          }
        } else if (mode === 'sunshine') {
          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
        } else if (p.y > height + 40 || p.x < -80 || p.x > width + 80) {
          particles[i] = createParticle(false);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      themeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, mode, intensity, customImageUrl, customText]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[45] w-full h-full"
    />
  );
}
