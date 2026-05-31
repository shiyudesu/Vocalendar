import { useCallback, useRef, useState } from 'react'

import { calculateVolume, float32ToInt16Pcm, resampleLinear } from '../lib/audio-utils'

const TARGET_SAMPLE_RATE = 16000

export interface VoiceRecorderState {
  isRecording: boolean
  volume: number
  error: string | null
}

export function useVoiceRecorder(onPcmChunk: (chunk: Int16Array) => void) {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    volume: 0,
    error: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sampleRateRef = useRef<number>(TARGET_SAMPLE_RATE)

  const startRecording = useCallback(async () => {
    try {
      setState({ isRecording: false, volume: 0, error: null })

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      sampleRateRef.current = audioContext.sampleRate

      const bufferSize = 4096
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        const volume = calculateVolume(inputData)
        setState((prev) => ({ ...prev, volume }))

        const resampled = resampleLinear(inputData, sampleRateRef.current, TARGET_SAMPLE_RATE)
        const pcm = float32ToInt16Pcm(resampled)
        onPcmChunk(pcm)
      }

      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0
      gainNodeRef.current = gainNode
      source.connect(processor)
      processor.connect(gainNode)
      gainNode.connect(audioContext.destination)

      setState({ isRecording: true, volume: 0, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法访问麦克风'
      setState({ isRecording: false, volume: 0, error: message })
    }
  }, [onPcmChunk])

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    setState({ isRecording: false, volume: 0, error: null })
  }, [])

  return { state, startRecording, stopRecording }
}
