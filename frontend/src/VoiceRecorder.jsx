import { useCallback, useEffect, useRef, useState } from "react"

const C = {
  primary: "#ee7f00",
  primaryHover: "#cc6d00",
  border: "#e0e0e0",
  muted: "#888888",
  error: "#ef4444",
  bg: "#f5f5f5",
}

const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
]

function getSupportedMimeType() {
  return RECORDING_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || "audio/webm"
}

const SILENCE_THRESHOLD = 6     // Lautstärke < 6 = Stille
const SILENCE_DURATION_MS = 1800 // 1.8s Stille → automatischer Stopp
const MIN_RECORD_MS = 800        // mind. 800ms aufnehmen vor Auto-Stopp

/**
 * VoiceRecorder — Mikrofon-Komponente mit zwei Modi.
 *
 * Props:
 *   mode: "hold" (Halten zum Sprechen) | "click" (Klicken + Auto-Stopp bei Stille)
 *   onTranscript(blob, mimeType) — wird nach Aufnahme aufgerufen
 *   onError(message)
 *   disabled
 */
export default function VoiceRecorder({ onTranscript, onError, disabled, mode = "click" }) {
  const [state, setState] = useState("idle") // idle | requesting | recording | processing
  const [volume, setVolume] = useState(0)
  const [silenceCountdown, setSilenceCountdown] = useState(0) // 0–100 für Fortschrittsring

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const recordingStartRef = useRef(null)
  const silenceStartRef = useRef(null)
  const stateRef = useRef("idle")
  const stopFnRef = useRef(null)
  const modeRef = useRef(mode)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    return () => {
      stopStream()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function startVolumeMonitor(stream) {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const buf = new Uint8Array(analyser.frequencyBinCount)

    function tick() {
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      const vol = Math.min(100, avg * 2)
      setVolume(vol)

      // Auto-Stopp bei Stille (nur im Klick-Modus)
      if (modeRef.current === "click" && stateRef.current === "recording") {
        const now = Date.now()
        const elapsed = now - (recordingStartRef.current || now)

        if (vol < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = now
          }
          const silenceMs = now - silenceStartRef.current
          if (elapsed > MIN_RECORD_MS) {
            const pct = Math.min(100, (silenceMs / SILENCE_DURATION_MS) * 100)
            setSilenceCountdown(pct)
            if (silenceMs >= SILENCE_DURATION_MS) {
              stopFnRef.current?.()
              return
            }
          }
        } else {
          silenceStartRef.current = null
          setSilenceCountdown(0)
        }
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const stopRecording = useCallback(() => {
    if (stateRef.current !== "recording") return
    cancelAnimationFrame(animFrameRef.current)
    silenceStartRef.current = null
    setSilenceCountdown(0)
    mediaRecorderRef.current?.stop()
  }, [])

  useEffect(() => { stopFnRef.current = stopRecording }, [stopRecording])

  const startRecording = useCallback(async () => {
    if (stateRef.current !== "idle" || disabled) return

    setState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startVolumeMonitor(stream)

      const mimeType = getSupportedMimeType()
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        setVolume(0)
        setSilenceCountdown(0)
        stopStream()

        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 1000) {
          setState("idle")
          return
        }

        setState("processing")
        try {
          await onTranscript(blob, mimeType)
        } catch (err) {
          onError?.(err.message)
        } finally {
          setState("idle")
        }
      }

      mr.start(100)
      recordingStartRef.current = Date.now()
      silenceStartRef.current = null
      setState("recording")
    } catch (err) {
      setState("idle")
      if (err.name === "NotAllowedError") {
        onError?.("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.")
      } else {
        onError?.(`Mikrofon-Fehler: ${err.message}`)
      }
    }
  }, [disabled, onTranscript, onError])

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isRequesting = state === "requesting"

  const btnSize = 88
  const pulseScale = isRecording ? 1 + volume / 500 : 1

  // Countdown-Ring (SVG) für Auto-Stopp
  const ringRadius = 46
  const ringCirc = 2 * Math.PI * ringRadius
  const ringOffset = ringCirc * (1 - silenceCountdown / 100)

  // Event-Handler je nach Modus
  const holdHandlers = {
    onMouseDown: startRecording,
    onMouseUp: stopRecording,
    onMouseLeave: stopRecording,
    onTouchStart: e => { e.preventDefault(); startRecording() },
    onTouchEnd: e => { e.preventDefault(); stopRecording() },
  }
  const clickHandlers = {
    onClick: isRecording ? stopRecording : startRecording,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        {/* Countdown-Ring im Klick-Modus */}
        {mode === "click" && isRecording && (
          <svg
            width={btnSize + 12}
            height={btnSize + 12}
            style={{ position: "absolute", top: -6, left: -6, pointerEvents: "none" }}
          >
            <circle
              cx={(btnSize + 12) / 2}
              cy={(btnSize + 12) / 2}
              r={ringRadius}
              fill="none"
              stroke={C.border}
              strokeWidth={3}
            />
            <circle
              cx={(btnSize + 12) / 2}
              cy={(btnSize + 12) / 2}
              r={ringRadius}
              fill="none"
              stroke={silenceCountdown > 60 ? C.error : C.primary}
              strokeWidth={3}
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${(btnSize + 12) / 2} ${(btnSize + 12) / 2})`}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
        )}

        <button
          {...(mode === "hold" ? holdHandlers : clickHandlers)}
          disabled={disabled || isProcessing || isRequesting}
          title={
            mode === "hold"
              ? (isRecording ? "Loslassen zum Beenden" : "Halten zum Sprechen")
              : (isRecording ? "Klicken zum Beenden" : "Klicken zum Sprechen")
          }
          style={{
            width: btnSize,
            height: btnSize,
            borderRadius: "50%",
            border: "none",
            cursor: disabled || isProcessing ? "not-allowed" : "pointer",
            fontSize: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.1s, box-shadow 0.1s, background 0.2s",
            transform: `scale(${pulseScale})`,
            background: isRecording
              ? C.error
              : isProcessing || isRequesting
              ? C.muted
              : C.primary,
            color: "#fff",
            boxShadow: isRecording
              ? `0 0 0 ${Math.round(volume / 5)}px rgba(239,68,68,0.18), 0 4px 16px rgba(239,68,68,0.4)`
              : "0 4px 16px rgba(238,127,0,0.3)",
            opacity: disabled ? 0.4 : 1,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {isProcessing ? "⏳" : isRecording ? "⏹" : "🎤"}
        </button>
      </div>

      {/* Status */}
      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", minHeight: 18 }}>
        {isRequesting && "Mikrofon-Zugriff..."}
        {isRecording && mode === "hold" && "Aufnahme — loslassen zum Beenden"}
        {isRecording && mode === "click" && (
          silenceCountdown > 0
            ? "Stille erkannt — stoppt gleich..."
            : "Aufnahme läuft — sprechen Sie jetzt"
        )}
        {isProcessing && "Wird verarbeitet..."}
        {state === "idle" && !disabled && (mode === "hold" ? "Halten zum Sprechen" : "Klicken zum Sprechen")}
        {disabled && "Nicht verfügbar"}
      </div>
    </div>
  )
}
