import { useCallback, useEffect, useRef, useState } from "react"

const C = {
  primary: "#ee7f00",
  border: "#e0e0e0",
  muted: "#888888",
  error: "#ef4444",
  success: "#10b981",
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

// VAD-Parameter
const SPEECH_THRESHOLD = 10       // Lautstärke > 10 = Sprache erkannt
const SPEECH_CONFIRM_FRAMES = 5   // 5 aufeinanderfolgende Frames → Aufnahme starten
const SILENCE_THRESHOLD = 7       // Lautstärke < 7 = Stille
const SILENCE_DURATION_MS = 1800  // 1.8s Stille → Aufnahme stoppen
const MIN_RECORD_MS = 600         // Mindestaufnahme vor Auto-Stopp
const COOLDOWN_MS = 1200          // Pause nach Verarbeitung (verhindert Echo-Trigger)

/**
 * VoiceRecorder — drei Modi:
 *   "hold"  — Halten zum Sprechen (mousedown/mouseup)
 *   "click" — Klicken, Auto-Stopp bei Stille
 *   "auto"  — Dauerhaftes Zuhören, Aufnahme startet automatisch bei Sprache
 *
 * Props:
 *   mode, onTranscript(blob, mimeType), onError(message), disabled, listeningPaused
 */
export default function VoiceRecorder({
  onTranscript,
  onError,
  disabled,
  mode = "click",
  listeningPaused = false,
}) {
  // Für hold/click
  const [state, setState] = useState("idle") // idle | requesting | recording | processing

  // Für auto
  const [autoState, setAutoState] = useState("off") // off | listening | recording | processing | cooldown
  const [volume, setVolume] = useState(0)
  const [silenceProgress, setSilenceProgress] = useState(0) // 0–100 für Ring

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const recordingStartRef = useRef(null)
  const silenceStartRef = useRef(null)
  const speechFramesRef = useRef(0)
  const autoStateRef = useRef("off")
  const stateRef = useRef("idle")
  const modeRef = useRef(mode)
  const listeningPausedRef = useRef(listeningPaused)
  const stopFnRef = useRef(null)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { autoStateRef.current = autoState }, [autoState])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { listeningPausedRef.current = listeningPaused }, [listeningPaused])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      stopStream()
    }
  }, [])

  // Auto-Modus: Stream starten/stoppen wenn Modus wechselt
  useEffect(() => {
    if (mode === "auto" && !disabled) {
      startAutoListening()
    } else {
      stopAutoListening()
    }
    return () => stopAutoListening()
  }, [mode, disabled]) // eslint-disable-line

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // ---------------------------------------------------------------------------
  // Auto-Modus
  // ---------------------------------------------------------------------------

  async function startAutoListening() {
    if (streamRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      setAutoState("listening")
      autoStateRef.current = "listening"
      runVAD(stream)
    } catch (err) {
      onError?.(err.name === "NotAllowedError"
        ? "Mikrofon-Zugriff verweigert."
        : `Mikrofon-Fehler: ${err.message}`)
    }
  }

  function stopAutoListening() {
    cancelAnimationFrame(animFrameRef.current)
    mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop()
    stopStream()
    setAutoState("off")
    autoStateRef.current = "off"
    setVolume(0)
    setSilenceProgress(0)
  }

  function runVAD(stream) {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const mimeType = getSupportedMimeType()

    function tick() {
      if (!streamRef.current) return
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      const vol = Math.min(100, avg * 2)
      setVolume(vol)

      const as = autoStateRef.current

      if (as === "listening") {
        if (listeningPausedRef.current) {
          speechFramesRef.current = 0
        } else if (vol > SPEECH_THRESHOLD) {
          speechFramesRef.current++
          if (speechFramesRef.current >= SPEECH_CONFIRM_FRAMES) {
            speechFramesRef.current = 0
            startAutoRecord(stream, mimeType)
          }
        } else {
          speechFramesRef.current = 0
        }

      } else if (as === "recording") {
        const now = Date.now()
        const elapsed = now - (recordingStartRef.current || now)
        if (vol < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) silenceStartRef.current = now
          const silenceMs = now - silenceStartRef.current
          if (elapsed > MIN_RECORD_MS) {
            setSilenceProgress(Math.min(100, (silenceMs / SILENCE_DURATION_MS) * 100))
            if (silenceMs >= SILENCE_DURATION_MS) {
              setSilenceProgress(0)
              mediaRecorderRef.current?.stop()
              return
            }
          }
        } else {
          silenceStartRef.current = null
          setSilenceProgress(0)
        }
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function startAutoRecord(stream, mimeType) {
    const mr = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mr
    chunksRef.current = []

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    mr.onstop = async () => {
      silenceStartRef.current = null
      setSilenceProgress(0)
      const blob = new Blob(chunksRef.current, { type: mimeType })
      if (blob.size < 1000) {
        setAutoState("listening")
        autoStateRef.current = "listening"
        return
      }
      setAutoState("processing")
      autoStateRef.current = "processing"
      setVolume(0)
      try {
        await onTranscript(blob, mimeType)
      } catch (err) {
        onError?.(err.message)
      } finally {
        // Cooldown vor nächstem Zuhören
        autoStateRef.current = "cooldown"
        setAutoState("cooldown")
        setTimeout(() => {
          if (autoStateRef.current === "cooldown") {
            setAutoState("listening")
            autoStateRef.current = "listening"
            speechFramesRef.current = 0
          }
        }, COOLDOWN_MS)
      }
    }

    mr.start(100)
    recordingStartRef.current = Date.now()
    silenceStartRef.current = null
    setAutoState("recording")
    autoStateRef.current = "recording"
  }

  // ---------------------------------------------------------------------------
  // Hold/Click-Modus (unverändert)
  // ---------------------------------------------------------------------------

  const stopRecording = useCallback(() => {
    if (stateRef.current !== "recording") return
    cancelAnimationFrame(animFrameRef.current)
    setSilenceProgress(0)
    mediaRecorderRef.current?.stop()
  }, [])

  useEffect(() => { stopFnRef.current = stopRecording }, [stopRecording])

  const startRecording = useCallback(async () => {
    if (stateRef.current !== "idle" || disabled) return
    setState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Volume monitor für hold/click
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)

      function tick() {
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setVolume(Math.min(100, avg * 2))

        if (modeRef.current === "click" && stateRef.current === "recording") {
          const now = Date.now()
          const elapsed = now - (recordingStartRef.current || now)
          const vol = Math.min(100, avg * 2)
          if (vol < SILENCE_THRESHOLD) {
            if (!silenceStartRef.current) silenceStartRef.current = now
            const silenceMs = now - silenceStartRef.current
            if (elapsed > MIN_RECORD_MS) {
              setSilenceProgress(Math.min(100, (silenceMs / SILENCE_DURATION_MS) * 100))
              if (silenceMs >= SILENCE_DURATION_MS) {
                stopFnRef.current?.()
                return
              }
            }
          } else {
            silenceStartRef.current = null
            setSilenceProgress(0)
          }
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()

      const mimeType = getSupportedMimeType()
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        setVolume(0); setSilenceProgress(0)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 1000) { setState("idle"); return }
        setState("processing")
        try { await onTranscript(blob, mimeType) }
        catch (err) { onError?.(err.message) }
        finally { setState("idle") }
      }
      mr.start(100)
      recordingStartRef.current = Date.now()
      silenceStartRef.current = null
      setState("recording")
    } catch (err) {
      setState("idle")
      onError?.(err.name === "NotAllowedError"
        ? "Mikrofon-Zugriff verweigert."
        : `Mikrofon-Fehler: ${err.message}`)
    }
  }, [disabled, onTranscript, onError])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (mode === "auto") {
    return <AutoDisplay autoState={autoState} volume={volume} silenceProgress={silenceProgress} />
  }

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isRequesting = state === "requesting"
  const btnSize = 88
  const pulseScale = isRecording ? 1 + volume / 500 : 1
  const ringRadius = 46
  const ringCirc = 2 * Math.PI * ringRadius

  const holdHandlers = {
    onMouseDown: startRecording,
    onMouseUp: stopRecording,
    onMouseLeave: stopRecording,
    onTouchStart: e => { e.preventDefault(); startRecording() },
    onTouchEnd: e => { e.preventDefault(); stopRecording() },
  }
  const clickHandlers = { onClick: isRecording ? stopRecording : startRecording }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        {mode === "click" && isRecording && (
          <svg width={btnSize + 12} height={btnSize + 12}
            style={{ position: "absolute", top: -6, left: -6, pointerEvents: "none" }}>
            <circle cx={(btnSize+12)/2} cy={(btnSize+12)/2} r={ringRadius}
              fill="none" stroke={C.border} strokeWidth={3} />
            <circle cx={(btnSize+12)/2} cy={(btnSize+12)/2} r={ringRadius}
              fill="none" stroke={silenceProgress > 60 ? C.error : C.primary}
              strokeWidth={3}
              strokeDasharray={ringCirc}
              strokeDashoffset={ringCirc * (1 - silenceProgress / 100)}
              strokeLinecap="round"
              transform={`rotate(-90 ${(btnSize+12)/2} ${(btnSize+12)/2})`}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
        )}
        <button
          {...(mode === "hold" ? holdHandlers : clickHandlers)}
          disabled={disabled || isProcessing || isRequesting}
          style={{
            width: btnSize, height: btnSize, borderRadius: "50%", border: "none",
            cursor: disabled || isProcessing ? "not-allowed" : "pointer",
            fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.1s, box-shadow 0.1s, background 0.2s",
            transform: `scale(${pulseScale})`,
            background: isRecording ? C.error : isProcessing || isRequesting ? C.muted : C.primary,
            color: "#fff",
            boxShadow: isRecording
              ? `0 0 0 ${Math.round(volume/5)}px rgba(239,68,68,0.18), 0 4px 16px rgba(239,68,68,0.4)`
              : "0 4px 16px rgba(238,127,0,0.3)",
            opacity: disabled ? 0.4 : 1,
            userSelect: "none", WebkitUserSelect: "none",
          }}
        >
          {isProcessing ? "⏳" : isRecording ? "⏹" : "🎤"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", minHeight: 18 }}>
        {isRequesting && "Mikrofon-Zugriff..."}
        {isRecording && mode === "hold" && "Aufnahme — loslassen zum Beenden"}
        {isRecording && mode === "click" && (silenceProgress > 0 ? "Stille erkannt — stoppt gleich..." : "Aufnahme läuft — sprechen Sie jetzt")}
        {isProcessing && "Wird verarbeitet..."}
        {state === "idle" && !disabled && (mode === "hold" ? "Halten zum Sprechen" : "Klicken zum Sprechen")}
        {disabled && "Nicht verfügbar"}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-Modus Anzeige
// ---------------------------------------------------------------------------

function AutoDisplay({ autoState, volume, silenceProgress }) {
  const isRecording = autoState === "recording"
  const isProcessing = autoState === "processing" || autoState === "cooldown"
  const isListening = autoState === "listening"
  const btnSize = 88
  const pulseScale = isRecording ? 1 + volume / 500 : 1
  const ringRadius = 46
  const ringCirc = 2 * Math.PI * ringRadius

  const statusText = {
    off: "Automatik nicht aktiv",
    listening: "Zuhören — sprechen Sie jetzt",
    recording: silenceProgress > 0 ? "Stille erkannt — stoppt gleich..." : "Aufnahme läuft...",
    processing: "Wird verarbeitet...",
    cooldown: "Kurze Pause...",
  }[autoState] || ""

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        {/* Pulsierender Listening-Ring */}
        {isListening && (
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `2px solid ${C.success}`,
            opacity: 0.6,
            animation: "pulse-ring 1.8s ease-out infinite",
          }} />
        )}

        {/* Countdown-Ring bei Stille */}
        {isRecording && (
          <svg width={btnSize + 12} height={btnSize + 12}
            style={{ position: "absolute", top: -6, left: -6, pointerEvents: "none" }}>
            <circle cx={(btnSize+12)/2} cy={(btnSize+12)/2} r={ringRadius}
              fill="none" stroke={C.border} strokeWidth={3} />
            <circle cx={(btnSize+12)/2} cy={(btnSize+12)/2} r={ringRadius}
              fill="none" stroke={silenceProgress > 60 ? C.error : C.primary}
              strokeWidth={3}
              strokeDasharray={ringCirc}
              strokeDashoffset={ringCirc * (1 - silenceProgress / 100)}
              strokeLinecap="round"
              transform={`rotate(-90 ${(btnSize+12)/2} ${(btnSize+12)/2})`}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
        )}

        <div style={{
          width: btnSize, height: btnSize, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, color: "#fff",
          transition: "transform 0.1s, background 0.2s",
          transform: `scale(${pulseScale})`,
          background: isRecording ? C.error : isProcessing ? C.muted : isListening ? C.success : C.muted,
          boxShadow: isListening
            ? `0 0 0 ${Math.round(volume/8)}px rgba(16,185,129,0.15), 0 4px 16px rgba(16,185,129,0.3)`
            : isRecording
            ? `0 0 0 ${Math.round(volume/5)}px rgba(239,68,68,0.18), 0 4px 16px rgba(239,68,68,0.4)`
            : "0 4px 16px rgba(0,0,0,0.1)",
        }}>
          {isProcessing ? "⏳" : isRecording ? "⏹" : "👂"}
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", minHeight: 18 }}>
        {statusText}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
