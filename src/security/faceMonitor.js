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
          minDetectionConfidence: 0.5
        });
      } catch (gpuErr) {
        console.warn('[FaceMonitor] GPU delegate failed, falling back to CPU:', gpuErr.message);
        this.detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/blaze_face_short_range.tflite',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5
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
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: true
      });

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
    this.emitEvent({
      type: 'CAMERA_DISCONNECTED',
      message: `Camera disconnected: ${reason}`,
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Starts continuous detection loop.
   */
  startMonitoring(intervalMs = 300, onEventCallback) {
    if (this.isDetecting) return;
    this.isDetecting = true;
    if (onEventCallback) {
      this.listeners.add(onEventCallback);
    }

    this.noFaceStartTime = null;
    this.stableOneFaceDuration = 0;

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
  }

  /**
   * Analyzes an active video frame with MediaPipe FaceDetector.
   */
  async processFrame() {
    if (!this.cameraConnected || !this.videoElement || !this.detector) {
      return;
    }

    if (this.videoElement.readyState < 2 || this.videoElement.videoWidth === 0) {
      return;
    }

    try {
      const now = performance.now();
      const result = this.detector.detectForVideo(this.videoElement, now);
      const faces = result?.detections || [];
      const faceCount = faces.length;
      this.currentFaceCount = faceCount;

      if (faceCount === 1) {
        // EXACTLY ONE FACE (Normal State)
        this.noFaceStartTime = null;
        this.stableOneFaceDuration += 300;

        if (this.lastState !== 'ONE_FACE') {
          this.lastState = 'ONE_FACE';
          this.emitEvent({
            type: 'ONE_FACE',
            faceCount: 1,
            message: 'Single candidate face confirmed present',
            severity: 'info',
            timestamp: new Date().toISOString()
          });
        }
      } else if (faceCount === 0) {
        // NO FACE DETECTED
        this.stableOneFaceDuration = 0;
        const nowMs = Date.now();
        if (!this.noFaceStartTime) {
          this.noFaceStartTime = nowMs;
        }

        const absentSeconds = Math.round((nowMs - this.noFaceStartTime) / 1000);

        if (this.lastState !== 'NO_FACE') {
          this.lastState = 'NO_FACE';
        }

        // Graduated escalation based on absence duration
        let severity = 'low';
        if (absentSeconds > 10) severity = 'high';
        else if (absentSeconds > 4) severity = 'medium';

        // Throttle emission to once every 2 seconds
        if (nowMs - this.lastDetectionTimestamp > 2000) {
          this.lastDetectionTimestamp = nowMs;
          this.emitEvent({
            type: 'FACE_NOT_DETECTED',
            faceCount: 0,
            absentSeconds,
            message: `Candidate face not detected (${absentSeconds}s absent)`,
            severity,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // MULTIPLE FACES DETECTED (>= 2)
        this.stableOneFaceDuration = 0;
        this.noFaceStartTime = null;
        this.lastState = 'MULTIPLE_FACES';

        const nowMs = Date.now();
        if (nowMs - this.lastDetectionTimestamp > 2000) {
          this.lastDetectionTimestamp = nowMs;
          this.emitEvent({
            type: 'MULTIPLE_FACES_DETECTED',
            faceCount,
            message: `Multiple faces detected in camera frame (${faceCount} faces)`,
            severity: 'critical',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn('[FaceMonitor] Frame processing error:', err.message);
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
