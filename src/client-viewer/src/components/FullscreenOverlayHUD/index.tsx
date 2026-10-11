import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Icon, Intent } from '@blueprintjs/core';
import './index.css';

interface FullscreenOverlayHUDProps {
	onExitFullscreen: () => void;
	isAIPadOpen: boolean;
	onToggleAIPad: () => void;
	showAIPad?: boolean;
	isPlaying?: boolean;
	onTogglePlayPause?: () => void;
	brightness?: number;
	onCycleBrightness?: () => void;
	onToggleOrientation?: () => void;
}

const STORAGE_KEY_POS = 'deskreen_fullscreen_hud_pos';

interface Position {
	x: number;
	y: number;
}

export const FullscreenOverlayHUD: React.FC<FullscreenOverlayHUDProps> = ({
	onExitFullscreen,
	isAIPadOpen,
	onToggleAIPad,
	showAIPad = true,
	isPlaying = true,
	onTogglePlayPause,
	brightness = 1.0,
	onCycleBrightness,
	onToggleOrientation,
}) => {
	const [position, setPosition] = useState<Position | null>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_POS);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
					return parsed;
				}
			}
		} catch {
			// ignore storage errors
		}
		return null;
	});

	const [isDimmed, setIsDimmed] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
	const hudRef = useRef<HTMLDivElement>(null);
	const dimTimerRef = useRef<NodeJS.Timeout | null>(null);

	const resetDimTimer = useCallback(() => {
		setIsDimmed(false);
		if (dimTimerRef.current) {
			clearTimeout(dimTimerRef.current);
		}
		if (!isAIPadOpen) {
			dimTimerRef.current = setTimeout(() => {
				setIsDimmed(true);
			}, 3000);
		}
	}, [isAIPadOpen]);

	useEffect(() => {
		resetDimTimer();
		const handleActivity = () => resetDimTimer();

		window.addEventListener('mousemove', handleActivity, { passive: true });
		window.addEventListener('touchstart', handleActivity, { passive: true });
		window.addEventListener('pointermove', handleActivity, { passive: true });

		return () => {
			if (dimTimerRef.current) {
				clearTimeout(dimTimerRef.current);
			}
			window.removeEventListener('mousemove', handleActivity);
			window.removeEventListener('touchstart', handleActivity);
			window.removeEventListener('pointermove', handleActivity);
		};
	}, [resetDimTimer]);

	// Dragging logic for repositioning HUD
	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		// Only start drag if dragging handle or container, not directly buttons
		if ((e.target as HTMLElement).closest('button')) {
			return;
		}
		const hudEl = hudRef.current;
		if (!hudEl) return;

		dragStartRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			initX: hudEl.offsetLeft,
			initY: hudEl.offsetTop,
		};
		setIsDragging(true);
		setIsDimmed(false);
		hudEl.setPointerCapture(e.pointerId);
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!isDragging || !dragStartRef.current) return;
		const deltaX = e.clientX - dragStartRef.current.startX;
		const deltaY = e.clientY - dragStartRef.current.startY;

		const hudEl = hudRef.current;
		const parent = hudEl?.parentElement;
		const hudWidth = hudEl?.offsetWidth || 220;
		const hudHeight = hudEl?.offsetHeight || 48;
		const parentWidth = parent?.clientWidth || window.innerWidth;
		const parentHeight = parent?.clientHeight || window.innerHeight;

		const maxX = Math.max(0, parentWidth - hudWidth);
		const maxY = Math.max(0, parentHeight - hudHeight);

		const nextX = Math.min(Math.max(8, dragStartRef.current.initX + deltaX), maxX - 8);
		const nextY = Math.min(Math.max(8, dragStartRef.current.initY + deltaY), maxY - 8);

		const newPos = { x: nextX, y: nextY };
		setPosition(newPos);
	};

	const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDragging) {
			setIsDragging(false);
			if (hudRef.current) {
				try {
					hudRef.current.releasePointerCapture(e.pointerId);
				} catch {
					// safe fallback
				}
			}
			if (position) {
				try {
					localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(position));
				} catch {
					// ignore
				}
			}
			dragStartRef.current = null;
			resetDimTimer();
		}
	};

	const style: React.CSSProperties = position
		? {
				left: `${position.x}px`,
				top: `${position.y}px`,
				right: 'auto',
				bottom: 'auto',
		  }
		: {};

	return (
		<div
			ref={hudRef}
			className={`fullscreen-overlay-hud ${isDimmed && !isAIPadOpen && !isDragging ? 'hud-dimmed' : ''}`}
			style={style}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			title="Arrastra para mover o usa los controles"
		>
			<div className="fullscreen-hud-drag-handle" title="Arrastrar posición">
				<Icon icon="drag-handle-vertical" />
			</div>

			{/* Exit Fullscreen / Back Button */}
			<Button
				minimal
				className="fullscreen-hud-btn fullscreen-hud-btn-exit"
				icon={<Icon icon="minimize" />}
				onClick={(e) => {
					e.stopPropagation();
					onExitFullscreen();
				}}
				title="Salir de pantalla completa"
			/>

			{/* Native Screen Orientation Toggle (Landscape / Portrait) */}
			{onToggleOrientation && (
				<Button
					minimal
					className="fullscreen-hud-btn fullscreen-hud-btn-rotate"
					icon={<Icon icon="mobile-phone" />}
					onClick={(e) => {
						e.stopPropagation();
						onToggleOrientation();
					}}
					title="Rotar orientación de pantalla (Horizontal/Vertical)"
				/>
			)}

			{/* Screen Dimmer / Brightness Cycle (100% -> 75% -> 50% -> 30%) */}
			{onCycleBrightness && (
				<Button
					minimal
					className={`fullscreen-hud-btn fullscreen-hud-btn-brightness ${brightness < 1.0 ? 'is-dimmed-active' : ''}`}
					icon={<Icon icon={brightness <= 0.5 ? 'moon' : 'flash'} />}
					onClick={(e) => {
						e.stopPropagation();
						onCycleBrightness();
					}}
					title={`Iluminación/Brillo: ${Math.round(brightness * 100)}% (Tocar para cambiar)`}
				>
					<span className="fullscreen-hud-brightness-badge">
						{Math.round(brightness * 100)}%
					</span>
				</Button>
			)}

			{/* Native Video Play / Pause */}
			{onTogglePlayPause && (
				<Button
					minimal
					className={`fullscreen-hud-btn fullscreen-hud-btn-playpause ${!isPlaying ? 'is-paused' : ''}`}
					icon={<Icon icon={isPlaying ? 'pause' : 'play'} />}
					onClick={(e) => {
						e.stopPropagation();
						onTogglePlayPause();
					}}
					title={isPlaying ? 'Pausar video' : 'Reanudar video'}
				/>
			)}

			{/* AI Console Companion Trigger Button */}
			{showAIPad && (
				<Button
					minimal={!isAIPadOpen}
					intent={isAIPadOpen ? Intent.PRIMARY : Intent.NONE}
					className={`fullscreen-hud-btn fullscreen-hud-btn-ai ${isAIPadOpen ? 'is-active' : ''}`}
					icon={<Icon icon="console" />}
					onClick={(e) => {
						e.stopPropagation();
						onToggleAIPad();
					}}
					title={isAIPadOpen ? 'Ocultar consola IA' : 'Abrir consola IA'}
				>
					<span className="fullscreen-hud-ai-label">IA</span>
					{isAIPadOpen && <span className="fullscreen-hud-active-dot" />}
				</Button>
			)}
		</div>
	);
};

export default FullscreenOverlayHUD;
