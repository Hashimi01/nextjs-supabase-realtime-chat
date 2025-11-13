const baseSvgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

const createIcon = (paths) => ({ size = 20, className } = {}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    {...baseSvgProps}
  >
    {paths}
  </svg>
)

export const PaperclipIcon = createIcon(
  <path d="M16.5 6.5v8.75a4.75 4.75 0 1 1-9.5 0v-9.5a3.75 3.75 0 1 1 7.5 0v8.5a2.75 2.75 0 1 1-5.5 0V7.75" />
)

export const MicIcon = createIcon(
  <>
    <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3a3.5 3.5 0 0 1-7 0Z" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v3" />
  </>
)

export const StopIcon = createIcon(
  <rect x="8" y="8" width="8" height="8" rx="1.5" />
)

export const CloseIcon = createIcon(
  <>
    <path d="m8 8 8 8" />
    <path d="m16 8-8 8" />
  </>
)

export const CheckIcon = createIcon(
  <path d="m6 12 4 4 8-8" />
)

export const WaveIcon = createIcon(
  <>
    <path d="M8.5 8.5c.5-1 1-2.5 2.5-2s1.5 2 1 3 0 2 1 2 1.5-1 2-2 1.5-2 2.5-1-1 5-1.5 6-1.5 2-3.5 2-3.5-1-4.5-2.5-1.5-3-1.5-4 0-1.5 1-1.5 1.5.5 1.5 1.5-.5 2.5 0 3.5" />
  </>
)

export const SendIcon = createIcon(
  <>
    <path d="M5 11.5 20 4l-7.5 15-1.5-6z" />
    <path d="m5 11.5 6.5 2" />
  </>
)

export const PlayIcon = createIcon(
  <path d="M8 5v14l11-7z" />
)

export const PauseIcon = createIcon(
  <>
    <path d="M9 5h2v14H9z" />
    <path d="M13 5h2v14h-2z" />
  </>
)

