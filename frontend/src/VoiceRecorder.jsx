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

/**
 * VoiceRecorder — Push-to-Talk Mikrofon-Komponente.
 *
 * Props:
 *   onTranscript(text, blob) — wird nach erfolgreicher Aufnahme aufgerufen
 *   onError(message) — wird bei Fehlern aufgerufen
 *   disabled — deaktiviert den Button
 */
export default function VoiceRecorder({ onTranscript, onError, disabled }) {
  const [state, setState] = useState("idle") // idle | requesting | recording | processing
  const [volume, setVolume] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)

  // Cleanup beim Unmount
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
    analyserRef.current = analyser

    const buf = new Uint8Array(analyser.frequencyBinCount)
    function tick() {
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      setVolume(Math.min(100, avg * 2))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const startRecording = useCallback(async () => {
    if (state !== "idle" || disabled) return

    setState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startVolumeMonitor(stream)

      const mimeType = getSupportedMimeType()
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        setVolume(0)
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

      mr.start(100) // Chunks alle 100ms
      setState("recording")
    } catch (err) {
      setState("idle")
      if (err.name === "NotAllowedError") {
        onError?.("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.")
      } else {
        onError?.(`Mikrofon-Fehler: ${err.message}`)
      }
    }
  }, [state, disabled, onTranscript, onError])

  const stopRecording = useCallback(() => {
    if (state !== "recording") return
    mediaRecorderRef.current?.stop()
  }, [state])

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isRequesting = state === "requesting"

  const btnSize = 88
  const pulseScale = isRecording ? 1 + volume / 400 : 1

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* Mic button */}
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={e => { e.preventDefault(); startRecording() }}
        onTouchEnd={e => { e.preventDefault(); stopRecording() }}
        disabled={disabled || isProcessing || isRequesting}
        title={isRecording ? "Loslassen zum Beenden" : "Halten zum Sprechen"}
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
            ? `0 0 0 ${Math.round(volume / 5)}px rgba(239,68,68,0.2), 0 4px 16px rgba(239,68,68,0.4)`
            : "0 4px 16px rgba(238,127,0,0.3)",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {isProcessing ? "⏳" : isRecording ? "⏹" : "🎤"}
      </button>

      {/* Status label */}
      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", minHeight: 18 }}>
        {isRequesting && "Mikrofon-Zugriff..."}
        {isRecording && "Aufnahme läuft — loslassen zum Beenden"}
        {isProcessing && "Wird transkribiert..."}
        {state === "idle" && !disabled && "Halten zum Sprechen"}
        {disabled && "Spracherkennung nicht verfügbar"}
      </div>
    </div>
  )
}
