import nodemailer from 'nodemailer'

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    recipientEmail,
    recipientName,
    senderName,
    messagePreview,
    threadId
  } = req.body || {}

  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required' })
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'SMTP configuration is missing on the server' })
  }

  const displaySender = senderName || 'مستخدم'
  const displayRecipient = recipientName || 'صديقك'
  const fromAddress = SMTP_FROM || SMTP_USER

  const subject = `لديك رسالة جديدة من ${displaySender}`

  const previewText = messagePreview?.trim()
    ? messagePreview.trim()
    : 'لقد وصلك حديثًا رسالة جديدة داخل التطبيق.'

  const bodyLines = [
    `مرحبًا ${displayRecipient},`,
    '',
    `لقد أرسل لك ${displaySender} رسالة جديدة داخل تطبيق الدردشة.`,
    '',
    'محتوى الرسالة:',
    previewText,
    '',
    'سجّل الدخول للرد على الرسالة والاطلاع على جميع المرفقات إن وجدت.',
    '',
    'مع تحيات فريق الدردشة.'
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

