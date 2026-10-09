/**
 * VigilExam - useFaceMonitor Hook
 * 
 * Manages video element lifecycle, real camera stream verification,
 * and live MediaPipe BlazeFace detection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { faceMonitor } from '../security/faceMonitor';

export const useFaceMonitor = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [faceState, setFaceState] = useState('INIT'); // 'ONE_FACE', 'NO_FACE', 'MULTIPLE_FACES', 'CAMERA_DISCONNECTED'
  const [faceCount, setFaceCount] = useState(0);
  const [absentSeconds, setAbsentSeconds] = useState(0);
  const [cameraError, setCameraError] = useState(null);

  const startCamera = useCallback(async (videoElement) => {
    setCameraError(null);
    const res = await faceMonitor.startCamera(videoElement);
    if (res.success) {
      setCameraActive(true);
      setHasVideoTrack(res.hasVideoTrack);
      setHasAudioTrack(res.hasAudioTrack);
      return true;
    } else {
      setCameraActive(false);
      setCameraError(res.error || 'Camera unavailable');
      setFaceState('CAMERA_DISCONNECTED');
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    faceMonitor.stopCamera();
    setCameraActive(false);
    setHasVideoTrack(false);
    setHasAudioTrack(false);
    setFaceState('INIT');
    setFaceCount(0);
    setAbsentSeconds(0);
  }, []);

  const startMonitoring = useCallback((onEventCallback) => {
    faceMonitor.startMonitoring(350, (event) => {
      if (event.type === 'ONE_FACE') {
        setFaceState('ONE_FACE');
        setFaceCount(1);
        setAbsentSeconds(0);
      } else if (event.type === 'NO_FACE') {
        setFaceState('NO_FACE');
        setFaceCount(0);
        setAbsentSeconds(event.absentSeconds || 0);
      } else if (event.type === 'MULTIPLE_FACES_DETECTED') {
        setFaceState('MULTIPLE_FACES');
        setFaceCount(event.faceCount || 2);
        setAbsentSeconds(0);
      } else if (event.type === 'CAMERA_DISCONNECTED') {
        setFaceState('CAMERA_DISCONNECTED');
        setCameraActive(false);
      }

      if (onEventCallback) {
        onEventCallback(event);
      }
    });
  }, []);

  const stopMonitoring = useCallback(() => {
    faceMonitor.stopMonitoring();
  }, []);

  useEffect(() => {
    return () => {
      faceMonitor.stopCamera();
    };
  }, []);

  return {
    cameraActive,
    hasVideoTrack,
    hasAudioTrack,
    faceState,
    faceCount,
    absentSeconds,
    cameraError,
    startCamera,
    stopCamera,
    startMonitoring,
    stopMonitoring
  };
};
