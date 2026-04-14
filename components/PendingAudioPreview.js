import { useEffect, useMemo, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'
import { CloseIcon, PlayIcon, PauseIcon } from './Icons'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, seconds)
  const mins = Math.floor(total / 60)
  const secs = Math.floor(total % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const PendingAudioPreview = ({ file, onRemove }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(file.duration || 0)
  const [position, setPosition] = useState(0)

  const audioElement = useMemo(() => {
    const audio = new Audio(file.previewUrl)
    audio.preload = 'metadata'
    return audio
  }, [file.previewUrl])

  useEffect(() => {
    audioRef.current = audioElement

    const handleLoaded = () => {
      const dur = audioElement.duration || file.duration || 0
      setDuration(dur)
    }

    const handleTimeUpdate = () => {
      setPosition(audioElement.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setPosition(audioElement.duration || 0)
    }

    audioElement.addEventListener('loadedmetadata', handleLoaded)
    audioElement.addEventListener('timeupdate', handleTimeUpdate)
    audioElement.addEventListener('ended', handleEnded)

    return () => {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.removeEventListener('loadedmetadata', handleLoaded)
      audioElement.removeEventListener('timeupdate', handleTimeUpdate)
      audioElement.removeEventListener('ended', handleEnded)
    }
  }, [audioElement, file.duration])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div className={styles.pendingAudioBubble}>
      <button
        type="button"
        className={styles.pendingAudioDelete}
        onClick={() => {
          audioRef.current?.pause()
          onRemove()
        }}
        aria-label="Remove recording"
      >
        <CloseIcon size={14} />
      </button>
      <div className={styles.pendingAudioIndicator} />
      <div className={styles.pendingAudioInfo}>
        <button
          type="button"
          className={styles.pendingAudioPlay}
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <span className={styles.pendingAudioTime}>{formatTime(position || duration)}</span>
        <div className={styles.pendingAudioWave}>
          <div className={styles.pendingAudioWaveProgress} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}

export default PendingAudioPreview

