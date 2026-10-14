import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, InputGroup, Icon, Intent } from '@blueprintjs/core';
import type PeerConnection from '../../features/PeerConnection';
import './index.css';

interface ConsoleActionPadProps {
	peer?: PeerConnection;
	isOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	isFullscreen?: boolean;
	isVisible?: boolean;
}

const STORAGE_KEY_AUTOCOLLAPSE = 'deskreen_ai_pad_autocollapse';

const ConsoleActionPad: React.FC<ConsoleActionPadProps> = ({
	peer,
	isOpen: externalIsOpen,
	onOpenChange,
	isFullscreen = false,
	isVisible = true,
}) => {
	const [internalIsOpen, setInternalIsOpen] = useState(false);
	const currentIsOpen =
		typeof externalIsOpen === 'boolean' ? externalIsOpen : internalIsOpen;

	const setIsOpen = useCallback(
		(open: boolean) => {
			if (typeof externalIsOpen === 'boolean') {
				onOpenChange?.(open);
			} else {
				setInternalIsOpen(open);
			}
		},
		[externalIsOpen, onOpenChange],
	);

	const [autoCollapse, setAutoCollapse] = useState<boolean>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_AUTOCOLLAPSE);
			return saved !== null ? saved === 'true' : true;
		} catch {
			return true;
		}
	});

	const [keyboardOffset, setKeyboardOffset] = useState(0);

	useEffect(() => {
		if (typeof window === 'undefined' || !window.visualViewport) return;
		const vv = window.visualViewport;
		const handleViewportChange = () => {
			const offset = Math.max(
				0,
				window.innerHeight - (vv.offsetTop + vv.height),
			);
			setKeyboardOffset(offset);
		};
		vv.addEventListener('resize', handleViewportChange);
		vv.addEventListener('scroll', handleViewportChange);
		return () => {
			vv.removeEventListener('resize', handleViewportChange);
			vv.removeEventListener('scroll', handleViewportChange);
		};
	}, []);

	useEffect(() => {
		if (!currentIsOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setIsOpen(false);
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [currentIsOpen, setIsOpen]);

	const toggleAutoCollapse = useCallback(() => {
		setAutoCollapse((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY_AUTOCOLLAPSE, String(next));
			} catch {
				// ignore
			}
			return next;
		});
	}, []);
	const [inputText, setInputText] = useState('');
	const [feedback, setFeedback] = useState<string | null>(null);
	const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isLockedRef = useRef(false);

	const blurActiveElement = useCallback(() => {
		if (
			typeof document !== 'undefined' &&
			document.activeElement instanceof HTMLElement
		) {
			document.activeElement.blur();
		}
	}, []);

	const triggerFeedback = useCallback((label: string) => {
		if (feedbackTimeoutRef.current) {
			clearTimeout(feedbackTimeoutRef.current);
		}
		setFeedback(label);
		feedbackTimeoutRef.current = setTimeout(() => {
			setFeedback(null);
		}, 1800);
	}, []);

	const sendInput = useCallback(
		(
			payload: {
				action: 'key' | 'text' | 'macro';
				key?: string;
				text?: string;
				macro?: string;
				autoEnter?: boolean;
			},
			label: string,
		) => {
			if (!peer) {
				triggerFeedback('Sin conexión');
				return;
			}
			// Prevent accidental double clicks / duplicate submissions
			if (isLockedRef.current) {
				return;
			}
			isLockedRef.current = true;
			setTimeout(() => {
				isLockedRef.current = false;
			}, 350);

			blurActiveElement();

			try {
				if (typeof peer.sendRemoteInput === 'function') {
					peer.sendRemoteInput(payload);
				} else {
					peer.sendEncryptedMessage({
						type: 'REMOTE_CONSOLE_INPUT',
						payload,
					});
				}
				triggerFeedback(`Enviado: ${label}`);
				if (autoCollapse) {
					setTimeout(() => {
						setIsOpen(false);
					}, 120);
				}
			} catch (err) {
				console.warn('[ConsoleActionPad] Failed to send remote input:', err);
				triggerFeedback('Error de envío');
			}
		},
		[peer, triggerFeedback, blurActiveElement, setIsOpen, autoCollapse],
	);

	const handleSendOption = useCallback(
		(opt: string) => {
			sendInput(
				{
					action: 'key',
					key: opt,
					autoEnter: true,
				},
				opt,
			);
		},
		[sendInput],
	);

	const handleMacro = useCallback(
		(macroType: 'approve' | 'reject' | 'interrupt', label: string) => {
			sendInput(
				{
					action: 'macro',
					macro: macroType,
				},
				label,
			);
		},
		[sendInput],
	);

	const handleKey = useCallback(
		(key: string, autoEnter = false) => {
			sendInput(
				{
					action: 'key',
					key,
					autoEnter,
				},
				key,
			);
			if (key === 'Esc' || key === 'Escape') {
				setIsOpen(false);
			}
		},
		[sendInput, setIsOpen],
	);

	const handleSubmitText = useCallback(
		(e?: React.FormEvent) => {
			if (e) {
				e.preventDefault();
				e.stopPropagation();
			}
			const trimmed = inputText.trim();
			setInputText('');
			if (!trimmed) return;
			sendInput(
				{
					action: 'text',
					text: trimmed,
					autoEnter: true,
				},
				`"${trimmed}"`,
			);
		},
		[inputText, sendInput],
	);

	if (!isVisible) {
		return null;
	}

	return (
		<>
			{!currentIsOpen && !isFullscreen && (
				<Button
					className="console-action-pad-toggle"
					intent={Intent.PRIMARY}
					icon={<Icon icon="console" />}
					onClick={() => setIsOpen(true)}
					text="IA Console Pad"
				/>
			)}

			{currentIsOpen && (
				<>
					<div
						className={`console-action-pad-backdrop ${isFullscreen ? 'is-fullscreen' : ''}`}
						onClick={() => setIsOpen(false)}
						aria-label="Cerrar modal"
					/>
					<div
						className={`console-action-pad-drawer ${isFullscreen ? 'is-fullscreen' : ''}`}
						style={
							keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined
						}
					>
						<div
							className="console-pad-handle-bar"
							onClick={() => setIsOpen(false)}
							title="Tocar para ocultar"
						/>
						<div className="console-pad-header">
							<div className="console-pad-title">
								<Icon icon="console" />
								<span>IA Console Companion</span>
								{feedback && (
									<span className="console-pad-feedback-badge">{feedback}</span>
								)}
							</div>
							<div className="console-pad-header-actions">
								<Button
									minimal
									small
									className={`console-pad-autocollapse-btn ${autoCollapse ? 'is-active' : ''}`}
									icon={autoCollapse ? 'eye-off' : 'eye-open'}
									onClick={toggleAutoCollapse}
									title={
										autoCollapse
											? 'Auto-ocultar activado (se cierra al enviar respuesta)'
											: 'Auto-ocultar desactivado (permanece abierto)'
									}
									text={autoCollapse ? 'Auto-ocultar' : 'Fijado'}
								/>
								<Button
									minimal
									small
									icon="chevron-down"
									onClick={() => setIsOpen(false)}
									text="Ocultar"
								/>
							</div>
						</div>

						{/* AI Options Grid: A, B, C, D & 1, 2, 3, 4 */}
						<div className="console-pad-grid">
							{['A', 'B', 'C', 'D'].map((opt) => (
								<Button
									key={opt}
									className="console-pad-btn console-pad-btn-option"
									onClick={() => handleSendOption(opt)}
									text={opt}
								/>
							))}
						</div>
						<div className="console-pad-grid">
							{['1', '2', '3', '4'].map((num) => (
								<Button
									key={num}
									className="console-pad-btn console-pad-btn-option"
									onClick={() => handleSendOption(num)}
									text={num}
								/>
							))}
						</div>

						{/* Fast AI Action Macros */}
						<div className="console-pad-grid">
							<Button
								className="console-pad-btn"
								intent={Intent.SUCCESS}
								icon="tick"
								onClick={() => handleMacro('approve', 'Aprobar (y)')}
								text="Y (Aprobar)"
							/>
							<Button
								className="console-pad-btn"
								intent={Intent.DANGER}
								icon="cross"
								onClick={() => handleMacro('reject', 'Rechazar (n)')}
								text="N (Rechazar)"
							/>
							<Button
								className="console-pad-btn"
								intent={Intent.PRIMARY}
								icon="key-enter"
								onClick={() => handleKey('Enter')}
								text="Enter"
							/>
							<Button
								className="console-pad-btn"
								intent={Intent.WARNING}
								icon="stop"
								onClick={() => handleMacro('interrupt', 'Ctrl+C')}
								text="Ctrl+C"
							/>
						</div>

						{/* Navigation & Terminal Control Keys */}
						<div className="console-pad-grid">
							<Button
								className="console-pad-btn console-pad-btn-option"
								icon="arrow-up"
								onClick={() => handleKey('Up')}
								text="Historial ↑"
							/>
							<Button
								className="console-pad-btn console-pad-btn-option"
								icon="arrow-down"
								onClick={() => handleKey('Down')}
								text="Historial ↓"
							/>
							<Button
								className="console-pad-btn console-pad-btn-option"
								icon="key-tab"
								onClick={() => handleKey('Tab')}
								text="Tab"
							/>
							<Button
								className="console-pad-btn console-pad-btn-option"
								icon="key-escape"
								onClick={() => handleKey('Esc')}
								text="Esc"
							/>
						</div>

						{/* Quick preset chips */}
						<div className="console-pad-chips-row">
							{['1a', '1b', '2a', '2b', 'proceder', 'npm test'].map((chip) => (
								<Button
									key={chip}
									minimal
									className="console-pad-chip"
									onClick={() => {
										sendInput(
											{ action: 'text', text: chip, autoEnter: true },
											chip,
										);
									}}
									text={chip}
								/>
							))}
						</div>

						{/* Custom text input */}
						<form onSubmit={handleSubmitText} className="console-pad-input-row">
							<InputGroup
								className="console-pad-input"
								placeholder="Escribir respuesta para la consola..."
								value={inputText}
								onChange={(e) => setInputText(e.target.value)}
								leftIcon="edit"
							/>
							<Button
								type="submit"
								intent={Intent.PRIMARY}
								icon="send-message"
								text="Enviar"
							/>
						</form>
					</div>
				</>
			)}
		</>
	);
};

export default ConsoleActionPad;
