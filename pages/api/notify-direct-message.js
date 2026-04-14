import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY
} = process.env

const smtpPort = SMTP_PORT ? Number(SMTP_PORT) : 465

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS
  } : undefined
})

// Simple in-memory rate limiter: max 3 emails per recipient per 10 minutes
const rateLimitMap = new Map()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

function isRateLimited(key) {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify the caller is an authenticated Supabase user
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  const {
    recipientEmail,
    recipientName,
    senderName,
    messagePreview,
    threadId
  } = req.body || {}

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return res.status(400).json({ error: 'A valid recipientEmail is required' })
  }

  if (isRateLimited(recipientEmail)) {
    return res.status(429).json({ error: 'Too many notifications sent to this recipient. Try again later.' })
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'SMTP configuration is missing on the server' })
  }

  const displaySender = senderName || 'User'
  const displayRecipient = recipientName || 'Friend'
  const fromAddress = SMTP_FROM || SMTP_USER

  const subject = `You have a new message from ${displaySender}`

  const previewText = messagePreview?.trim()
    ? messagePreview.trim()
    : 'You recently received a new message in the app.'

  const bodyLines = [
    `Hello ${displayRecipient},`,
    '',
    `${displaySender} sent you a new message in the chat app.`,
    '',
    'Message content:',
    previewText,
    '',
    'Log in to reply and see any attachments.',
    '',
    'Regards, Chat Team.'
  ]

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: bodyLines.join('\n'),
      html: bodyLines.map(line => line ? `<p>${line}</p>` : '<br />').join('')
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Failed to send DM notification email:', error)
    return res.status(500).json({ error: 'Failed to send email', details: error.message })
  }
}
