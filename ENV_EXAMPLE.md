# Environment Variables Guide

Copy these variable names into your `.env.local` file and fill in your own values.
Never commit `.env.local` to version control.

## Supabase (required)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

## SMTP / Email Notifications (optional)

Used by the `/api/notify-direct-message` endpoint to send email alerts for new DMs.

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-app-password
SMTP_FROM=Your App Name <your-email@example.com>
```

## Cloudinary – File & Audio Uploads (optional)

Only the cloud name and an unsigned upload preset are needed on the frontend.
Never expose the API Secret or API Key in frontend environment variables.

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset-name
```

> **Tip:** Create an unsigned upload preset in the Cloudinary Dashboard under
> Settings → Upload → Upload Presets, then enable "Unsigned uploading".

## Notes

- All `NEXT_PUBLIC_*` variables are bundled into the client-side JavaScript and are
  visible to anyone who views the page source. Only put non-sensitive config there.
- `SMTP_PASS` and any secret keys must **never** use the `NEXT_PUBLIC_` prefix.
- After changing credentials in Supabase or Cloudinary, restart the dev server.
