/**
 * VigilExam - useSecurityMonitor Hook
 * 
 * Manages heartbeat emissions, proctor warning popups, termination alerts,
 * and Electron native event bindings.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { dispatchSecurityEvent } from '../security/securityEvents';

export const useSecurityMonitor = ({
  attempt,
  student,
  telemetry = {},
  onProctorWarning,
  onExamTerminated,
  onSecurityAlert
}) => {
  const { socket } = useSocket();
  const [activeWarning, setActiveWarning] = useState(null);
  const heartbeatTimer = useRef(null);

  // Send candidate heartbeat every 3.5 seconds
  useEffect(() => {
    if (!socket || !attempt) return;

    socket.emit('join_student_room', attempt.id);

    const sendHeartbeat = () => {
      socket.emit('candidate_heartbeat', {
        attempt_id: attempt.id,
        student_id: student?.id,
        student_name: student?.full_name,
        student_code: student?.student_id || 'STUDENT',
        camera_status: telemetry.cameraActive ? 'LIVE' : 'FAILED',
        microphone_status: telemetry.hasAudioTrack ? 'LIVE' : 'FAILED',
        face_status: telemetry.faceState || 'UNKNOWN',
        display_status: telemetry.displayCount === 1 ? '1 DISPLAY' : 'MULTIPLE',
        process_status: telemetry.unauthorizedApp ? 'UNAUTHORIZED' : 'CLEAN',
        network_status: telemetry.isOnline ? 'CONNECTED' : 'DISCONNECTED',
        kiosk_status: telemetry.kioskStatus || 'SECURE',
        risk_score: telemetry.riskScore || 0,
        timestamp: new Date().toISOString()
      });
    };

    sendHeartbeat();
    heartbeatTimer.current = setInterval(sendHeartbeat, 3500);

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
    };
  }, [socket, attempt, student, telemetry]);

  // Listen for proctor warning and termination events
  useEffect(() => {
    if (!socket || !attempt) return;

    const handleWarningReceived = (warning) => {
      setActiveWarning(warning);
      if (onProctorWarning) onProctorWarning(warning);
    };

    const handleTerminated = (termData) => {
      if (onExamTerminated) onExamTerminated(termData);
    };

    socket.on('proctor_warning_received', handleWarningReceived);
    socket.on('exam_terminated', handleTerminated);

    return () => {
      socket.off('proctor_warning_received', handleWarningReceived);
      socket.off('exam_terminated', handleTerminated);
    };
  }, [socket, attempt, onProctorWarning, onExamTerminated]);

  // Acknowledge proctor warning
  const acknowledgeWarning = useCallback(async () => {
    if (!activeWarning) return;
    try {
      await fetch('http://localhost:4000/api/student/warning/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warning_id: activeWarning.id })
      });
      if (socket) {
        socket.emit('warning_acknowledged', { warning_id: activeWarning.id });
      }
    } catch (e) {}
    setActiveWarning(null);
  }, [activeWarning, socket]);

  return {
    activeWarning,
    acknowledgeWarning
  };
};
