/**
 * VigilExam - Native Face & Biometric Surveillance Monitor
 * 
 * Employs local MediaPipe BlazeFace detection with zero CDN dependencies.
 * Distinguishes:
 * - CAMERA_DISCONNECTED (hardware/track loss)
 * - FACE_NOT_DETECTED (0 faces)
 * - MULTIPLE_FACES_DETECTED (>= 2 faces)
 * - ONE_FACE (normal state)
 */

import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

class FaceMonitor {
  constructor() {
    this.detector = null;
    this.stream = null;
    this.videoElement = null;
    this.isDetecting = false;
    this.loopTimer = null;
    this.listeners = new Set();

    // State tracking
    this.currentFaceCount = 0;
    this.cameraConnected = false;
    this.lastState = 'INIT';
    this.noFaceStartTime = null;
    this.stableOneFaceDuration = 0;
    this.lastDetectionTimestamp = 0;
    this.lastVideoTimestamp = 0;
    this.isProcessingFrame = false;

    // Real-time continuous elapsed calibration parameters
    this.calibrationStartTime = null;
    this.lastValidFaceTime = 0;
    this.isCalibrated = false;
    this.targetCalibrationMs = 2000; // 2 continuous seconds required
    this.gracePeriodMs = 600;        // 600ms transient jitter tolerance (blinks, frame dips)
  }

  /**
   * Initializes MediaPipe BlazeFace using self-contained local model assets.
   */
  async initializeDetector() {
    if (this.detector) return this.detector;

    try {
      // 1. Load local WASM files
      const vision = await FilesetResolver.forVisionTasks('/mediapipe_wasm');

      // 2. Try GPU delegate first, fallback to CPU
      try {
        this.detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.4
        });
      } catch (gpuErr) {
        console.warn('[FaceMonitor] GPU delegate fallback to CPU:', gpuErr.message);
        this.detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/blaze_face_short_range.tflite',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.4
        });
      }

      console.info('[FaceMonitor] MediaPipe BlazeFace Detector initialized successfully');
      return this.detector;
    } catch (err) {
      console.error('[FaceMonitor] Failed to initialize MediaPipe BlazeFace:', err);
      return null;
    }
  }

  /**
   * Starts local camera feed and verifies live track metadata.
   */
  async startCamera(videoElement) {
    this.videoElement = videoElement;

    try {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: true
        });
      } catch (mediaErr) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }
        });
      }

      const videoTrack = this.stream.getVideoTracks()[0];
      const audioTrack = this.stream.getAudioTracks()[0];

      if (!videoTrack || videoTrack.readyState !== 'live') {
        throw new Error('Video track is not active');
      }

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => {
            this.videoElement.play().catch(() => {});
            resolve(true);
          };
          // Timeout fallback
          setTimeout(resolve, 1000);
        });
      }

      this.cameraConnected = true;
      this.resetCalibration('Camera initialized');

      // Track disconnection handlers
      videoTrack.onended = () => {
        this.handleCameraDisconnect('Video track ended');
      };
      videoTrack.onmute = () => {
        this.handleCameraDisconnect('Video track muted');
      };

      await this.initializeDetector();
      return {
        success: true,
        stream: this.stream,
        hasVideoTrack: Boolean(videoTrack),
        hasAudioTrack: Boolean(audioTrack)
      };
    } catch (err) {
      this.cameraConnected = false;
      this.handleCameraDisconnect(err.message);
      return { success: false, error: err.message };
    }
  }

  handleCameraDisconnect(reason) {
    this.cameraConnected = false;
    this.currentFaceCount = 0;
    this.resetCalibration(`Camera disconnected: ${reason}`);
    this.emitEvent({
      type: 'CAMERA_DISCONNECTED',
      faceCount: 0,
      calibrated: false,
      stableSeconds: 0,
      message: `Camera disconnected: ${reason}`,
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
  }

  resetCalibration(reason = 'Reset') {
    if (this.calibrationStartTime || this.isCalibrated) {
      console.info(`[FaceMonitor] Calibration reset. Reason: ${reason}`);
    }
    this.calibrationStartTime = null;
    this.lastValidFaceTime = 0;
    this.isCalibrated = false;
    this.stableOneFaceDuration = 0;
  }

  /**
   * Starts continuous detection loop with intervalMs (default 150ms).
   */
  startMonitoring(intervalMs = 150, onEventCallback) {
    if (onEventCallback) {
      this.listeners.add(onEventCallback);
    }

    if (this.isDetecting) return;
    this.isDetecting = true;
    this.resetCalibration('Monitoring started');

    this.loopTimer = setInterval(async () => {
      await this.processFrame();
    }, intervalMs);
  }

  stopMonitoring() {
    this.isDetecting = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.isProcessingFrame = false;
    this.listeners.clear();
    this.resetCalibration('Monitoring stopped');
  }

  stopCamera() {
    this.stopMonitoring();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.cameraConnected = false;
    this.lastState = 'INIT';
  }

  /**
   * Analyzes an active video frame with MediaPipe FaceDetector.
   */
  async processFrame() {
    if (!this.cameraConnected || !this.videoElement || !this.detector) {
      return;
    }

    // Ensure valid video dimensions and ready state
    if (
      this.videoElement.readyState < 2 ||
      this.videoElement.videoWidth === 0 ||
      this.videoElement.videoHeight === 0
    ) {
      return;
    }

    // Concurrency guard to prevent overlapping detections
    if (this.isProcessingFrame) {
      return;
    }
    this.isProcessingFrame = true;

    try {
      // Ensure monotonically increasing timestamp for MediaPipe
      const perfNow = performance.now();
      const videoTimestamp = Math.max(perfNow, (this.lastVideoTimestamp || 0) + 1);
      this.lastVideoTimestamp = videoTimestamp;

      const result = this.detector.detectForVideo(this.videoElement, videoTimestamp);
      const faces = result?.detections || [];
      const faceCount = faces.length;
      this.currentFaceCount = faceCount;
      const nowMs = Date.now();
      const confidence = faces[0]?.categories?.[0]?.score || (faceCount === 1 ? 0.85 : 0);

      if (faceCount === 1) {
        // EXACTLY ONE FACE DETECTED
        this.noFaceStartTime = null;
        this.lastValidFaceTime = nowMs;

        // Start calibration timer if not already active
        if (!this.calibrationStartTime) {
          this.calibrationStartTime = nowMs;
          console.info('[FaceMonitor] Single face detected; calibration timer started (0/2s)');
        }

        const elapsedMs = nowMs - this.calibrationStartTime;
        this.stableOneFaceDuration = elapsedMs;
        const stableSeconds = Math.min(2, Math.floor(elapsedMs / 1000));

        if (elapsedMs >= this.targetCalibrationMs && !this.isCalibrated) {
          this.isCalibrated = true;
          console.info('[FaceMonitor] Single face presence calibrated successfully (2/2s)');
        }

        const progressPayload = {
          type: 'CALIBRATION_PROGRESS',
          faceCount: 1,
          calibrated: this.isCalibrated,
          stableSeconds: this.isCalibrated ? 2 : stableSeconds,
          elapsedMs,
          confidence,
          isJitterGrace: false,
          message: this.isCalibrated ? 'Single candidate face confirmed (2/2s)' : `Calibrating facial presence (${stableSeconds}/2s)`,
          timestamp: new Date().toISOString()
        };

        // Emit progress on every single frame/tick
        this.emitEvent(progressPayload);

        // Also emit discrete state transition event for backwards compatibility
        if (this.lastState !== 'ONE_FACE') {
          this.lastState = 'ONE_FACE';
          this.emitEvent({
            ...progressPayload,
            type: 'ONE_FACE',
            severity: 'info'
          });
        }
      } else if (faceCount === 0) {
        // NO FACE DETECTED
        const timeSinceValidFace = nowMs - this.lastValidFaceTime;

        // Check if within transient jitter tolerance window (e.g. 600ms grace period)
        if (this.calibrationStartTime && timeSinceValidFace <= this.gracePeriodMs) {
          const currentElapsedMs = Math.max(0, this.lastValidFaceTime - this.calibrationStartTime);
          const stableSeconds = Math.min(2, Math.floor(currentElapsedMs / 1000));

          this.emitEvent({
            type: 'CALIBRATION_PROGRESS',
            faceCount: 0,
            calibrated: this.isCalibrated,
            stableSeconds: this.isCalibrated ? 2 : stableSeconds,
            elapsedMs: currentElapsedMs,
            confidence: 0,
            isJitterGrace: true,
            message: 'Holding calibration during transient frame jitter',
            timestamp: new Date().toISOString()
          });
        } else {
          // Genuinely absent beyond grace period
          if (this.calibrationStartTime || this.isCalibrated) {
            this.resetCalibration(`Face genuinely absent for ${timeSinceValidFace}ms`);
          }

          if (!this.noFaceStartTime) {
            this.noFaceStartTime = nowMs;
          }
          const absentSeconds = Math.round((nowMs - this.noFaceStartTime) / 1000);

          if (this.lastState !== 'NO_FACE') {
            this.lastState = 'NO_FACE';
          }

          let severity = 'low';
          if (absentSeconds > 10) severity = 'high';
          else if (absentSeconds > 4) severity = 'medium';

          const noFacePayload = {
            type: 'FACE_NOT_DETECTED',
            faceCount: 0,
            calibrated: false,
            stableSeconds: 0,
            absentSeconds,
            isJitterGrace: false,
            message: `Candidate face not detected (${absentSeconds}s absent)`,
            severity,
            timestamp: new Date().toISOString()
          };

          this.emitEvent(noFacePayload);

          // Emit NO_FACE event for ExamKiosk compatibility
          this.emitEvent({
            ...noFacePayload,
            type: 'NO_FACE'
          });
        }
      } else {
        // MULTIPLE FACES DETECTED (>= 2) - Immediate reset (no grace period)
        this.resetCalibration(`Multiple faces detected in camera frame (${faceCount})`);
        this.noFaceStartTime = null;
        this.lastState = 'MULTIPLE_FACES';

        this.emitEvent({
          type: 'MULTIPLE_FACES_DETECTED',
          faceCount,
          calibrated: false,
          stableSeconds: 0,
          isJitterGrace: false,
          message: `Multiple faces detected in camera frame (${faceCount} faces)`,
          severity: 'critical',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('[FaceMonitor] Frame processing error:', err.message);
    } finally {
      this.isProcessingFrame = false;
    }
  }

  emitEvent(event) {
    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch (e) {
        console.error('[FaceMonitor] Callback error:', e);
      }
    }
  }
}

export const faceMonitor = new FaceMonitor();
