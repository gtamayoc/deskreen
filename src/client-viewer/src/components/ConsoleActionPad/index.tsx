import React, { useState, useCallback, useRef } from 'react';
import { Button, InputGroup, Icon, Intent } from '@blueprintjs/core';
import type PeerConnection from '../../features/PeerConnection';
import './index.css';

interface ConsoleActionPadProps {
	peer?: PeerConnection;
}

const ConsoleActionPad: React.FC<ConsoleActionPadProps> = ({ peer }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [inputText, setInputText] = useState('');
	const [feedback, setFeedback] = useState<string | null>(null);
	const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
		(payload: {
			action: 'key' | 'text' | 'macro';
			key?: string;
			text?: string;
			macro?: string;
			autoEnter?: boolean;
		}, label: string) => {
			if (!peer) {
				triggerFeedback('Sin conexión');
				return;
			}
			try {
				peer.sendEncryptedMessage({
					type: 'REMOTE_CONSOLE_INPUT',
					payload,
				});
				triggerFeedback(`Enviado: ${label}`);
			} catch (err) {
				console.warn('[ConsoleActionPad] Failed to send remote input:', err);
				triggerFeedback('Error de envío');
			}
		},
		[peer, triggerFeedback],
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
		},
		[sendInput],
	);

	const handleSubmitText = useCallback(
		(e?: React.FormEvent) => {
			if (e) e.preventDefault();
			const trimmed = inputText.trim();
			if (!trimmed) return;
			sendInput(
				{
					action: 'text',
					text: trimmed,
					autoEnter: true,
				},
				`"${trimmed}"`,
			);
			setInputText('');
		},
		[inputText, sendInput],
	);

	return (
		<>
			{!isOpen && (
				<Button
					className="console-action-pad-toggle"
					intent={Intent.PRIMARY}
					icon={<Icon icon="console" />}
					onClick={() => setIsOpen(true)}
					text="IA Console Pad"
				/>
			)}

			{isOpen && (
				<div className="console-action-pad-drawer">
					<div className="console-pad-header">
						<div className="console-pad-title">
							<Icon icon="console" />
							<span>IA Console Companion</span>
							{feedback && (
								<span className="console-pad-feedback-badge">{feedback}</span>
							)}
						</div>
						<Button
							minimal
							small
							icon="chevron-down"
							onClick={() => setIsOpen(false)}
							text="Ocultar"
						/>
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
									sendInput({ action: 'text', text: chip, autoEnter: true }, chip);
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
							intent={Intent.PRIMARY}
							icon="send-message"
							onClick={() => handleSubmitText()}
							text="Enviar"
						/>
					</form>
				</div>
			)}
		</>
	);
};

export default ConsoleActionPad;
