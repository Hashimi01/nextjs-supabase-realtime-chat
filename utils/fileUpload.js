/**
 * File Upload Utility
 * Supports both Supabase Storage and Cloudinary
 * Automatically chooses based on environment variables
 */

export const uploadFile = async (file, userId, supabase) => {
  if (!file) return null

  // Check if Cloudinary is configured
  const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  // Use Cloudinary if configured, otherwise use Supabase Storage
  if (cloudinaryCloudName && cloudinaryUploadPreset) {
    return await uploadToCloudinary(file, cloudinaryCloudName, cloudinaryUploadPreset)
  } else {
    return await uploadToSupabase(file, userId, supabase)
  }
}

/**
 * Upload to Cloudinary
 */
const uploadToCloudinary = async (file, cloudName, uploadPreset) => {
  try {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size too large. Maximum is 10 MB')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    
    // Determine resource type
    let resourceType = 'auto' // Cloudinary auto-detects
    if (file.type?.startsWith('image/')) {
      resourceType = 'image'
    } else if (file.type?.startsWith('audio/') || file.type?.startsWith('video/')) {
      resourceType = 'video'
    } else {
      resourceType = 'raw'
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error?.message || 'Failed to upload file to Cloudinary'
      
      // Provide helpful error messages
      if (errorMsg.includes('whitelisted') || errorMsg.includes('unsigned')) {
        throw new Error('Preset not enabled for Unsigned uploads. Go to Cloudinary Dashboard → Settings → Upload → preset ml_default → enable "Allow unsigned uploads"')
      }
      
      throw new Error(errorMsg)
    }

    const data = await response.json()

    // Determine file type from response
    let fileType = file.type
    if (!fileType && data.resource_type === 'image') {
      fileType = `image/${data.format || 'jpeg'}`
    } else if (!fileType && data.resource_type === 'video') {
      fileType = `video/${data.format || 'mp4'}`
    } else if (!fileType) {
      fileType = 'application/octet-stream'
    }

    return {
      file_url: data.secure_url || data.url,
      file_type: fileType,
      file_name: file.name || data.original_filename || 'file'
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw error
  }
}

/**
 * Upload to Supabase Storage
 */
const uploadToSupabase = async (file, userId, supabase) => {
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Get file extension more safely
  let fileExt = 'file'
  if (file.name && file.name.includes('.')) {
    fileExt = file.name.split('.').pop().toLowerCase()
  } else if (file.type) {
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    }
    fileExt = mimeToExt[file.type] || 'file'
  }

  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${userId}/${fileName}`

  try {
    // Check if file has content
    if (!file.size || file.size === 0) {
      throw new Error('File is empty')
    }

    const { data, error } = await supabase.storage
      .from('chat-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Storage upload error:', error)
      if (error.message?.includes('new row violates row-level security')) {
        throw new Error('Permission error. Please check Storage Policies')
      } else if (error.message?.includes('Bucket not found')) {
        throw new Error('Bucket not found. Please create bucket "chat-files" in Supabase or use Cloudinary')
      } else {
        throw error
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath)

    return {
      file_url: publicUrl,
      file_type: file.type || 'application/octet-stream',
      file_name: file.name || `file.${fileExt}`
    }
  } catch (error) {
    console.error('Supabase upload error:', error)
    throw error
  }
}

